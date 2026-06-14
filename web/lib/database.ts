import { Pool, type PoolConfig } from "pg";
import type { ChatRequestLimitStatus } from "./chat-request-limit";

type ChatMessageRole = "user" | "assistant" | "system" | "tool";
export type ChatContextLogPurpose = "reply" | "tool_followup" | "summary";

export type ChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatSummary = {
  summary: string;
  message_count: number;
  created_at: Date;
  updated_at: Date;
};

export type ChatToolCall = {
  id: string;
  tool_call_id: string;
  name: string;
  arguments: Record<string, unknown>;
  result: unknown;
  created_at: Date;
};

export type ChatContextLog = {
  id: string;
  purpose: ChatContextLogPurpose;
  model: string;
  messages: unknown;
  tools: unknown | null;
  tool_choice: unknown | null;
  temperature: string | null;
  max_completion_tokens: number | null;
  created_at: Date;
};

type ChatLeadData = {
  client_name?: string | null;
  email_address?: string | null;
  phone_number?: string | null;
  company_or_studio?: string | null;
};

export type ChatListItem = {
  id: string;
  chat_name: string | null;
  input_size: string;
  output_size: string;
  is_active: boolean;
  score: number;
  created_at: Date;
  updated_at: Date;
  message_count: number;
  client_name: string | null;
  email_address: string | null;
  phone_number: string | null;
  company_or_studio: string | null;
};

export type StoredChatMessage = {
  id: string;
  role: ChatMessageRole;
  content: string;
  created_at: Date;
};

export type ChatDetail = ChatListItem & {
  messages: StoredChatMessage[];
  summary: ChatSummary | null;
  toolCalls: ChatToolCall[];
  contextLogs: ChatContextLog[];
};

export type ChatLeadListItem = {
  id: string;
  chat_id: string;
  client_name: string | null;
  email_address: string | null;
  phone_number: string | null;
  company_or_studio: string | null;
  created_at: Date;
  updated_at: Date;
  chat_name: string | null;
  chat_score: number;
  chat_is_active: boolean;
  chat_input_size: string;
  chat_output_size: string;
  chat_created_at: Date;
  chat_updated_at: Date;
};

let pool: Pool | undefined;
let chatToolCallsTableReady: Promise<void> | undefined;
let chatContextLogsTableReady: Promise<void> | undefined;
const appChatRequestLimitLockKey = 482401;

function getRequiredDatabaseEnv(key: string) {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new Error(`${key} is missing`);
  }

  return value;
}

function getDatabasePort() {
  const rawPort = process.env.POSTGRES_PORT?.trim() || "5432";
  const port = Number.parseInt(rawPort, 10);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("POSTGRES_PORT must be a positive integer");
  }

  return port;
}

function getDatabaseConfig(): PoolConfig {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (databaseUrl) {
    return { connectionString: databaseUrl };
  }

  return {
    host: process.env.POSTGRES_HOST?.trim() || "localhost",
    port: getDatabasePort(),
    database: getRequiredDatabaseEnv("POSTGRES_DB"),
    user: getRequiredDatabaseEnv("POSTGRES_USER"),
    password: getRequiredDatabaseEnv("POSTGRES_PASSWORD"),
  };
}

export function getPool() {
  pool ??= new Pool(getDatabaseConfig());

  return pool;
}

export async function ensureChat(sessionId: string) {
  await getPool().query(
    `
      INSERT INTO chats (id, is_active)
      VALUES ($1, true)
      ON CONFLICT (id) DO NOTHING
    `,
    [sessionId],
  );
}

export async function getChatIsActive(sessionId: string) {
  const result = await getPool().query<{ is_active: boolean }>(
    `
      SELECT is_active
      FROM chats
      WHERE id = $1
    `,
    [sessionId],
  );

  return result.rows[0]?.is_active ?? null;
}

export async function deactivateChat(sessionId: string) {
  await ensureChat(sessionId);

  await getPool().query(
    `
      UPDATE chats
      SET
        is_active = false,
        updated_at = now()
      WHERE id = $1
    `,
    [sessionId],
  );
}

export async function appendChatMessage(
  sessionId: string,
  role: ChatMessageRole,
  content: string,
) {
  await ensureChat(sessionId);

  const client = await getPool().connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
        INSERT INTO messages (chat_id, role, content)
        VALUES ($1, $2, $3)
      `,
      [sessionId, role, content],
    );

    await client.query(
      `
        UPDATE chats
        SET
          updated_at = now()
        WHERE id = $1
      `,
      [sessionId],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getChatRequestLimitStatus(
  limit: number,
): Promise<ChatRequestLimitStatus> {
  const normalizedLimit = normalizeRequestLimit(limit);
  const usage = await getHourlyUserMessageUsage();

  return toChatRequestLimitStatus(normalizedLimit, usage);
}

export async function appendLimitedUserChatMessage(
  sessionId: string,
  content: string,
  limit: number,
) {
  const normalizedLimit = normalizeRequestLimit(limit);

  if (normalizedLimit === 0) {
    await appendChatMessage(sessionId, "user", content);

    return {
      allowed: true,
      status: await getChatRequestLimitStatus(normalizedLimit),
    } as const;
  }

  await ensureChat(sessionId);

  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [
      appChatRequestLimitLockKey,
    ]);

    const usageResult = await client.query<{
      used: number;
      oldest_created_at: Date | null;
    }>(
      `
        SELECT
          count(*)::int AS used,
          min(created_at) AS oldest_created_at
        FROM messages
        WHERE role = 'user'
          AND created_at >= now() - interval '1 hour'
      `,
    );
    const usage = {
      used: usageResult.rows[0]?.used ?? 0,
      oldestCreatedAt: usageResult.rows[0]?.oldest_created_at ?? null,
    };

    if (usage.used >= normalizedLimit) {
      await client.query("COMMIT");

      return {
        allowed: false,
        status: toChatRequestLimitStatus(normalizedLimit, usage),
      } as const;
    }

    await client.query(
      `
        INSERT INTO messages (chat_id, role, content)
        VALUES ($1, 'user', $2)
      `,
      [sessionId, content],
    );

    await client.query(
      `
        UPDATE chats
        SET
          updated_at = now()
        WHERE id = $1
      `,
      [sessionId],
    );

    const updatedUsage = {
      used: usage.used + 1,
      oldestCreatedAt: usage.oldestCreatedAt ?? new Date(),
    };

    await client.query("COMMIT");

    return {
      allowed: true,
      status: toChatRequestLimitStatus(normalizedLimit, updatedUsage),
    } as const;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function recordChatToolCall(
  sessionId: string,
  data: {
    toolCallId: string;
    name: string;
    arguments: Record<string, unknown>;
    result: unknown;
  },
) {
  await ensureChatToolCallsTable();
  await ensureChat(sessionId);

  await getPool().query(
    `
      INSERT INTO chat_tool_calls (chat_id, tool_call_id, name, arguments, result)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [
      sessionId,
      data.toolCallId,
      data.name,
      toJsonbParam(data.arguments),
      toJsonbParam(data.result),
    ],
  );
}

export async function getChatToolCalls(sessionId: string, limit = 10) {
  await ensureChatToolCallsTable();

  const normalizedLimit =
    Number.isFinite(limit) && limit > 0 ? Math.trunc(limit) : 10;
  const result = await getPool().query<ChatToolCall>(
    `
      SELECT id, tool_call_id, name, arguments, result, created_at
      FROM (
        SELECT id, tool_call_id, name, arguments, result, created_at
        FROM chat_tool_calls
        WHERE chat_id = $1
        ORDER BY created_at DESC, id DESC
        LIMIT $2
      ) recent_tool_calls
      ORDER BY created_at, id
    `,
    [sessionId, normalizedLimit],
  );

  return result.rows;
}

export async function recordChatContextLog(
  sessionId: string,
  data: {
    purpose: ChatContextLogPurpose;
    model: string;
    messages: unknown;
    tools?: unknown;
    toolChoice?: unknown;
    temperature?: number | null;
    maxCompletionTokens?: number | null;
  },
) {
  await ensureChatContextLogsTable();
  await ensureChat(sessionId);

  await getPool().query(
    `
      INSERT INTO chat_context_logs (
        chat_id,
        purpose,
        model,
        messages,
        tools,
        tool_choice,
        temperature,
        max_completion_tokens
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
    [
      sessionId,
      data.purpose,
      data.model,
      toJsonbParam(data.messages),
      toNullableJsonbParam(data.tools),
      toNullableJsonbParam(data.toolChoice),
      data.temperature ?? null,
      normalizeOptionalInteger(data.maxCompletionTokens),
    ],
  );
}

export async function getChatContextLogs(sessionId: string, limit = 25) {
  await ensureChatContextLogsTable();

  const normalizedLimit =
    Number.isFinite(limit) && limit > 0 ? Math.trunc(limit) : 25;
  const result = await getPool().query<ChatContextLog>(
    `
      SELECT
        id,
        purpose,
        model,
        messages,
        tools,
        tool_choice,
        temperature::text AS temperature,
        max_completion_tokens,
        created_at
      FROM chat_context_logs
      WHERE chat_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2
    `,
    [sessionId, normalizedLimit],
  );

  return result.rows;
}

export async function addChatTokenUsage(
  sessionId: string,
  inputTokens: number,
  outputTokens: number,
) {
  const inputSize =
    Number.isFinite(inputTokens) && inputTokens > 0 ? Math.trunc(inputTokens) : 0;
  const outputSize =
    Number.isFinite(outputTokens) && outputTokens > 0
      ? Math.trunc(outputTokens)
      : 0;

  if (inputSize <= 0 && outputSize <= 0) {
    return;
  }

  await ensureChat(sessionId);

  await getPool().query(
    `
      UPDATE chats
      SET
        input_size = input_size + $2,
        output_size = output_size + $3,
        updated_at = now()
      WHERE id = $1
    `,
    [sessionId, inputSize, outputSize],
  );
}

export async function setChatNameIfEmpty(sessionId: string, chatName: string) {
  const normalizedChatName = chatName.trim();

  if (!normalizedChatName) {
    return false;
  }

  await ensureChat(sessionId);

  const result = await getPool().query(
    `
      UPDATE chats
      SET
        chat_name = $2,
        updated_at = now()
      WHERE id = $1
        AND NULLIF(btrim(chat_name), '') IS NULL
    `,
    [sessionId, normalizedChatName],
  );

  return (result.rowCount ?? 0) > 0;
}

export async function getChatMessages(sessionId: string) {
  const result = await getPool().query<ChatHistoryMessage>(
    `
      SELECT role, content
      FROM messages
      WHERE chat_id = $1
        AND role IN ('user', 'assistant')
      ORDER BY created_at, id
    `,
    [sessionId],
  );

  return result.rows;
}

export async function countChatMessages(sessionId: string) {
  const result = await getPool().query<{ message_count: number }>(
    `
      SELECT count(*)::int AS message_count
      FROM messages
      WHERE chat_id = $1
        AND role IN ('user', 'assistant')
    `,
    [sessionId],
  );

  return result.rows[0]?.message_count ?? 0;
}

export async function getChatMessagesAfterCount(
  sessionId: string,
  messageCount: number,
) {
  const offset =
    Number.isFinite(messageCount) && messageCount > 0
      ? Math.trunc(messageCount)
      : 0;

  const result = await getPool().query<ChatHistoryMessage>(
    `
      SELECT role, content
      FROM messages
      WHERE chat_id = $1
        AND role IN ('user', 'assistant')
      ORDER BY created_at, id
      OFFSET $2
    `,
    [sessionId, offset],
  );

  return result.rows;
}

export async function getChatSummary(sessionId: string) {
  const result = await getPool().query<ChatSummary>(
    `
      SELECT summary, message_count, created_at, updated_at
      FROM chat_summaries
      WHERE chat_id = $1
    `,
    [sessionId],
  );

  return result.rows[0] ?? null;
}

export async function upsertChatSummary(
  sessionId: string,
  summary: string,
  messageCount: number,
) {
  await ensureChat(sessionId);

  const normalizedCount =
    Number.isFinite(messageCount) && messageCount > 0
      ? Math.trunc(messageCount)
      : 0;

  const result = await getPool().query<ChatSummary>(
    `
      INSERT INTO chat_summaries (chat_id, summary, message_count)
      VALUES ($1, $2, $3)
      ON CONFLICT (chat_id) DO UPDATE SET
        summary = EXCLUDED.summary,
        message_count = EXCLUDED.message_count,
        updated_at = now()
      RETURNING summary, message_count, created_at, updated_at
    `,
    [sessionId, summary, normalizedCount],
  );

  return result.rows[0];
}

export function scoreChat(data: ChatLeadData) {
  let score = 0;

  if (isValidEmail(data.email_address)) score += 40;
  if (data.client_name) score += 25;
  if (data.phone_number) score += 20;
  if (data.company_or_studio) score += 15;

  return Math.min(score, 100);
}

export async function upsertChatLead(sessionId: string, data: ChatLeadData) {
  await ensureChat(sessionId);

  const result = await getPool().query<ChatLeadData>(
    `
      INSERT INTO chat_leads (
        chat_id,
        client_name,
        email_address,
        phone_number,
        company_or_studio
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (chat_id) DO UPDATE SET
        client_name = COALESCE(EXCLUDED.client_name, chat_leads.client_name),
        email_address = COALESCE(EXCLUDED.email_address, chat_leads.email_address),
        phone_number = COALESCE(EXCLUDED.phone_number, chat_leads.phone_number),
        company_or_studio = COALESCE(EXCLUDED.company_or_studio, chat_leads.company_or_studio),
        updated_at = now()
      RETURNING
        client_name,
        email_address,
        phone_number,
        company_or_studio
    `,
    [
      sessionId,
      data.client_name ?? null,
      data.email_address ?? null,
      data.phone_number ?? null,
      data.company_or_studio ?? null,
    ],
  );

  const score = scoreChat(result.rows[0]);

  await getPool().query(
    `
      UPDATE chats
      SET
        score = $2,
        updated_at = now()
      WHERE id = $1
    `,
    [sessionId, score],
  );
}

export async function listChats() {
  const result = await getPool().query<ChatListItem>(
    `
      SELECT
        c.id,
        c.chat_name,
        c.input_size::text AS input_size,
        c.output_size::text AS output_size,
        c.is_active,
        c.score,
        c.created_at,
        c.updated_at,
        count(m.id)::int AS message_count,
        l.client_name,
        l.email_address,
        l.phone_number,
        l.company_or_studio
      FROM chats c
      LEFT JOIN messages m ON m.chat_id = c.id
      LEFT JOIN chat_leads l ON l.chat_id = c.id
      GROUP BY
        c.id,
        l.client_name,
        l.email_address,
        l.phone_number,
        l.company_or_studio
      ORDER BY c.updated_at DESC, c.created_at DESC
    `,
  );

  return result.rows;
}

export async function getChatDetail(chatId: string): Promise<ChatDetail | null> {
  const chatResult = await getPool().query<ChatListItem>(
    `
      SELECT
        c.id,
        c.chat_name,
        c.input_size::text AS input_size,
        c.output_size::text AS output_size,
        c.is_active,
        c.score,
        c.created_at,
        c.updated_at,
        count(m.id)::int AS message_count,
        l.client_name,
        l.email_address,
        l.phone_number,
        l.company_or_studio
      FROM chats c
      LEFT JOIN messages m ON m.chat_id = c.id
      LEFT JOIN chat_leads l ON l.chat_id = c.id
      WHERE c.id = $1
      GROUP BY
        c.id,
        l.client_name,
        l.email_address,
        l.phone_number,
        l.company_or_studio
    `,
    [chatId],
  );

  const chat = chatResult.rows[0];

  if (!chat) {
    return null;
  }

  const messagesResult = await getPool().query<StoredChatMessage>(
    `
      SELECT id, role, content, created_at
      FROM messages
      WHERE chat_id = $1
      ORDER BY created_at, id
    `,
    [chatId],
  );

  const summary = await getChatSummary(chatId);
  const toolCalls = await getChatToolCalls(chatId);
  const contextLogs = await getChatContextLogs(chatId);

  return {
    ...chat,
    messages: messagesResult.rows,
    summary,
    toolCalls,
    contextLogs,
  };
}

export async function listChatLeads() {
  const result = await getPool().query<ChatLeadListItem>(
    `
      SELECT
        l.id,
        l.chat_id,
        l.client_name,
        l.email_address,
        l.phone_number,
        l.company_or_studio,
        l.created_at,
        l.updated_at,
        c.chat_name,
        c.score AS chat_score,
        c.is_active AS chat_is_active,
        c.input_size::text AS chat_input_size,
        c.output_size::text AS chat_output_size,
        c.created_at AS chat_created_at,
        c.updated_at AS chat_updated_at
      FROM chat_leads l
      JOIN chats c ON c.id = l.chat_id
      ORDER BY l.updated_at DESC, l.created_at DESC
    `,
  );

  return result.rows;
}

function isValidEmail(value: string | null | undefined) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function ensureChatToolCallsTable() {
  chatToolCallsTableReady ??= (async () => {
    await getPool().query(`
      CREATE TABLE IF NOT EXISTS chat_tool_calls (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        tool_call_id text NOT NULL,
        name text NOT NULL,
        arguments jsonb NOT NULL DEFAULT '{}'::jsonb,
        result jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await getPool().query(`
      CREATE INDEX IF NOT EXISTS chat_tool_calls_chat_id_created_at_idx
        ON chat_tool_calls(chat_id, created_at)
    `);
  })().catch((error) => {
    chatToolCallsTableReady = undefined;
    throw error;
  });

  await chatToolCallsTableReady;
}

async function ensureChatContextLogsTable() {
  chatContextLogsTableReady ??= (async () => {
    await getPool().query(`
      CREATE TABLE IF NOT EXISTS chat_context_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        purpose text NOT NULL CHECK (purpose IN ('reply', 'tool_followup', 'summary')),
        model text NOT NULL,
        messages jsonb NOT NULL,
        tools jsonb,
        tool_choice jsonb,
        temperature numeric,
        max_completion_tokens integer,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await getPool().query(`
      CREATE INDEX IF NOT EXISTS chat_context_logs_chat_id_created_at_idx
        ON chat_context_logs(chat_id, created_at)
    `);
  })().catch((error) => {
    chatContextLogsTableReady = undefined;
    throw error;
  });

  await chatContextLogsTableReady;
}

function toJsonbParam(value: unknown) {
  return JSON.stringify(value ?? null);
}

function toNullableJsonbParam(value: unknown) {
  return value === undefined ? null : toJsonbParam(value);
}

function normalizeOptionalInteger(value: number | null | undefined) {
  return Number.isFinite(value) && value !== null && value !== undefined
    ? Math.trunc(value)
    : null;
}

function normalizeRequestLimit(limit: number) {
  return Number.isInteger(limit) && limit > 0 ? limit : 0;
}

async function getHourlyUserMessageUsage() {
  const result = await getPool().query<{
    used: number;
    oldest_created_at: Date | null;
  }>(
    `
      SELECT
        count(*)::int AS used,
        min(created_at) AS oldest_created_at
      FROM messages
      WHERE role = 'user'
        AND created_at >= now() - interval '1 hour'
    `,
  );

  return {
    used: result.rows[0]?.used ?? 0,
    oldestCreatedAt: result.rows[0]?.oldest_created_at ?? null,
  };
}

function toChatRequestLimitStatus(
  limit: number,
  usage: { used: number; oldestCreatedAt: Date | null },
): ChatRequestLimitStatus {
  if (limit === 0) {
    return {
      limit,
      used: usage.used,
      remaining: null,
      resetAt: null,
    };
  }

  return {
    limit,
    used: usage.used,
    remaining: Math.max(limit - usage.used, 0),
    resetAt: usage.oldestCreatedAt
      ? new Date(usage.oldestCreatedAt.getTime() + 60 * 60 * 1000).toISOString()
      : null,
  };
}
