<p align="center">
  <img src="assets/icon.png" alt="GPT Runner icon" width="160" />
</p>

<p align="center"><strong>CHAT BOT OPEN</strong></p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=000000" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Mermaid-FF3670?logo=mermaid&logoColor=white" alt="Mermaid" />
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/OpenAI-412991?logo=openai&logoColor=white" alt="OpenAI" />
  <img src="https://img.shields.io/badge/Google_GenAI-4285F4?logo=google&logoColor=white" alt="Google GenAI" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
</p>

Chat Bot Open is a chat assistant app for handling visitor conversations, capturing leads, and keeping longer threads organized with summaries and request limits. The repository includes the web app, the chat flow documentation, database setup, and supporting integration tests.

## Startup

### Docker Compose

Use Docker Compose for the full application stack, including Postgres:

```bash
cp .env.example .env
cp web/.env.example web/.env
```

Set `API_KEY` in `web/.env`, then start the app:

```bash
docker compose up --build
```

Open the app at http://localhost:3000.

### Local development

Start the database:

```bash
cp .env.example .env
docker compose up chat-db
```

In another terminal, install dependencies and run the web app:

```bash
cd web
cp .env.example .env
npm ci
npm run dev
```

Open the app at http://localhost:3000.

### Demo auth

The default demo login is:

- Username: `demo`
- Password: `demo`

Chat responses require `API_KEY` and `API_MODEL` in `web/.env`.

## MAIN APP IDEA

See the flowchart in [docs/chat-flow.md](docs/chat-flow.md).
