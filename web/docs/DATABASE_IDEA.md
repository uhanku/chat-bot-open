```mermaid
erDiagram
  CHATS ||--o{ MESSAGES : contains
  CHATS ||--o| CHAT_LEADS : has

  CHATS {
    uuid id PK
    text chat_name
    bigint input_size
    bigint output_size
    boolean is_active
    int score
    timestamptz created_at
    timestamptz updated_at
  }

  MESSAGES {
    uuid id PK
    uuid chat_id FK
    text role
    text content
    timestamptz created_at
  }

  CHAT_LEADS {
    uuid id PK
    uuid chat_id FK
    text client_name
    text email_address
    text phone_number
    text company_or_studio
    timestamptz created_at
    timestamptz updated_at
  }
```

Chat State:

- `input_size` is the cumulative provider-reported `usage.prompt_tokens` spent for the chat.
- `output_size` is the cumulative provider-reported `usage.completion_tokens` spent for the chat.
- Chat cost estimates use the current `API_MODEL` with `web/lib/pricing.ts`; cached input pricing is not used because cached token counts are not stored.
- `is_active` defaults to `true`. When `false`, the chat cannot accept new messages.
- `updated_at` changes when messages, token usage, or lead details update the chat.

Score Logic:

```JS
function scoreChat(data) {
    let score = 0;

    if (isValidEmail(data.email_address)) score += 40;
    if (data.client_name) score += 25;
    if (data.phone_number) score += 20;
    if (data.company_or_studio) score += 15;

    return Math.min(score, 100);
}
```
