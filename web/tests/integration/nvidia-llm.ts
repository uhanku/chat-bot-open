import OpenAI from "openai";
import { getRequiredEnv } from "./env";

async function main() {
  const API_KEY = getRequiredEnv("API_KEY");
  const API_MODEL = getRequiredEnv("API_MODEL");

  const openai = new OpenAI({
    apiKey: API_KEY,
    baseURL: "https://integrate.api.nvidia.com/v1",
  });

  const stream = await openai.chat.completions.create({
    model: API_MODEL,
    messages: [{ role: "user", content: "hi" }],
    temperature: 0.7,
    tools: [
      {
        type: "function",
        function: {
          name: "upsert_user_credentials",
          description:
            "Create or update a prospective client's intake details as new information is discovered.",
          parameters: {
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
        },
      },
    ],
    max_tokens: 1024,
    stream: true,
  });

  for await (const chunk of stream) {
    const text = chunk.choices?.[0]?.delta?.content;
    console.log(text);
    if (text) process.stdout.write(text);
  }

  process.stdout.write("\n");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
