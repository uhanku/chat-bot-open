import { NextResponse } from "next/server";
import { appendChatMessage, getChatIsActive } from "@/lib/database";
import { handleChatResponse, refreshChatSummary } from "./chat";
import validateChatInput from "./validations";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  try {
    const validation = await validateChatInput(body);

    if (!validation.ok) {
      return validation.response;
    }

    const { input, requestLimit } = validation;
    const reply = await handleChatResponse(input.sessionId, input.message);

    await appendChatMessage(input.sessionId, "assistant", reply);
    await refreshChatSummary(input.sessionId);
    const updatedIsActive = await getChatIsActive(input.sessionId);

    return NextResponse.json({
      reply,
      isActive: updatedIsActive ?? true,
      requestLimit,
    });
  } catch (e) {
    console.log(e);
    return NextResponse.json(
      { error: "Unable to handle chat response" },
      { status: 500 },
    );
  }
}
