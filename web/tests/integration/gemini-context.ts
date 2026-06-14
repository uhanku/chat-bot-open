import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import OpenAI from "openai";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { getRequiredEnv } from "./env";
import { upsertUserCredentialsFunction } from "@/app/api/chat/chat";

const GEMINI_MODEL = getRequiredEnv("API_MODEL");

async function main() {
  const apiKey = getRequiredEnv("API_KEY");
  const systemPrompt = await readFile(join("docs", "SYSTEM_C1.md"), "utf8");

  const openai = new OpenAI({
    apiKey,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  });

  const completion = await openai.chat.completions.create({
    model: GEMINI_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "hi" },
    ],
    temperature: 0.7,
    max_tokens: 256,
    tools: [toChatCompletionTool(upsertUserCredentialsFunction)],
    tool_choice: "auto",
  });

  const reply = completion.choices[0]?.message.content?.trim();

  assert.ok(
    reply,
    `Gemini returned an empty context reply. model=${completion.model} finish_reason=${completion.choices[0]?.finish_reason}`,
  );

  console.log(`Gemini ${completion.model} context response: ${reply}`);
}

function toChatCompletionTool(
  functionDeclaration: typeof upsertUserCredentialsFunction,
): ChatCompletionTool {
  assert.ok(
    functionDeclaration.name,
    "Function declaration must include a name.",
  );
  assert.ok(
    functionDeclaration.parametersJsonSchema,
    "Function declaration must include parametersJsonSchema.",
  );

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

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
