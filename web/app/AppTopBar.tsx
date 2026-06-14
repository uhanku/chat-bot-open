"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/", label: "Chat" },
  { href: "/chats", label: "Chats" },
  { href: "/chat-leads", label: "Chat Leads" },
  { href: "/chat-flow", label: "Chat Flow" },
];

type RequestLimitStatus = {
  limit: number;
  remaining: number | null;
};

const chatRequestLimitUpdatedEvent = "chat-request-limit-updated";

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function navLinkClass(isActive: boolean) {
  return [
    "rounded-sm border px-3 py-2 text-xs font-bold uppercase tracking-[0.08em]",
    isActive
      ? "border-[#d6b46a] bg-[#d6b46a] text-[#0b0907]"
      : "border-[#d6b46a]/55 bg-[#0b0907]/55 text-[#d6b46a]",
  ].join(" ");
}

export function AppTopBar() {
  const pathname = usePathname();
  const [requestLimit, setRequestLimit] = useState<RequestLimitStatus | null>(
    null,
  );

  useEffect(() => {
    if (pathname === "/login") {
      return;
    }

    let isMounted = true;

    async function loadRequestLimit() {
      try {
        const res = await fetch("/api/chat/limit", { cache: "no-store" });

        if (!res.ok) {
          return;
        }

        const body = (await res.json()) as { requestLimit?: unknown };
        const nextRequestLimit = body.requestLimit;

        if (
          typeof nextRequestLimit === "object" &&
          nextRequestLimit !== null &&
          "limit" in nextRequestLimit &&
          "remaining" in nextRequestLimit
        ) {
          const { limit, remaining } = nextRequestLimit;

          if (
            typeof limit === "number" &&
            (typeof remaining === "number" || remaining === null) &&
            isMounted
          ) {
            setRequestLimit({ limit, remaining });
          }
        }
      } catch {
        return;
      }
    }

    loadRequestLimit();
    window.addEventListener(chatRequestLimitUpdatedEvent, loadRequestLimit);

    return () => {
      isMounted = false;
      window.removeEventListener(chatRequestLimitUpdatedEvent, loadRequestLimit);
    };
  }, [pathname]);

  if (pathname === "/login") {
    return null;
  }

  return (
    <header className="border-b border-[#c9a154]/25 bg-[#0b0907]/80 px-4 py-3 font-sans backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-2" aria-label="Primary navigation">
          {navItems.map((item) => {
            const isActive = isActivePath(pathname, item.href);

            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={navLinkClass(isActive)}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          {requestLimit ? (
            <div className="rounded-sm border border-[#d6b46a]/45 bg-[#0b0907]/55 px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-[#d6b46a]">
              Requests:{" "}
              {requestLimit.limit === 0
                ? "unlimited"
                : `${requestLimit.remaining ?? 0} left`}
            </div>
          ) : null}
          <form action="/api/auth/logout" method="post">
            <button
              className="cursor-pointer rounded-sm border border-[#d6b46a]/70 bg-[#0b0907]/70 px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-[#d6b46a]"
              type="submit"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
