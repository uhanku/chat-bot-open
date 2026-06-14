CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS chat_context_logs, chat_tool_calls, chat_summaries, chat_leads, messages, chats CASCADE;

CREATE TABLE IF NOT EXISTS chats (
  id uuid PRIMARY KEY,
  chat_name text,
  input_size bigint NOT NULL DEFAULT 0,
  output_size bigint NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  score integer NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL UNIQUE REFERENCES chats(id) ON DELETE CASCADE,
  summary text NOT NULL,
  message_count integer NOT NULL CHECK (message_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL UNIQUE REFERENCES chats(id) ON DELETE CASCADE,
  client_name text,
  email_address text,
  phone_number text,
  company_or_studio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_tool_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  tool_call_id text NOT NULL,
  name text NOT NULL,
  arguments jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

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
);

CREATE INDEX IF NOT EXISTS messages_chat_id_created_at_idx
  ON messages(chat_id, created_at);

CREATE INDEX IF NOT EXISTS chat_summaries_chat_id_idx
  ON chat_summaries(chat_id);

CREATE INDEX IF NOT EXISTS chat_leads_chat_id_idx
  ON chat_leads(chat_id);

CREATE INDEX IF NOT EXISTS chat_tool_calls_chat_id_created_at_idx
  ON chat_tool_calls(chat_id, created_at);

CREATE INDEX IF NOT EXISTS chat_context_logs_chat_id_created_at_idx
  ON chat_context_logs(chat_id, created_at);

CREATE INDEX IF NOT EXISTS chats_created_at_idx
  ON chats(created_at);

CREATE INDEX IF NOT EXISTS chats_updated_at_idx
  ON chats(updated_at);
