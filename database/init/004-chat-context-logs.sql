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

CREATE INDEX IF NOT EXISTS chat_context_logs_chat_id_created_at_idx
  ON chat_context_logs(chat_id, created_at);
