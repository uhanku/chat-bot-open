import { NextResponse } from "next/server";
import {
  createSessionToken,
  sanitizeNextPath,
  sessionCookieName,
  sessionCookieOptions,
  validateDemoCredentials,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const formData = await req.formData();
  const username = formData.get("username");
  const password = formData.get("password");
  const nextPath = sanitizeNextPath(formData.get("next"));

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    !validateDemoCredentials(username, password)
  ) {

    const loginUrl = new URL("/login", baseUrl);
    loginUrl.searchParams.set("error", "1");
    loginUrl.searchParams.set("next", nextPath);

    return NextResponse.redirect(loginUrl, { status: 303 });
  }

  const response = NextResponse.redirect(new URL(nextPath, baseUrl), {
    status: 303,
  });

  response.cookies.set(
    sessionCookieName,
    await createSessionToken(username),
    sessionCookieOptions(),
  );

  return response;
}
