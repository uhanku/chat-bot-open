import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FunctionDeclaration } from "@google/genai";
import OpenAI from "openai";
import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { buildReplyMessages } from "@/lib/chat-context";
import {
  addChatTokenUsage,
  countChatMessages,
  getChatMessagesAfterCount,
  getChatMessages,
  getChatSummary,
  getChatToolCalls,
  recordChatContextLog,
  recordChatToolCall,
  upsertChatSummary,
} from "@/lib/database";
import { callMcpTool } from "@/lib/mcp-client";

const maxCompletionTokens = 120;
const maxSummaryTokens = 256;
const maxToolCallRounds = 4;
export const summaryMessageThreshold = 16;
const temperature = 0.7;
export const terminalLeadCaptureReply =
  "Thank you, I have your details. Our team will follow up with a more tailored selection shortly.";

const systemPromptPath = join(process.cwd(), "docs", "SYSTEM_C2.md");
const systemPrompt = readFile(systemPromptPath, "utf8");

export const upsertUserCredentialsFunction: FunctionDeclaration = {
  name: "upsert_user_credentials",
  description:
    "Create or update a prospective client's intake details as new information is discovered.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      client_name: { type: "string" },
      email_address: { type: "string" },
      phone_number: { type: "string" },
      company_or_studio: { type: "string" },
    },
    required: [],
    additionalProperties: false,
  },
};

export const deactivateChatFunction: FunctionDeclaration = {
  name: "deactivate_chat",
  description:
    "Disable the current chat when the user sends or submits their email address, after thanking the client naturally. Also disable the chat when the conversation reaches 10 total messages. Also disable when the client clearly shows no relevant luxury interiors intent after one natural redirect attempt.",
  parametersJsonSchema: {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false,
  },
};

const chatTools = [
  toChatCompletionTool(upsertUserCredentialsFunction),
  toChatCompletionTool(deactivateChatFunction),
];

type ChatCompletionClient = {
  create: (
    params: ChatCompletionCreateParamsNonStreaming,
  ) => Promise<ChatCompletion>;
};

export async function handleChatResponse(
  sessionId: string,
  latestUserMessage: string,
): Promise<string> {
  const { completions, model } = getChatCompletionConfig();

  await ensureChatSummaryForResponse(sessionId, completions, model);

  const chatHistory = await getChatMessages(sessionId);
  const chatSummary = await getChatSummary(sessionId);
  const totalChatMessages = await countChatMessages(sessionId);
  const toolCallsSoFar = await getChatToolCalls(sessionId);
  const messages = buildReplyMessages(
    await systemPrompt,
    chatHistory,
    chatSummary?.summary ?? null,
    latestUserMessage,
    {
      totalChatMessages,
      toolCalls: toolCallsSoFar,
    },
  );

  const firstResponseParams: ChatCompletionCreateParamsNonStreaming = {
    model,
    messages,
    temperature,
    max_completion_tokens: maxCompletionTokens,
    tools: chatTools,
    tool_choice: "auto",
  };
  await recordCompletionContext(sessionId, "reply", firstResponseParams);

  const firstResponse = await completions.create(firstResponseParams);
  await recordCompletionUsage(sessionId, firstResponse);

  let currentMessage = firstResponse.choices[0]?.message;
  let firstReply = currentMessage?.content?.trim() ?? "";

  for (
    let toolCallRound = 0;
    toolCallRound < maxToolCallRounds;
    toolCallRound += 1
  ) {
    const toolCalls = normalizeToolCalls(currentMessage?.tool_calls);

    if (!toolCalls.length) {
      const reply = currentMessage?.content?.trim();

      if (!reply) {
        throw new Error("OpenAI returned an empty reply.");
      }

      return reply;
    }

    const didDeactivateChat = toolCalls.some(
      (toolCall) => toolCall.function.name === "deactivate_chat",
    );

    messages.push({
      role: "assistant",
      content: currentMessage?.content ?? null,
      tool_calls: toolCalls,
    });

    messages.push(...(await executeAndRecordToolCalls(sessionId, toolCalls)));

    if (didDeactivateChat) {
      const reply = resolveToolFollowupReply({
        didDeactivateChat,
        firstReply,
        followupReply: currentMessage?.content ?? "",
      });

      if (!reply) {
        throw new Error("OpenAI returned an empty terminal tool reply.");
      }

      return reply;
    }

    const finalResponseParams: ChatCompletionCreateParamsNonStreaming = {
      model,
      messages,
      temperature,
      max_completion_tokens: maxCompletionTokens,
      tools: chatTools,
      tool_choice: "auto",
    };
    await recordCompletionContext(
      sessionId,
      "tool_followup",
      finalResponseParams,
    );

    const finalResponse = await completions.create(finalResponseParams);
    await recordCompletionUsage(sessionId, finalResponse);
    currentMessage = finalResponse.choices[0]?.message;

    if (!firstReply) {
      firstReply = currentMessage?.content?.trim() ?? "";
    }
  }

  throw new Error(
    `OpenAI exceeded the ${maxToolCallRounds} tool-call round limit before returning a reply.`,
  );
}

export function resolveToolFollowupReply({
  didDeactivateChat,
  firstReply,
  followupReply,
}: {
  didDeactivateChat: boolean;
  firstReply: string | null | undefined;
  followupReply: string | null | undefined;
}) {
  const trimmedFirstReply = firstReply?.trim();
  const trimmedFollowupReply = followupReply?.trim();

  if (didDeactivateChat) {
    return trimmedFirstReply || trimmedFollowupReply || terminalLeadCaptureReply;
  }

  return trimmedFollowupReply || null;
}

export async function refreshChatSummary(sessionId: string) {
  const { completions, model } = getChatCompletionConfig();

  await ensureChatSummaryForResponse(sessionId, completions, model);
}

function getChatCompletionConfig() {
  const apiKey = process.env.API_KEY;
  const model = process.env.API_MODEL;

  if (!apiKey) {
    throw new Error("API_KEY is missing");
  }

  if (!model?.trim()) {
    throw new Error("API_MODEL is missing");
  }

  const openai = new OpenAI({
    apiKey,
  });

  return {
    completions: openai.chat.completions,
    model,
  };
}

export async function ensureChatSummaryForResponse(
  sessionId: string,
  completions: ChatCompletionClient,
  model: string,
) {
  const messageCount = await countChatMessages(sessionId);

  if (messageCount < summaryMessageThreshold) {
    return getChatSummary(sessionId);
  }

  const existingSummary = await getChatSummary(sessionId);
  const messagesToSummarize = existingSummary
    ? await getChatMessagesAfterCount(sessionId, existingSummary.message_count)
    : await getChatMessages(sessionId);

  if (existingSummary && messagesToSummarize.length === 0) {
    return existingSummary;
  }

  const summary = await summarizeChat({
    completions,
    existingSummary: existingSummary?.summary ?? null,
    messagesToSummarize,
    model,
    sessionId,
  });

  return upsertChatSummary(sessionId, summary, messageCount);
}

async function summarizeChat({
  completions,
  existingSummary,
  messagesToSummarize,
  model,
  sessionId,
}: {
  completions: ChatCompletionClient;
  existingSummary: string | null;
  messagesToSummarize: Array<{ role: "user" | "assistant"; content: string }>;
  model: string;
  sessionId: string;
}) {
  const summaryParams: ChatCompletionCreateParamsNonStreaming = {
    model,
    messages: [
      {
        role: "system",
        content:
          "Create a concise rolling summary of this sales chat for future assistant replies. Preserve the customer's goals, constraints, preferences, contact details, unresolved questions, and any commitments made by the assistant. Do not invent details.",
      },
      {
        role: "user",
        content: buildSummaryInput(existingSummary, messagesToSummarize),
      },
    ],
    temperature: 0.2,
    max_completion_tokens: maxSummaryTokens,
  };
  await recordCompletionContext(sessionId, "summary", summaryParams);

  const summaryResponse = await completions.create(summaryParams);
  await recordCompletionUsage(sessionId, summaryResponse);

  const summary = summaryResponse.choices[0]?.message.content?.trim();

  if (!summary) {
    throw new Error("OpenAI returned an empty chat summary.");
  }

  return summary;
}

function buildSummaryInput(
  existingSummary: string | null,
  messagesToSummarize: Array<{ role: "user" | "assistant"; content: string }>,
) {
  const transcript = messagesToSummarize
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n\n");

  if (!existingSummary?.trim()) {
    return `Summarize this conversation:\n\n${transcript}`;
  }

  return `Update the existing summary with the new conversation messages.\n\nExisting summary:\n${existingSummary.trim()}\n\nNew messages:\n${transcript}`;
}

async function recordCompletionUsage(
  sessionId: string,
  response: ChatCompletion,
) {
  await addChatTokenUsage(
    sessionId,
    response.usage?.prompt_tokens ?? 0,
    response.usage?.completion_tokens ?? 0,
  );
}

async function recordCompletionContext(
  sessionId: string,
  purpose: "reply" | "tool_followup" | "summary",
  params: ChatCompletionCreateParamsNonStreaming,
) {
  await recordChatContextLog(sessionId, {
    purpose,
    model: params.model,
    messages: params.messages,
    tools: params.tools,
    toolChoice: params.tool_choice,
    temperature:
      typeof params.temperature === "number" ? params.temperature : null,
    maxCompletionTokens:
      typeof params.max_completion_tokens === "number"
        ? params.max_completion_tokens
        : null,
  });
}

function normalizeToolCalls(toolCalls: ChatCompletionMessageToolCall[] = []) {
  return toolCalls.filter(
    (
      toolCall,
    ): toolCall is ChatCompletionMessageToolCall & { type: "function" } =>
      toolCall.type === "function",
  );
}

async function executeAndRecordToolCalls(
  sessionId: string,
  toolCalls: Array<ChatCompletionMessageToolCall & { type: "function" }>,
) {
  return Promise.all(
    toolCalls.map(async (toolCall): Promise<ChatCompletionMessageParam> => {
      const { result, toolArguments } = await executeToolCall(
        sessionId,
        toolCall,
      );

      await recordChatToolCall(sessionId, {
        toolCallId: toolCall.id,
        name: toolCall.function.name,
        arguments: toolArguments,
        result,
      });

      return {
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      };
    }),
  );
}

async function executeToolCall(
  sessionId: string,
  toolCall: ChatCompletionMessageToolCall & { type: "function" },
) {
  if (
    toolCall.function.name !== "upsert_user_credentials" &&
    toolCall.function.name !== "deactivate_chat"
  ) {
    throw new Error(`Unsupported tool: ${toolCall.function.name}`);
  }

  const toolArguments = parseToolArguments(toolCall.function.arguments);

  const result = await callMcpTool({
    name: toolCall.function.name,
    arguments: {
      ...toolArguments,
      conversationId: sessionId,
    },
  });

  return { result, toolArguments };
}

function parseToolArguments(rawArguments: string) {
  if (!rawArguments.trim()) {
    return {};
  }

  const parsedArguments: unknown = JSON.parse(rawArguments);

  if (
    typeof parsedArguments !== "object" ||
    parsedArguments === null ||
    Array.isArray(parsedArguments)
  ) {
    throw new Error("Tool arguments must be an object.");
  }

  return parsedArguments as Record<string, unknown>;
}

function toChatCompletionTool(
  functionDeclaration: FunctionDeclaration,
): ChatCompletionTool {
  if (!functionDeclaration.name) {
    throw new Error("Function declaration must include a name.");
  }

  if (!functionDeclaration.parametersJsonSchema) {
    throw new Error("Function declaration must include parametersJsonSchema.");
  }

  return {
    type: "function",
    function: {
      name: functionDeclaration.name,
      description: functionDeclaration.description,
      parameters: functionDeclaration.parametersJsonSchema as Record<
        string,
        unknown
      >,
    },
  };
}
