INSERT INTO chats (id, is_active)
VALUES
  ('a71e5c41-bb78-4926-a6ce-a7ece98fc379', false),
  ('35f7af80-8ed3-4c3c-8af0-d103674842a1', true)
ON CONFLICT (id) DO UPDATE
SET
  is_active = EXCLUDED.is_active,
  updated_at = now();
