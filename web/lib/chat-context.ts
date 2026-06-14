import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

type ChatContextMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatContextToolCall = {
  name: string;
  arguments: Record<string, unknown>;
  result: unknown;
  created_at?: Date | string;
};

export type ChatContextMetadata = {
  totalChatMessages: number;
  toolCalls: ChatContextToolCall[];
};

export function buildReplyMessages(
  systemPromptContent: string,
  chatHistory: ChatContextMessage[],
  chatSummary: string | null,
  latestUserMessage: string | null,
  metadata?: ChatContextMetadata,
): ChatCompletionMessageParam[] {
  const baseMessages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPromptContent },
  ];
  const metadataMessage = buildConversationMetadataMessage(metadata);

  if (metadataMessage) {
    baseMessages.push({ role: "system", content: metadataMessage });
  }

  if (chatSummary?.trim()) {
    const messages: ChatCompletionMessageParam[] = [
      ...baseMessages,
      {
        role: "system",
        content: `Conversation summary so far:\n${chatSummary.trim()}`,
      },
    ];

    if (latestUserMessage?.trim()) {
      messages.push({ role: "user", content: latestUserMessage.trim() });
    }

    return messages;
  }

  return [
    ...baseMessages,
    ...chatHistory.map((message): ChatCompletionMessageParam => {
      if (message.role === "assistant") {
        return { role: "assistant", content: message.content };
      }

      return { role: "user", content: message.content };
    }),
  ];
}

function buildConversationMetadataMessage(metadata?: ChatContextMetadata) {
  if (!metadata) {
    return null;
  }

  const totalChatMessages = Number.isFinite(metadata.totalChatMessages)
    ? Math.max(0, Math.trunc(metadata.totalChatMessages))
    : 0;
  const lines = [
    `Conversation metadata: total chat messages: ${totalChatMessages}.`,
  ];

  if (metadata.toolCalls.length === 0) {
    lines.push("Tool calls so far: none.");
  } else {
    lines.push(
      "Tool calls so far:",
      ...metadata.toolCalls.map((toolCall, index) => {
        const createdAt = formatToolCallDate(toolCall.created_at);

        return `${index + 1}. ${toolCall.name}${createdAt ? ` at ${createdAt}` : ""}; arguments: ${stringifyForContext(toolCall.arguments)}; result: ${stringifyForContext(toolCall.result)}`;
      }),
    );
  }

  return lines.join("\n");
}

function formatToolCallDate(value: Date | string | undefined) {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString();
}

function stringifyForContext(value: unknown) {
  const serialized = JSON.stringify(value);

  if (!serialized) {
    return "null";
  }

  return serialized.length > 600 ? `${serialized.slice(0, 597)}...` : serialized;
}

export function findLatestUserMessage(messages: ChatContextMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message?.role === "user") {
      return message.content;
    }
  }

  return null;
}

export function estimateInputTokens(messages: ChatCompletionMessageParam[]) {
  const contentLength = messages.reduce(
    (total, message) => total + getMessageContentText(message).length,
    0,
  );
  const messageOverhead = messages.length * 4;

  return Math.max(1, Math.ceil(contentLength / 4) + messageOverhead);
}

export function getChatContextSource(chatSummary: string | null) {
  return chatSummary?.trim() ? "Summary context" : "Full history";
}

function getMessageContentText(message: ChatCompletionMessageParam) {
  const { content } = message;

  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }

      if ("text" in part && typeof part.text === "string") {
        return part.text;
      }

      return "";
    })
    .join("");
}
