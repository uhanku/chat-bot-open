import { NextResponse } from "next/server";

import {
  countUserMessageTokens,
  maxUserMessageTokens,
} from "@/lib/user-message-tokens";
import {
  appendLimitedUserChatMessage,
  getChatIsActive,
  setChatNameIfEmpty,
} from "@/lib/database";
import {
  getAppChatRequestsPerHour,
  type ChatRequestLimitStatus,
} from "@/lib/chat-request-limit";
import ChatInput from "./ChatInput";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const regionDisplayNames = new Intl.DisplayNames(["en"], { type: "region" });

type ChatValidationResult =
  | {
      ok: true;
      input: ChatInput;
      requestLimit: ChatRequestLimitStatus;
    }
  | {
      ok: false;
      response: NextResponse;
    };

export default async function validateChatInput(
  body: unknown,
): Promise<ChatValidationResult> {
  const message =
    typeof body === "object" && body !== null && "message" in body
      ? body.message
      : undefined;
  const sessionId =
    typeof body === "object" && body !== null && "sessionId" in body
      ? body.sessionId
      : undefined;
  const language =
    typeof body === "object" && body !== null && "language" in body
      ? body.language
      : undefined;

  if (typeof message !== "string" || !message.trim()) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Message is required" },
        { status: 400 },
      ),
    };
  }

  if (typeof sessionId !== "string" || !uuidPattern.test(sessionId)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Valid sessionId is required" },
        { status: 400 },
      ),
    };
  }

  const input = new ChatInput(
    message,
    sessionId,
    typeof language === "string" ? language : undefined,
  );
  const tokenCount = countUserMessageTokens(input.message);

  if (tokenCount > maxUserMessageTokens) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: `Message exceeds the ${maxUserMessageTokens} token limit.`,
          maxTokens: maxUserMessageTokens,
          tokenCount,
        },
        { status: 413 },
      ),
    };
  }

  const isActive = await getChatIsActive(input.sessionId);

  if (isActive === false) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "This chat is inactive and cannot accept new messages." },
        { status: 403 },
      ),
    };
  }

  if (typeof input.language === "string") {
    await storeChatCountryFromLanguage(input.sessionId, input.language);
  }

  const requestLimit = await appendLimitedUserChatMessage(
    input.sessionId,
    input.message,
    getAppChatRequestsPerHour(),
  );

  if (!requestLimit.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "The global chat request limit has been reached.",
          requestLimit: requestLimit.status,
        },
        { status: 429 },
      ),
    };
  }

  return {
    ok: true,
    input,
    requestLimit: requestLimit.status,
  };
}

export function getCountryNameFromLanguage(language: string) {
  const trimmedLanguage = language.trim();

  if (!trimmedLanguage || trimmedLanguage.length > 64) {
    return null;
  }

  try {
    const region = new Intl.Locale(trimmedLanguage).region?.toUpperCase();

    if (!region || !/^[A-Z]{2}$/.test(region)) {
      return null;
    }

    return regionDisplayNames.of(region) ?? null;
  } catch {
    return null;
  }
}

async function storeChatCountryFromLanguage(sessionId: string, language: string) {
  const countryName = getCountryNameFromLanguage(language);

  if (!countryName) {
    return;
  }

  await setChatNameIfEmpty(sessionId, countryName);
}
