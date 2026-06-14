import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import path from "node:path";

type CallMcpToolInput = {
  name: string;
  arguments: Record<string, unknown>;
};

function getMcpEnvironment() {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
}

export async function callMcpTool({
  name,
  arguments: toolArguments,
}: CallMcpToolInput): Promise<string> {
  const client = new Client({
    name: "chat-bot-web",
    version: "1.0.0",
  });
  const transport = new StdioClientTransport({
    command: "npm",
    args: ["run", "start", "--silent"],
    cwd: path.resolve(process.cwd(), "../mcp"),
    env: getMcpEnvironment(),
  });

  try {
    await client.connect(transport);

    const result = CallToolResultSchema.parse(
      await client.callTool({
        name,
        arguments: toolArguments,
      }),
    );

    if (result.isError) {
      console.log(result);
      throw new Error("MCP tool returned an error result.");
    }

    const reply = result.content
      .filter((content) => content.type === "text")
      .map((content) => content.text)
      .join("\n")
      .trim();

    if (!reply) {
      throw new Error("MCP tool returned no text content.");
    }

    return reply;
  } finally {
    await client.close();
  }
}
