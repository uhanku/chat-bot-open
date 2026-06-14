import { NextResponse, type NextRequest } from "next/server";
import { sessionCookieName, verifySessionToken } from "@/lib/auth";

const publicPaths = new Set(["/login"]);

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (publicPaths.has(pathname) || pathname.startsWith("/api/auth/")) {
    const session = await verifySessionToken(
      request.cookies.get(sessionCookieName)?.value,
    );

    if (session && pathname === "/login") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  }

  const session = await verifySessionToken(
    request.cookies.get(sessionCookieName)?.value,
  );

  if (session) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set(
    "next",
    `${pathname}${request.nextUrl.search}`,
  );

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
