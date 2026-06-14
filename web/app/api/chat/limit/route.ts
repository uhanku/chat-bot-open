import { NextResponse } from "next/server";
import { getAppChatRequestsPerHour } from "@/lib/chat-request-limit";
import { getChatRequestLimitStatus } from "@/lib/database";

export const runtime = "nodejs";

export async function GET() {
  const requestLimit = await getChatRequestLimitStatus(
    getAppChatRequestsPerHour(),
  );

  return NextResponse.json({ requestLimit });
}
