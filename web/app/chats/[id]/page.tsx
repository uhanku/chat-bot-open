import { readFile } from "node:fs/promises";
import { join } from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChatSummaryModal } from "./ChatSummaryModal";
import {
  buildReplyMessages,
  estimateInputTokens,
  findLatestUserMessage,
  getChatContextSource,
} from "@/lib/chat-context";
import { getChatDetail } from "@/lib/database";
import { calculateOpenAIChatPrice, isOpenAIModel } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const systemPromptPath = join(process.cwd(), "docs", "SYSTEM_C2.md");

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function empty(value: string | null) {
  return value?.trim() || "None";
}

function formatCost(inputSize: string, outputSize: string) {
  const model = process.env.API_MODEL;

  if (!isOpenAIModel(model)) {
    return "Unavailable";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  }).format(
    calculateOpenAIChatPrice(model, Number(inputSize), Number(outputSize)),
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export default async function ChatDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!uuidPattern.test(id)) {
    notFound();
  }

  const chat = await getChatDetail(id);

  if (!chat) {
    notFound();
  }

  const chatHistory = chat.messages.flatMap((message) =>
    message.role === "user" || message.role === "assistant"
      ? [{ role: message.role, content: message.content }]
      : [],
  );
  const latestUserMessage = findLatestUserMessage(chatHistory);
  const currentInputMessages = buildReplyMessages(
    await readFile(systemPromptPath, "utf8"),
    chatHistory,
    chat.summary?.summary ?? null,
    latestUserMessage,
    {
      totalChatMessages: chat.message_count,
      toolCalls: chat.toolCalls,
    },
  );
  const currentInputTokens = estimateInputTokens(currentInputMessages);
  const contextSource = getChatContextSource(chat.summary?.summary ?? null);
  const summaryModalData = chat.summary
    ? {
        text: chat.summary.summary,
        messageCount: chat.summary.message_count,
        updatedAt: formatDate(chat.summary.updated_at),
      }
    : null;

  return (
    <main className="flex-1 bg-[#f7f5f0] px-6 py-8 font-sans text-[#1f1b16]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#d8d0c2] pb-5">
          <div>
            <Link
              className="text-sm font-semibold text-[#6b4a12] underline underline-offset-2"
              href="/chats"
            >
              Back to chats
            </Link>
            <h1 className="mt-3 text-3xl font-semibold">
              {empty(chat.chat_name)}
            </h1>
            <p className="mt-1 break-all font-mono text-sm text-[#746957]">
              {chat.id}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="rounded-sm border border-[#9a7a3a] px-4 py-2 text-sm font-semibold text-[#4d3714]"
              href={`/logs/${chat.id}`}
            >
              View logs
            </Link>
            <Link
              className="rounded-sm border border-[#9a7a3a] px-4 py-2 text-sm font-semibold text-[#4d3714]"
              href="/chat-leads"
            >
              View chat leads
            </Link>
            <form action="/api/auth/logout" method="post">
              <button
                className="cursor-pointer rounded-sm border border-[#9a7a3a] bg-[#1f1b16] px-4 py-2 text-sm font-semibold text-white"
                type="submit"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>

        <section className="grid gap-3 border border-[#d8d0c2] bg-white p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-xs uppercase tracking-[0.08em] text-[#746957]">
              Status
            </div>
            <div className="mt-1 font-semibold">
              {chat.is_active ? "Active" : "Inactive"}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.08em] text-[#746957]">
              Score
            </div>
            <div className="mt-1 font-semibold">{chat.score}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.08em] text-[#746957]">
              Messages
            </div>
            <div className="mt-1 font-semibold">{chat.message_count}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.08em] text-[#746957]">
              Estimated cost
            </div>
            <div className="mt-1 font-semibold">
              {formatCost(chat.input_size, chat.output_size)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.08em] text-[#746957]">
              Client
            </div>
            <div className="mt-1 font-semibold">{empty(chat.client_name)}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.08em] text-[#746957]">
              Email
            </div>
            <div className="mt-1 break-words font-semibold">
              {empty(chat.email_address)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.08em] text-[#746957]">
              Phone
            </div>
            <div className="mt-1 font-semibold">{empty(chat.phone_number)}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.08em] text-[#746957]">
              Company
            </div>
            <div className="mt-1 font-semibold">
              {empty(chat.company_or_studio)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.08em] text-[#746957]">
              Updated
            </div>
            <div className="mt-1 font-semibold">
              {formatDate(chat.updated_at)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.08em] text-[#746957]">
              Created
            </div>
            <div className="mt-1 font-semibold">
              {formatDate(chat.created_at)}
            </div>
          </div>
        </section>

        <section className="border border-[#d8d0c2] bg-white p-4 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#ebe4d8] pb-3">
            <h2 className="text-xl font-semibold">AI Details</h2>
            <ChatSummaryModal summary={summaryModalData} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-xs uppercase tracking-[0.08em] text-[#746957]">
                Current input tokens
              </div>
              <div className="mt-1 font-semibold">
                {formatNumber(currentInputTokens)}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.08em] text-[#746957]">
                Current context
              </div>
              <div className="mt-1 font-semibold">{contextSource}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.08em] text-[#746957]">
                Input tokens
              </div>
              <div className="mt-1 font-semibold">{chat.input_size}</div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-[0.08em] text-[#746957]">
                Output tokens
              </div>
              <div className="mt-1 font-semibold">{chat.output_size}</div>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex justify-end">
            {chat.is_active ? (
              <Link
                className="rounded-sm border border-[#9a7a3a] bg-[#f6edda] px-4 py-2 text-sm font-semibold text-[#4d3714]"
                href={{
                  pathname: "/",
                  query: { sessionId: chat.id },
                }}
              >
                Continue conversation
              </Link>
            ) : (
              <span className="rounded-sm border border-[#d8d0c2] bg-[#ece7dc] px-4 py-2 text-sm font-semibold text-[#746957]">
                Conversation inactive
              </span>
            )}
          </div>
          <h2 className="text-xl font-semibold">Messages</h2>
          {chat.messages.map((message) => (
            <article
              className="border border-[#d8d0c2] bg-white p-4"
              key={message.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ebe4d8] pb-2">
                <span className="rounded-sm border border-[#d8d0c2] px-2 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#5d5446]">
                  {message.role}
                </span>
                <time className="text-xs text-[#746957]">
                  {formatDate(message.created_at)}
                </time>
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">
                {message.content}
              </p>
            </article>
          ))}

          {chat.messages.length === 0 ? (
            <div className="border border-[#d8d0c2] bg-white p-8 text-center text-[#746957]">
              No messages found.
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
