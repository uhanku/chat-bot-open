import Link from "next/link";
import { notFound } from "next/navigation";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { estimateInputTokens } from "@/lib/chat-context";
import { getChatDetail } from "@/lib/database";

export const dynamic = "force-dynamic";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function empty(value: string | null) {
  return value?.trim() || "None";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function getContextMessageCount(messages: unknown) {
  return Array.isArray(messages) ? messages.length : 0;
}

function estimateLoggedContextTokens(messages: unknown) {
  return Array.isArray(messages)
    ? estimateInputTokens(messages as ChatCompletionMessageParam[])
    : 0;
}

export default async function LogsPage({
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

  return (
    <main className="flex-1 bg-[#f7f5f0] px-6 py-8 font-sans text-[#1f1b16]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#d8d0c2] pb-5">
          <div>
            <Link
              className="text-sm font-semibold text-[#6b4a12] underline underline-offset-2"
              href={`/chats/${chat.id}`}
            >
              Back to chat
            </Link>
            <p className="mt-3 text-sm font-medium uppercase tracking-[0.12em] text-[#746957]">
              Logs
            </p>
            <h1 className="mt-1 text-3xl font-semibold">
              {empty(chat.chat_name)}
            </h1>
            <p className="mt-1 break-all font-mono text-sm text-[#746957]">
              {chat.id}
            </p>
          </div>
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[#746957]">
            Recent {chat.contextLogs.length}
          </div>
        </header>

        <section className="border border-[#d8d0c2] bg-white p-4 text-sm">
          {chat.contextLogs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#ebe4d8] text-xs uppercase tracking-[0.08em] text-[#746957]">
                    <th className="py-2 pr-3 font-semibold">Created</th>
                    <th className="py-2 pr-3 font-semibold">Purpose</th>
                    <th className="py-2 pr-3 font-semibold">Model</th>
                    <th className="py-2 pr-3 font-semibold">Messages</th>
                    <th className="py-2 pr-3 font-semibold">Est. tokens</th>
                    <th className="py-2 font-semibold">Context</th>
                  </tr>
                </thead>
                <tbody>
                  {chat.contextLogs.map((log) => (
                    <tr
                      className="align-top border-b border-[#f0eadf] last:border-b-0"
                      key={log.id}
                    >
                      <td className="py-3 pr-3 whitespace-nowrap text-[#5d5446]">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="py-3 pr-3">
                        <span className="rounded-sm border border-[#d8d0c2] px-2 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#5d5446]">
                          {log.purpose.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3 pr-3 font-mono text-xs">
                        {log.model}
                      </td>
                      <td className="py-3 pr-3">
                        {formatNumber(getContextMessageCount(log.messages))}
                      </td>
                      <td className="py-3 pr-3">
                        {formatNumber(
                          estimateLoggedContextTokens(log.messages),
                        )}
                      </td>
                      <td className="py-3">
                        <details>
                          <summary className="cursor-pointer text-sm font-semibold text-[#6b4a12]">
                            View payload
                          </summary>
                          <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words border border-[#ebe4d8] bg-[#fbfaf7] p-3 font-mono text-xs leading-5 text-[#2d2923]">
                            {formatJson({
                              messages: log.messages,
                              tools: log.tools,
                              tool_choice: log.tool_choice,
                              temperature: log.temperature,
                              max_completion_tokens: log.max_completion_tokens,
                            })}
                          </pre>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="border border-[#ebe4d8] bg-[#fbfaf7] p-6 text-center text-[#746957]">
              No LLM context logs found.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
