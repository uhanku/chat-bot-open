import assert from "node:assert/strict";
import OpenAI from "openai";
import { getRequiredEnv } from "./env";

const GPT_MODEL = getRequiredEnv("API_MODEL");

async function main() {
  const apiKey = getRequiredEnv("API_KEY");

  const openai = new OpenAI({
    apiKey,
  });

  const completion = await openai.chat.completions.create({
    model: GPT_MODEL,
    messages: [{ role: "user", content: "Reply with exactly: pong" }],
    temperature: 0,
    max_completion_tokens: 128,
  });

  const reply = completion.choices[0]?.message?.content?.trim();

  assert.ok(
    reply,
    `${GPT_MODEL} returned an empty reply. model=${completion.model} finish_reason=${completion.choices[0]?.finish_reason}`,
  );

  console.log(`${GPT_MODEL} ${completion.model} ping response: ${reply}`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
