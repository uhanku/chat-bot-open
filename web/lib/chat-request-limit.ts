const appChatRequestsPerHourKey = "APP_CHAT_REQUESTS_PER_HOUR";

export type ChatRequestLimitStatus = {
  limit: number;
  used: number;
  remaining: number | null;
  resetAt: string | null;
};

export function getAppChatRequestsPerHour() {
  const rawLimit = process.env[appChatRequestsPerHourKey]?.trim();

  if (!rawLimit) {
    return 0;
  }

  const parsedLimit = Number(rawLimit);

  if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
    return 0;
  }

  return parsedLimit;
}
