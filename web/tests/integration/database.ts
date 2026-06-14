import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { getRequiredEnv } from "./env";

const databaseUrl = getRequiredEnv("DATABASE_URL");

process.env.DATABASE_URL = databaseUrl;

const pool = new Pool({
  connectionString: databaseUrl,
});

const knownInactiveChatId = "a71e5c41-bb78-4926-a6ce-a7ece98fc379";
const knownActiveChatId = "35f7af80-8ed3-4c3c-8af0-d103674842a1";

async function main() {
  const sessionId = randomUUID();
  const mcpSessionId = randomUUID();
  const {
    addChatTokenUsage,
    appendChatMessage,
    appendLimitedUserChatMessage,
    countChatMessages,
    deactivateChat,
    ensureChat,
    getChatRequestLimitStatus,
    getChatIsActive,
    getChatContextLogs,
    getChatToolCalls,
    getChatMessages,
    getChatMessagesAfterCount,
    getChatDetail,
    getChatSummary,
    listChatLeads,
    listChats,
    recordChatContextLog,
    recordChatToolCall,
    scoreChat,
    setChatNameIfEmpty,
    upsertChatSummary,
    upsertChatLead,
  } =
    await import("../../lib/database");

  try {
    await getChatToolCalls(sessionId);
    await assertSchema();
    await assertChatRequestLimitConfig();
    await assertKnownChatActivity({ getChatIsActive });
    await assertInactiveChatPostBlocked();
    await assertOverTokenLimitChatPostBlocked();
    await assertChatCountryFromLanguage();
    await assertMcpDeactivateChat({
      ensureChat,
      getChatIsActive,
      sessionId: mcpSessionId,
    });
    await assertChatMessagesAndLeads({
      appendChatMessage,
      appendLimitedUserChatMessage,
      addChatTokenUsage,
      countChatMessages,
      deactivateChat,
      ensureChat,
      getChatRequestLimitStatus,
      getChatIsActive,
      getChatContextLogs,
      getChatToolCalls,
      getChatMessages,
      getChatMessagesAfterCount,
      getChatDetail,
      getChatSummary,
      listChatLeads,
      listChats,
      recordChatContextLog,
      recordChatToolCall,
      scoreChat,
      setChatNameIfEmpty,
      sessionId,
      upsertChatSummary,
      upsertChatLead,
    });
    console.log("Database integration test passed.");
  } finally {
    await pool
      .query("DELETE FROM chats WHERE id = $1", [sessionId])
      .catch(() => undefined);
    await pool
      .query("DELETE FROM chats WHERE id = $1", [mcpSessionId])
      .catch(() => undefined);
    await pool.end();
  }
}

async function assertSchema() {
  const extensionResult = await pool.query<{ extname: string }>(
    `
      SELECT extname
      FROM pg_extension
      WHERE extname IN ('vector', 'pgcrypto')
      ORDER BY extname
    `,
  );

  assert.deepEqual(
    extensionResult.rows.map((row) => row.extname),
    ["pgcrypto", "vector"],
  );

  const tableResult = await pool.query<{ table_name: string }>(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'chats',
          'messages',
          'chat_leads',
          'chat_summaries',
          'chat_context_logs',
          'chat_tool_calls'
        )
      ORDER BY table_name
    `,
  );

  assert.deepEqual(
    tableResult.rows.map((row) => row.table_name),
    [
      "chat_context_logs",
      "chat_leads",
      "chat_summaries",
      "chat_tool_calls",
      "chats",
      "messages",
    ],
  );

  const chatColumnResult = await pool.query<{
    column_name: string;
    column_default: string | null;
    data_type: string;
    is_nullable: string;
  }>(
    `
      SELECT column_name, column_default, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'chats'
        AND column_name IN (
          'created_at',
          'input_size',
          'is_active',
          'output_size',
          'updated_at'
        )
      ORDER BY column_name
    `,
  );

  assert.deepEqual(
    chatColumnResult.rows.map((row) => ({
      column_name: row.column_name,
      data_type: row.data_type,
      is_nullable: row.is_nullable,
    })),
    [
      {
        column_name: "created_at",
        data_type: "timestamp with time zone",
        is_nullable: "NO",
      },
      {
        column_name: "input_size",
        data_type: "bigint",
        is_nullable: "NO",
      },
      {
        column_name: "is_active",
        data_type: "boolean",
        is_nullable: "NO",
      },
      {
        column_name: "output_size",
        data_type: "bigint",
        is_nullable: "NO",
      },
      {
        column_name: "updated_at",
        data_type: "timestamp with time zone",
        is_nullable: "NO",
      },
    ],
  );

  const leadColumnResult = await pool.query<{
    column_name: string;
    data_type: string;
    is_nullable: string;
  }>(
    `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'chat_leads'
      ORDER BY column_name
    `,
  );

  assert.deepEqual(
    leadColumnResult.rows.map((row) => ({
      column_name: row.column_name,
      data_type: row.data_type,
      is_nullable: row.is_nullable,
    })),
    [
      {
        column_name: "chat_id",
        data_type: "uuid",
        is_nullable: "NO",
      },
      {
        column_name: "client_name",
        data_type: "text",
        is_nullable: "YES",
      },
      {
        column_name: "company_or_studio",
        data_type: "text",
        is_nullable: "YES",
      },
      {
        column_name: "created_at",
        data_type: "timestamp with time zone",
        is_nullable: "NO",
      },
      {
        column_name: "email_address",
        data_type: "text",
        is_nullable: "YES",
      },
      {
        column_name: "id",
        data_type: "uuid",
        is_nullable: "NO",
      },
      {
        column_name: "phone_number",
        data_type: "text",
        is_nullable: "YES",
      },
      {
        column_name: "updated_at",
        data_type: "timestamp with time zone",
        is_nullable: "NO",
      },
    ],
  );

  const summaryColumnResult = await pool.query<{
    column_name: string;
    data_type: string;
    is_nullable: string;
  }>(
    `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'chat_summaries'
      ORDER BY column_name
    `,
  );

  assert.deepEqual(
    summaryColumnResult.rows.map((row) => ({
      column_name: row.column_name,
      data_type: row.data_type,
      is_nullable: row.is_nullable,
    })),
    [
      {
        column_name: "chat_id",
        data_type: "uuid",
        is_nullable: "NO",
      },
      {
        column_name: "created_at",
        data_type: "timestamp with time zone",
        is_nullable: "NO",
      },
      {
        column_name: "id",
        data_type: "uuid",
        is_nullable: "NO",
      },
      {
        column_name: "message_count",
        data_type: "integer",
        is_nullable: "NO",
      },
      {
        column_name: "summary",
        data_type: "text",
        is_nullable: "NO",
      },
      {
        column_name: "updated_at",
        data_type: "timestamp with time zone",
        is_nullable: "NO",
      },
    ],
  );

  const toolCallColumnResult = await pool.query<{
    column_name: string;
    data_type: string;
    is_nullable: string;
  }>(
    `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'chat_tool_calls'
      ORDER BY column_name
    `,
  );

  assert.deepEqual(
    toolCallColumnResult.rows.map((row) => ({
      column_name: row.column_name,
      data_type: row.data_type,
      is_nullable: row.is_nullable,
    })),
    [
      {
        column_name: "arguments",
        data_type: "jsonb",
        is_nullable: "NO",
      },
      {
        column_name: "chat_id",
        data_type: "uuid",
        is_nullable: "NO",
      },
      {
        column_name: "created_at",
        data_type: "timestamp with time zone",
        is_nullable: "NO",
      },
      {
        column_name: "id",
        data_type: "uuid",
        is_nullable: "NO",
      },
      {
        column_name: "name",
        data_type: "text",
        is_nullable: "NO",
      },
      {
        column_name: "result",
        data_type: "jsonb",
        is_nullable: "NO",
      },
      {
        column_name: "tool_call_id",
        data_type: "text",
        is_nullable: "NO",
      },
    ],
  );

  const contextLogColumnResult = await pool.query<{
    column_name: string;
    data_type: string;
    is_nullable: string;
  }>(
    `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'chat_context_logs'
      ORDER BY column_name
    `,
  );

  assert.deepEqual(
    contextLogColumnResult.rows.map((row) => ({
      column_name: row.column_name,
      data_type: row.data_type,
      is_nullable: row.is_nullable,
    })),
    [
      {
        column_name: "chat_id",
        data_type: "uuid",
        is_nullable: "NO",
      },
      {
        column_name: "created_at",
        data_type: "timestamp with time zone",
        is_nullable: "NO",
      },
      {
        column_name: "id",
        data_type: "uuid",
        is_nullable: "NO",
      },
      {
        column_name: "max_completion_tokens",
        data_type: "integer",
        is_nullable: "YES",
      },
      {
        column_name: "messages",
        data_type: "jsonb",
        is_nullable: "NO",
      },
      {
        column_name: "model",
        data_type: "text",
        is_nullable: "NO",
      },
      {
        column_name: "purpose",
        data_type: "text",
        is_nullable: "NO",
      },
      {
        column_name: "temperature",
        data_type: "numeric",
        is_nullable: "YES",
      },
      {
        column_name: "tool_choice",
        data_type: "jsonb",
        is_nullable: "YES",
      },
      {
        column_name: "tools",
        data_type: "jsonb",
        is_nullable: "YES",
      },
    ],
  );
}

type DatabaseHelpers = {
  addChatTokenUsage: (
    sessionId: string,
    inputTokens: number,
    outputTokens: number,
  ) => Promise<void>;
  appendChatMessage: (
    sessionId: string,
    role: "user" | "assistant" | "system" | "tool",
    content: string,
  ) => Promise<void>;
  appendLimitedUserChatMessage: (
    sessionId: string,
    content: string,
    limit: number,
  ) => Promise<
    | {
        allowed: true;
        status: {
          limit: number;
          used: number;
          remaining: number | null;
          resetAt: string | null;
        };
      }
    | {
        allowed: false;
        status: {
          limit: number;
          used: number;
          remaining: number | null;
          resetAt: string | null;
        };
      }
  >;
  countChatMessages: (sessionId: string) => Promise<number>;
  deactivateChat: (sessionId: string) => Promise<void>;
  ensureChat: (sessionId: string) => Promise<void>;
  getChatDetail: (sessionId: string) => Promise<{
    id: string;
    message_count: number;
    messages: Array<{ role: string; content: string }>;
    toolCalls: Array<{
      tool_call_id: string;
      name: string;
      arguments: Record<string, unknown>;
      result: unknown;
    }>;
    contextLogs: Array<{
      purpose: string;
      model: string;
      messages: unknown;
    }>;
  } | null>;
  getChatContextLogs: (
    sessionId: string,
    limit?: number,
  ) => Promise<
    Array<{
      purpose: string;
      model: string;
      messages: unknown;
      tools: unknown | null;
      tool_choice: unknown | null;
      temperature: string | null;
      max_completion_tokens: number | null;
      created_at: Date;
    }>
  >;
  getChatIsActive: (sessionId: string) => Promise<boolean | null>;
  getChatRequestLimitStatus: (limit: number) => Promise<{
    limit: number;
    used: number;
    remaining: number | null;
    resetAt: string | null;
  }>;
  getChatMessages: (
    sessionId: string,
  ) => Promise<Array<{ role: "user" | "assistant"; content: string }>>;
  getChatMessagesAfterCount: (
    sessionId: string,
    messageCount: number,
  ) => Promise<Array<{ role: "user" | "assistant"; content: string }>>;
  getChatSummary: (sessionId: string) => Promise<{
    summary: string;
    message_count: number;
    created_at: Date;
    updated_at: Date;
  } | null>;
  getChatToolCalls: (
    sessionId: string,
    limit?: number,
  ) => Promise<
    Array<{
      tool_call_id: string;
      name: string;
      arguments: Record<string, unknown>;
      result: unknown;
      created_at: Date;
    }>
  >;
  listChatLeads: () => Promise<Array<{ chat_id: string; email_address: string | null }>>;
  listChats: () => Promise<Array<{ id: string; message_count: number }>>;
  recordChatContextLog: (
    sessionId: string,
    data: {
      purpose: "reply" | "tool_followup" | "summary";
      model: string;
      messages: unknown;
      tools?: unknown;
      toolChoice?: unknown;
      temperature?: number | null;
      maxCompletionTokens?: number | null;
    },
  ) => Promise<void>;
  recordChatToolCall: (
    sessionId: string,
    data: {
      toolCallId: string;
      name: string;
      arguments: Record<string, unknown>;
      result: unknown;
    },
  ) => Promise<void>;
  scoreChat: (data: {
    client_name?: string | null;
    email_address?: string | null;
    phone_number?: string | null;
    company_or_studio?: string | null;
  }) => number;
  setChatNameIfEmpty: (sessionId: string, chatName: string) => Promise<boolean>;
  sessionId: string;
  upsertChatSummary: (
    sessionId: string,
    summary: string,
    messageCount: number,
  ) => Promise<{
    summary: string;
    message_count: number;
    created_at: Date;
    updated_at: Date;
  }>;
  upsertChatLead: (
    sessionId: string,
    data: {
      client_name?: string | null;
      email_address?: string | null;
      phone_number?: string | null;
      company_or_studio?: string | null;
    },
  ) => Promise<void>;
};

async function assertKnownChatActivity({
  getChatIsActive,
}: Pick<DatabaseHelpers, "getChatIsActive">) {
  assert.equal(await getChatIsActive(knownInactiveChatId), false);
  assert.equal(await getChatIsActive(knownActiveChatId), true);
}

async function assertChatRequestLimitConfig() {
  const { getAppChatRequestsPerHour } = await import(
    "../../lib/chat-request-limit"
  );
  const originalLimit = process.env.APP_CHAT_REQUESTS_PER_HOUR;

  try {
    delete process.env.APP_CHAT_REQUESTS_PER_HOUR;
    assert.equal(getAppChatRequestsPerHour(), 0);

    process.env.APP_CHAT_REQUESTS_PER_HOUR = "";
    assert.equal(getAppChatRequestsPerHour(), 0);

    process.env.APP_CHAT_REQUESTS_PER_HOUR = "0";
    assert.equal(getAppChatRequestsPerHour(), 0);

    process.env.APP_CHAT_REQUESTS_PER_HOUR = "17";
    assert.equal(getAppChatRequestsPerHour(), 17);

    process.env.APP_CHAT_REQUESTS_PER_HOUR = "-1";
    assert.equal(getAppChatRequestsPerHour(), 0);

    process.env.APP_CHAT_REQUESTS_PER_HOUR = "not-a-number";
    assert.equal(getAppChatRequestsPerHour(), 0);
  } finally {
    if (originalLimit === undefined) {
      delete process.env.APP_CHAT_REQUESTS_PER_HOUR;
    } else {
      process.env.APP_CHAT_REQUESTS_PER_HOUR = originalLimit;
    }
  }
}

async function assertInactiveChatPostBlocked() {
  const { POST } = await import("../../app/api/chat/route");
  const beforeResult = await pool.query<{ message_count: string }>(
    "SELECT count(*) AS message_count FROM messages WHERE chat_id = $1",
    [knownInactiveChatId],
  );

  const response = await POST(
    new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "This message should be blocked.",
        sessionId: knownInactiveChatId,
      }),
    }),
  );

  const afterResult = await pool.query<{ message_count: string }>(
    "SELECT count(*) AS message_count FROM messages WHERE chat_id = $1",
    [knownInactiveChatId],
  );

  assert.equal(response.status, 403);
  assert.deepEqual(afterResult.rows, beforeResult.rows);
}

async function assertOverTokenLimitChatPostBlocked() {
  const { POST } = await import("../../app/api/chat/route");
  const { maxUserMessageTokens } = await import("../../lib/user-message-tokens");
  const beforeResult = await pool.query<{ message_count: string }>(
    "SELECT count(*) AS message_count FROM messages WHERE chat_id = $1",
    [knownActiveChatId],
  );

  const response = await POST(
    new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: Array.from(
          { length: maxUserMessageTokens + 1 },
          () => "hello",
        ).join(" "),
        sessionId: knownActiveChatId,
      }),
    }),
  );

  const afterResult = await pool.query<{ message_count: string }>(
    "SELECT count(*) AS message_count FROM messages WHERE chat_id = $1",
    [knownActiveChatId],
  );
  const body = (await response.json()) as {
    maxTokens?: unknown;
    tokenCount?: unknown;
  };

  assert.equal(response.status, 413);
  assert.equal(body.maxTokens, maxUserMessageTokens);
  assert.equal(typeof body.tokenCount, "number");
  assert.deepEqual(afterResult.rows, beforeResult.rows);
}

async function assertChatCountryFromLanguage() {
  const { getCountryNameFromLanguage } = await import(
    "../../app/api/chat/validations"
  );

  assert.equal(getCountryNameFromLanguage("en-US"), "United States");
  assert.equal(getCountryNameFromLanguage("en-GB"), "United Kingdom");
  assert.equal(getCountryNameFromLanguage("pt-BR"), "Brazil");
  assert.equal(getCountryNameFromLanguage("en"), null);
  assert.equal(getCountryNameFromLanguage("not a locale"), null);
}

async function assertMcpDeactivateChat({
  ensureChat,
  getChatIsActive,
  sessionId,
}: Pick<DatabaseHelpers, "ensureChat" | "getChatIsActive" | "sessionId">) {
  const { callMcpTool } = await import("../../lib/mcp-client");

  await ensureChat(sessionId);
  assert.equal(await getChatIsActive(sessionId), true);

  const result = await callMcpTool({
    name: "deactivate_chat",
    arguments: {
      conversationId: sessionId,
    },
  });

  assert.equal(result, "Chat deactivated.");
  assert.equal(await getChatIsActive(sessionId), false);
}

async function assertChatMessagesAndLeads({
  addChatTokenUsage,
  appendChatMessage,
  appendLimitedUserChatMessage,
  countChatMessages,
  deactivateChat,
  ensureChat,
  getChatIsActive,
  getChatContextLogs,
  getChatDetail,
  getChatRequestLimitStatus,
  getChatToolCalls,
  getChatMessages,
  getChatMessagesAfterCount,
  getChatSummary,
  listChatLeads,
  listChats,
  recordChatContextLog,
  recordChatToolCall,
  scoreChat,
  setChatNameIfEmpty,
  sessionId,
  upsertChatSummary,
  upsertChatLead,
}: DatabaseHelpers) {
  await ensureChat(sessionId);

  const defaultChatResult = await pool.query<{
    input_size: string;
    output_size: string;
    created_at: Date;
    is_active: boolean;
    updated_at: Date;
  }>(
    `
      SELECT input_size, output_size, created_at, is_active, updated_at
      FROM chats
      WHERE id = $1
    `,
    [sessionId],
  );

  assert.equal(defaultChatResult.rows[0]?.input_size, "0");
  assert.equal(defaultChatResult.rows[0]?.output_size, "0");
  assert.equal(defaultChatResult.rows[0]?.is_active, true);
  assert.equal(await getChatIsActive(sessionId), true);
  assert.ok(defaultChatResult.rows[0]?.created_at instanceof Date);
  assert.ok(defaultChatResult.rows[0]?.updated_at instanceof Date);

  assert.equal(await setChatNameIfEmpty(sessionId, "United States"), true);
  assert.equal(await setChatNameIfEmpty(sessionId, "United Kingdom"), false);

  const namedChatResult = await pool.query<{ chat_name: string | null }>(
    "SELECT chat_name FROM chats WHERE id = $1",
    [sessionId],
  );

  assert.equal(namedChatResult.rows[0]?.chat_name, "United States");

  await appendChatMessage(sessionId, "user", "I need a kitchen redesign.");
  await appendChatMessage(
    sessionId,
    "assistant",
    "May I take the best email for you?",
  );

  const messageResult = await pool.query<{ role: string; content: string }>(
    `
      SELECT role, content
      FROM messages
      WHERE chat_id = $1
      ORDER BY created_at, id
    `,
    [sessionId],
  );

  assert.deepEqual(messageResult.rows, [
    { role: "user", content: "I need a kitchen redesign." },
    {
      role: "assistant",
      content: "May I take the best email for you?",
    },
  ]);
  assert.deepEqual(await getChatMessages(sessionId), [
    { role: "user", content: "I need a kitchen redesign." },
    {
      role: "assistant",
      content: "May I take the best email for you?",
    },
  ]);
  assert.equal(await countChatMessages(sessionId), 2);
  assert.deepEqual(await getChatMessagesAfterCount(sessionId, 1), [
    {
      role: "assistant",
      content: "May I take the best email for you?",
    },
  ]);

  const unlimitedRequestLimit = await getChatRequestLimitStatus(0);
  assert.equal(unlimitedRequestLimit.limit, 0);
  assert.equal(unlimitedRequestLimit.remaining, null);

  const requestLimit = unlimitedRequestLimit.used + 1;
  const limitedAppend = await appendLimitedUserChatMessage(
    sessionId,
    "This message should consume the last available hourly request.",
    requestLimit,
  );

  assert.equal(limitedAppend.allowed, true);
  assert.equal(limitedAppend.status.limit, requestLimit);
  assert.equal(limitedAppend.status.remaining, 0);

  const blockedAppend = await appendLimitedUserChatMessage(
    sessionId,
    "This message should be blocked by the hourly request limit.",
    requestLimit,
  );

  assert.equal(blockedAppend.allowed, false);
  assert.equal(blockedAppend.status.limit, requestLimit);
  assert.equal(blockedAppend.status.remaining, 0);

  const firstSummary = await upsertChatSummary(
    sessionId,
    "Customer wants a kitchen redesign.",
    3,
  );

  assert.equal(firstSummary.summary, "Customer wants a kitchen redesign.");
  assert.equal(firstSummary.message_count, 3);
  assert.ok(firstSummary.created_at instanceof Date);
  assert.ok(firstSummary.updated_at instanceof Date);

  const secondSummary = await upsertChatSummary(
    sessionId,
    "Customer wants a kitchen redesign and shared contact details.",
    5,
  );

  assert.equal(
    secondSummary.summary,
    "Customer wants a kitchen redesign and shared contact details.",
  );
  assert.equal(secondSummary.message_count, 5);
  assert.equal(
    (await getChatSummary(sessionId))?.summary,
    "Customer wants a kitchen redesign and shared contact details.",
  );

  const activeChatResult = await pool.query<{ is_active: boolean }>(
    `
      SELECT is_active
      FROM chats
      WHERE id = $1
    `,
    [sessionId],
  );

  assert.equal(activeChatResult.rows[0]?.is_active, true);

  await deactivateChat(sessionId);
  await appendChatMessage(sessionId, "assistant", "This chat is now closed.");
  assert.equal(await getChatIsActive(sessionId), false);
  await pool.query("UPDATE chats SET is_active = true WHERE id = $1", [
    sessionId,
  ]);

  await recordChatToolCall(sessionId, {
    toolCallId: "call-1",
    name: "upsert_user_credentials",
    arguments: { email_address: "ada@example.com" },
    result: { ok: true },
  });
  await recordChatToolCall(sessionId, {
    toolCallId: "call-2",
    name: "deactivate_chat",
    arguments: {},
    result: { ok: true, active: false },
  });

  const toolCalls = await getChatToolCalls(sessionId);

  assert.deepEqual(
    toolCalls.map((toolCall) => ({
      tool_call_id: toolCall.tool_call_id,
      name: toolCall.name,
      arguments: toolCall.arguments,
      result: toolCall.result,
    })),
    [
      {
        tool_call_id: "call-1",
        name: "upsert_user_credentials",
        arguments: { email_address: "ada@example.com" },
        result: { ok: true },
      },
      {
        tool_call_id: "call-2",
        name: "deactivate_chat",
        arguments: {},
        result: { ok: true, active: false },
      },
    ],
  );

  await recordChatContextLog(sessionId, {
    purpose: "reply",
    model: "test-model",
    messages: [
      { role: "system", content: "system prompt" },
      { role: "user", content: "I need a kitchen redesign." },
    ],
    tools: [{ type: "function", function: { name: "capture_lead" } }],
    toolChoice: "auto",
    temperature: 0.7,
    maxCompletionTokens: 120,
  });
  await recordChatContextLog(sessionId, {
    purpose: "summary",
    model: "test-model",
    messages: [{ role: "user", content: "Summarize this conversation." }],
    temperature: 0.2,
    maxCompletionTokens: 256,
  });

  const contextLogs = await getChatContextLogs(sessionId);

  assert.deepEqual(
    contextLogs.map((log) => ({
      purpose: log.purpose,
      model: log.model,
      messages: log.messages,
      tools: log.tools,
      tool_choice: log.tool_choice,
      temperature: log.temperature,
      max_completion_tokens: log.max_completion_tokens,
    })),
    [
      {
        purpose: "summary",
        model: "test-model",
        messages: [{ role: "user", content: "Summarize this conversation." }],
        tools: null,
        tool_choice: null,
        temperature: "0.2",
        max_completion_tokens: 256,
      },
      {
        purpose: "reply",
        model: "test-model",
        messages: [
          { role: "system", content: "system prompt" },
          { role: "user", content: "I need a kitchen redesign." },
        ],
        tools: [{ type: "function", function: { name: "capture_lead" } }],
        tool_choice: "auto",
        temperature: "0.7",
        max_completion_tokens: 120,
      },
    ],
  );

  await addChatTokenUsage(sessionId, 12, 7);
  await addChatTokenUsage(sessionId, 3.8, 2.9);
  await addChatTokenUsage(sessionId, 0, 0);
  await addChatTokenUsage(sessionId, -4, -2);

  const usageResult = await pool.query<{
    input_size: string;
    output_size: string;
  }>(
    `
      SELECT input_size, output_size
      FROM chats
      WHERE id = $1
    `,
    [sessionId],
  );

  assert.equal(usageResult.rows[0]?.input_size, "15");
  assert.equal(usageResult.rows[0]?.output_size, "9");

  const leadData = {
    client_name: "Ada Lovelace",
    email_address: "ada@example.com",
    phone_number: "+44 20 7946 0958",
    company_or_studio: "Analytical Homes",
  };
  const expectedScore = scoreChat(leadData);

  await upsertChatLead(sessionId, leadData);
  await upsertChatLead(sessionId, leadData);

  const leadResult = await pool.query<{
    total: string;
    email_address: string;
    phone_number: string;
  }>(
    `
      SELECT
        count(*) AS total,
        max(email_address) AS email_address,
        max(phone_number) AS phone_number
      FROM chat_leads
      WHERE chat_id = $1
    `,
    [sessionId],
  );

  assert.equal(leadResult.rows[0]?.total, "1");
  assert.equal(leadResult.rows[0]?.email_address, "ada@example.com");
  assert.equal(leadResult.rows[0]?.phone_number, "+44 20 7946 0958");

  const chatResult = await pool.query<{ id: string; score: number }>(
    "SELECT id, score FROM chats WHERE id = $1",
    [sessionId],
  );

  assert.equal(chatResult.rows[0]?.id, sessionId);
  assert.equal(chatResult.rows[0]?.score, expectedScore);
  assert.equal(expectedScore, 100);

  const listedChat = (await listChats()).find((chat) => chat.id === sessionId);
  assert.equal(listedChat?.message_count, 4);

  const chatDetail = await getChatDetail(sessionId);
  assert.equal(chatDetail?.id, sessionId);
  assert.equal(chatDetail?.message_count, 4);
  assert.deepEqual(
    chatDetail?.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    [
      { role: "user", content: "I need a kitchen redesign." },
      {
        role: "assistant",
        content: "May I take the best email for you?",
      },
      {
        role: "user",
        content: "This message should consume the last available hourly request.",
      },
      { role: "assistant", content: "This chat is now closed." },
    ],
  );
  assert.deepEqual(
    chatDetail?.toolCalls.map((toolCall) => toolCall.name),
    ["upsert_user_credentials", "deactivate_chat"],
  );
  assert.deepEqual(
    chatDetail?.contextLogs.map((log) => log.purpose),
    ["summary", "reply"],
  );

  const listedLead = (await listChatLeads()).find(
    (lead) => lead.chat_id === sessionId,
  );
  assert.equal(listedLead?.email_address, "ada@example.com");

  await pool.query("DELETE FROM chats WHERE id = $1", [sessionId]);

  const cascadeResult = await pool.query<{
    message_count: string;
    lead_count: string;
    summary_count: string;
    tool_call_count: string;
    context_log_count: string;
  }>(
    `
      SELECT
        (SELECT count(*) FROM messages WHERE chat_id = $1) AS message_count,
        (SELECT count(*) FROM chat_leads WHERE chat_id = $1) AS lead_count,
        (SELECT count(*) FROM chat_summaries WHERE chat_id = $1) AS summary_count,
        (SELECT count(*) FROM chat_tool_calls WHERE chat_id = $1) AS tool_call_count,
        (SELECT count(*) FROM chat_context_logs WHERE chat_id = $1) AS context_log_count
    `,
    [sessionId],
  );

  assert.equal(cascadeResult.rows[0]?.message_count, "0");
  assert.equal(cascadeResult.rows[0]?.lead_count, "0");
  assert.equal(cascadeResult.rows[0]?.summary_count, "0");
  assert.equal(cascadeResult.rows[0]?.tool_call_count, "0");
  assert.equal(cascadeResult.rows[0]?.context_log_count, "0");
}

main().catch((err) => {
  console.error("Database integration test failed:", err);
  process.exit(1);
});
