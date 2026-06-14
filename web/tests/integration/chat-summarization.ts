import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
} from "openai/resources/chat/completions";
import { getRequiredEnv } from "./env";
import {
  ensureChatSummaryForResponse,
  resolveToolFollowupReply,
  terminalLeadCaptureReply,
} from "@/app/api/chat/chat";
import {
  buildReplyMessages,
  estimateInputTokens,
  findLatestUserMessage,
  getChatContextSource,
} from "@/lib/chat-context";

const databaseUrl = getRequiredEnv("DATABASE_URL");

process.env.DATABASE_URL = databaseUrl;

type FixtureMessage = {
  role: "user" | "assistant";
  timestamp: string;
  message: string;
};

async function main() {
  const sessionId = randomUUID();
  const calls: ChatCompletionCreateParamsNonStreaming[] = [];
  const completions = {
    create: async (params: ChatCompletionCreateParamsNonStreaming) => {
      calls.push(params);

      return completion(`summary-${calls.length}`);
    },
  };
  const {
    appendChatMessage,
    getChatContextLogs,
    getChatMessages,
    getChatSummary,
    getChatToolCalls,
    getPool,
    recordChatToolCall,
  } = await import("../../lib/database");
  const conversation = await loadConversation();

  try {
    assert.equal(
      resolveToolFollowupReply({
        didDeactivateChat: true,
        firstReply: "Thank you, I have your email.",
        followupReply: "",
      }),
      "Thank you, I have your email.",
    );
    assert.equal(
      resolveToolFollowupReply({
        didDeactivateChat: true,
        firstReply: "",
        followupReply: "",
      }),
      terminalLeadCaptureReply,
    );
    assert.equal(
      resolveToolFollowupReply({
        didDeactivateChat: false,
        firstReply: "Thanks.",
        followupReply: "",
      }),
      null,
    );

    for (const message of conversation.slice(0, 15)) {
      await appendChatMessage(sessionId, message.role, message.message);
    }

    assert.equal(
      await ensureChatSummaryForResponse(sessionId, completions, "test-model"),
      null,
    );
    assert.equal(calls.length, 0);
    assert.deepEqual(await getChatContextLogs(sessionId), []);

    await appendChatMessage(
      sessionId,
      conversation[15].role,
      conversation[15].message,
    );

    const initialSummary = await ensureChatSummaryForResponse(
      sessionId,
      completions,
      "test-model",
    );

    assert.equal(initialSummary?.summary, "summary-1");
    assert.equal(initialSummary?.message_count, 16);
    assert.equal(calls.length, 1);
    assertSummaryInputIncludes(calls[0], conversation[0].message);
    assertSummaryInputIncludes(calls[0], conversation[15].message);
    assert.equal((await getChatContextLogs(sessionId)).length, 1);

    await appendChatMessage(
      sessionId,
      conversation[16].role,
      conversation[16].message,
    );

    const updatedSummary = await ensureChatSummaryForResponse(
      sessionId,
      completions,
      "test-model",
    );

    assert.equal(updatedSummary?.summary, "summary-2");
    assert.equal(updatedSummary?.message_count, 17);
    assert.equal(calls.length, 2);
    assertSummaryInputIncludes(calls[1], "Existing summary:\nsummary-1");
    assertSummaryInputIncludes(calls[1], conversation[16].message);
    assertSummaryInputExcludes(calls[1], conversation[0].message);
    const contextLogs = await getChatContextLogs(sessionId);

    assert.deepEqual(
      contextLogs.map((log) => ({
        purpose: log.purpose,
        model: log.model,
        temperature: log.temperature,
        max_completion_tokens: log.max_completion_tokens,
      })),
      [
        {
          purpose: "summary",
          model: "test-model",
          temperature: "0.2",
          max_completion_tokens: 256,
        },
        {
          purpose: "summary",
          model: "test-model",
          temperature: "0.2",
          max_completion_tokens: 256,
        },
      ],
    );
    assertSummaryInputIncludes(
      {
        ...calls[1],
        messages: contextLogs[0].messages as typeof calls[number]["messages"],
      },
      conversation[16].message,
    );

    await recordChatToolCall(sessionId, {
      toolCallId: "call-1",
      name: "upsert_user_credentials",
      arguments: { email_address: "ada@example.com" },
      result: { ok: true },
    });

    const replyMessages = buildReplyMessages(
      "system prompt",
      await getChatMessages(sessionId),
      (await getChatSummary(sessionId))?.summary ?? null,
      conversation[16].message,
      {
        totalChatMessages: 17,
        toolCalls: await getChatToolCalls(sessionId),
      },
    );

    assert.deepEqual(
      replyMessages.map((message) => message.role),
      ["system", "system", "system", "user"],
    );
    assert.match(
      String(replyMessages[1]?.content),
      /^Conversation metadata: total chat messages: 17\.\nTool calls so far:\n1\. upsert_user_credentials at .+; arguments: {"email_address":"ada@example.com"}; result: {"ok":true}$/,
    );
    assert.equal(replyMessages[2]?.content, "Conversation summary so far:\nsummary-2");
    assert.equal(replyMessages[3]?.content, conversation[16].message);
    assert.ok(
      !JSON.stringify(replyMessages).includes(conversation[0].message),
      "summarized reply context should not include old transcript messages",
    );

    const fullHistoryMessages = buildReplyMessages(
      "system prompt",
      await getChatMessages(sessionId),
      null,
      null,
      {
        totalChatMessages: 17,
        toolCalls: [],
      },
    );

    assert.deepEqual(
      fullHistoryMessages.slice(0, 3).map((message) => message.role),
      ["system", "system", "user"],
    );
    assert.equal(
      fullHistoryMessages[1]?.content,
      [
        "Conversation metadata: total chat messages: 17.",
        "Tool calls so far: none.",
      ].join("\n"),
    );
    assert.equal(getChatContextSource("summary-2"), "Summary context");
    assert.equal(
      findLatestUserMessage(await getChatMessages(sessionId)),
      conversation[16].message,
    );
    assert.ok(estimateInputTokens(replyMessages) > 0);

    console.log("Chat summarization integration test passed.");
  } finally {
    await getPool()
      .query("DELETE FROM chats WHERE id = $1", [sessionId])
      .catch(() => undefined);
  }
}

async function loadConversation() {
  const rawConversation = JSON.parse(
    await readFile(join("tests", "data", "conversation.json"), "utf8"),
  ) as FixtureMessage[];

  assert.ok(rawConversation.length >= 17);

  return rawConversation;
}

function completion(content: string): ChatCompletion {
  return {
    id: randomUUID(),
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "test-model",
    choices: [
      {
        index: 0,
        finish_reason: "stop",
        logprobs: null,
        message: {
          role: "assistant",
          content,
          refusal: null,
        },
      },
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 2,
      total_tokens: 12,
    },
  } as ChatCompletion;
}

function assertSummaryInputIncludes(
  params: ChatCompletionCreateParamsNonStreaming,
  expected: string,
) {
  assert.ok(
    getMessageText(params).includes(expected),
    `Expected summary input to include: ${expected}`,
  );
}

function assertSummaryInputExcludes(
  params: ChatCompletionCreateParamsNonStreaming,
  unexpected: string,
) {
  assert.ok(
    !getMessageText(params).includes(unexpected),
    `Expected summary input to exclude: ${unexpected}`,
  );
}

function getMessageText(params: ChatCompletionCreateParamsNonStreaming) {
  return params.messages
    .map((message) =>
      typeof message.content === "string" ? message.content : "",
    )
    .join("\n\n");
}

main().catch((err) => {
  console.error("Chat summarization integration test failed:", err);
  process.exit(1);
});
