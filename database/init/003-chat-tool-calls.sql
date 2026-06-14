CREATE TABLE IF NOT EXISTS chat_tool_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  tool_call_id text NOT NULL,
  name text NOT NULL,
  arguments jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_tool_calls_chat_id_created_at_idx
  ON chat_tool_calls(chat_id, created_at);
