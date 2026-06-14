CREATE TABLE IF NOT EXISTS chat_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL UNIQUE REFERENCES chats(id) ON DELETE CASCADE,
  summary text NOT NULL,
  message_count integer NOT NULL CHECK (message_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_summaries_chat_id_idx
  ON chat_summaries(chat_id);
