import { ChatClient, type ChatUiMessage } from "./ChatClient";
import { getChatDetail } from "@/lib/database";

export const dynamic = "force-dynamic";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function toChatUiMessages(
  messages: NonNullable<Awaited<ReturnType<typeof getChatDetail>>>["messages"],
): ChatUiMessage[] {
  return messages.flatMap<ChatUiMessage>((message) => {
    if (message.role === "user") {
      return [{ role: "user", text: message.content } satisfies ChatUiMessage];
    }

    if (message.role === "assistant") {
      return [{ role: "bot", text: message.content } satisfies ChatUiMessage];
    }

    return [];
  });
}

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sessionId = getSingleSearchParam((await searchParams).sessionId);
  const chat =
    typeof sessionId === "string" && uuidPattern.test(sessionId)
      ? await getChatDetail(sessionId)
      : null;

  return (
    <ChatClient
      key={chat?.id ?? "new-chat"}
      initialIsActive={chat?.is_active ?? true}
      initialMessages={chat ? toChatUiMessages(chat.messages) : undefined}
      initialSessionId={chat?.id}
    />
  );
}
