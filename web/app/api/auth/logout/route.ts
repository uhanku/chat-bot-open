import { NextResponse } from "next/server";
import { sessionCookieName } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const response = NextResponse.redirect(new URL("/login", req.url), {
    status: 303,
  });

  response.cookies.delete(sessionCookieName);

  return response;
}
