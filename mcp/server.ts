import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Pool, type PoolConfig } from "pg";
import { z } from "zod";

const server = new McpServer({
  name: "chat-lead-handler",
  version: "1.0.0",
});

const leadDataSchema = z.object({
  conversationId: z.string().uuid(),
  client_name: z.string().trim().min(1).optional(),
  email_address: z.string().trim().min(1).optional(),
  phone_number: z.string().trim().min(1).optional(),
  company_or_studio: z.string().trim().min(1).optional(),
});
const deactivateChatSchema = z.object({
  conversationId: z.string().uuid(),
});

type LeadData = z.infer<typeof leadDataSchema>;

let pool: Pool | undefined;

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

function getPool() {
  pool ??= new Pool(getDatabaseConfig());

  return pool;
}

async function ensureChat(conversationId: string) {
  await getPool().query(
    `
      INSERT INTO chats (id, is_active)
      VALUES ($1, true)
      ON CONFLICT (id) DO NOTHING
    `,
    [conversationId],
  );
}

function scoreChat(data: LeadData) {
  let score = 0;

  if (isValidEmail(data.email_address)) score += 40;
  if (data.client_name) score += 25;
  if (data.phone_number) score += 20;
  if (data.company_or_studio) score += 15;

  return Math.min(score, 100);
}

async function upsertChatLead(data: LeadData) {
  await ensureChat(data.conversationId);

  const result = await getPool().query<LeadData>(
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
      data.conversationId,
      data.client_name ?? null,
      data.email_address ?? null,
      data.phone_number ?? null,
      data.company_or_studio ?? null,
    ],
  );

  await getPool().query(
    `
      UPDATE chats
      SET
        score = $2,
        updated_at = now()
      WHERE id = $1
    `,
    [
      data.conversationId,
      scoreChat({
        ...result.rows[0],
        conversationId: data.conversationId,
      }),
    ],
  );
}

async function deactivateChat(conversationId: string) {
  await ensureChat(conversationId);

  await getPool().query(
    `
      UPDATE chats
      SET
        is_active = false,
        updated_at = now()
      WHERE id = $1
    `,
    [conversationId],
  );
}

server.registerTool(
  "upsert_user_credentials",
  {
    title: "Upsert user credentials",
    description:
      "Create or update a prospective client's intake details as new information is discovered.",
    inputSchema: {
      conversationId: leadDataSchema.shape.conversationId,
      client_name: leadDataSchema.shape.client_name,
      email_address: leadDataSchema.shape.email_address,
      phone_number: leadDataSchema.shape.phone_number,
      company_or_studio: leadDataSchema.shape.company_or_studio,
    },
  },
  async (input) => {
    console.error("input:", input);

    const data = leadDataSchema.parse(input);
    await upsertChatLead(data);

    return {
      content: [{ type: "text", text: "User credentials updated." }],
    };
  },
);

server.registerTool(
  "deactivate_chat",
  {
    title: "Deactivate chat",
    description:
      "Disable a conversation that clearly has no relevant luxury interiors intent after a natural redirect attempt.",
    inputSchema: {
      conversationId: deactivateChatSchema.shape.conversationId,
    },
  },
  async (input) => {
    const data = deactivateChatSchema.parse(input);
    await deactivateChat(data.conversationId);

    return {
      content: [{ type: "text", text: "Chat deactivated." }],
    };
  },
);

function isValidEmail(value: string | null | undefined) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const transport = new StdioServerTransport();
await server.connect(transport);
