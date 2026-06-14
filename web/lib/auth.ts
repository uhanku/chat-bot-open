export const sessionCookieName = "chat_bot_session";
export const sessionMaxAgeSeconds = 60 * 60 * 8;

export type SessionPayload = {
  userId: string;
  username: string;
  expiresAt: number;
};

const demoUserId = "demo-user";
const defaultDemoUsername = "demo";
const defaultDemoPassword = "demo";
const developmentAuthSecret = "local-development-auth-secret";
const textEncoder = new TextEncoder();

export function getDemoCredentials() {
  return {
    username: process.env.DEMO_USERNAME || defaultDemoUsername,
    password: process.env.DEMO_PASSWORD || defaultDemoPassword,
  };
}

export function validateDemoCredentials(username: string, password: string) {
  const credentials = getDemoCredentials();

  return username === credentials.username && password === credentials.password;
}

export function getDemoUser(username = getDemoCredentials().username) {
  return {
    userId: demoUserId,
    username,
  };
}

export async function createSessionToken(username: string) {
  const payload: SessionPayload = {
    ...getDemoUser(username),
    expiresAt: Date.now() + sessionMaxAgeSeconds * 1000,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export async function verifySessionToken(token: string | undefined) {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature, extra] = token.split(".");

  if (!encodedPayload || !signature || extra !== undefined) {
    return null;
  }

  const expectedSignature = await sign(encodedPayload);

  if (!timingSafeEqual(signature, expectedSignature)) {
    return null;
  }

  const payload = parsePayload(encodedPayload);

  if (!payload || payload.expiresAt <= Date.now()) {
    return null;
  }

  return payload;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    maxAge: sessionMaxAgeSeconds,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export function sanitizeNextPath(value: FormDataEntryValue | string | null) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return "/";
  }

  if (value.startsWith("/login") || value.startsWith("/api/auth")) {
    return "/";
  }

  return value;
}

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;

  if (secret?.trim()) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required in production.");
  }

  return developmentAuthSecret;
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(getAuthSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(value),
  );

  return base64UrlEncodeBytes(new Uint8Array(signature));
}

function parsePayload(encodedPayload: string): SessionPayload | null {
  try {
    const parsed: unknown = JSON.parse(base64UrlDecode(encodedPayload));

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("userId" in parsed) ||
      !("username" in parsed) ||
      !("expiresAt" in parsed)
    ) {
      return null;
    }

    const payload = parsed as Record<string, unknown>;

    if (
      typeof payload.userId !== "string" ||
      typeof payload.username !== "string" ||
      typeof payload.expiresAt !== "number"
    ) {
      return null;
    }

    return {
      userId: payload.userId,
      username: payload.username,
      expiresAt: payload.expiresAt,
    };
  } catch {
    return null;
  }
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) {
    return false;
  }

  let diff = 0;

  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return diff === 0;
}

function base64UrlEncode(value: string) {
  return base64UrlEncodeBytes(textEncoder.encode(value));
}

function base64UrlEncodeBytes(bytes: Uint8Array) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(value: string) {
  const paddedValue = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(paddedValue);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

  return new TextDecoder().decode(bytes);
}
