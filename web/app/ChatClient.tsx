"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export type ChatUiMessage = {
  role: "user" | "bot";
  text: string;
};

type ChatClientProps = {
  initialIsActive?: boolean;
  initialMessages?: ChatUiMessage[];
  initialSessionId?: string;
};

const chatRequestLimitUpdatedEvent = "chat-request-limit-updated";

const defaultMessages: ChatUiMessage[] = [
  { role: "bot", text: "Hi! How can I help?" },
];

function MarkdownMessage({ message }: { message: ChatUiMessage }) {
  const isUserMessage = message.role === "user";
  const subtleTextClass = isUserMessage ? "text-[#2f220e]" : "text-[#d8c29b]";
  const borderClass = isUserMessage
    ? "border-[#0b0907]/25"
    : "border-[#c9a154]/30";
  const codeBackgroundClass = isUserMessage
    ? "bg-[#0b0907]/12"
    : "bg-[#0b0907]/45";
  const linkClass = isUserMessage
    ? "text-[#0b0907] underline decoration-[#0b0907]/45 underline-offset-2"
    : "text-[#f2c970] underline decoration-[#f2c970]/45 underline-offset-2";

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ children, ...props }) => (
          <a className={linkClass} rel="noreferrer" target="_blank" {...props}>
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote
            className={`my-2 border-l-2 ${borderClass} pl-3 ${subtleTextClass}`}
          >
            {children}
          </blockquote>
        ),
        code: ({ children, className }) => (
          <code
            className={[
              className,
              "rounded-sm px-1 py-0.5 font-mono text-[0.9em]",
              codeBackgroundClass,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {children}
          </code>
        ),
        h1: ({ children }) => (
          <h1 className="mb-2 mt-3 text-xl font-semibold first:mt-0">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-2 mt-3 text-lg font-semibold first:mt-0">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-2 mt-3 text-base font-semibold first:mt-0">
            {children}
          </h3>
        ),
        hr: () => <hr className={`my-3 border-0 border-t ${borderClass}`} />,
        input: ({ checked, type }) => (
          <input
            checked={checked}
            className="mr-2 align-middle"
            disabled
            readOnly
            type={type}
          />
        ),
        li: ({ children }) => <li className="my-1 pl-1">{children}</li>,
        ol: ({ children }) => (
          <ol className="my-2 list-decimal space-y-1 pl-5 first:mt-0 last:mb-0">
            {children}
          </ol>
        ),
        p: ({ children }) => (
          <p className="my-2 first:mt-0 last:mb-0">{children}</p>
        ),
        pre: ({ children }) => (
          <pre
            className={`my-2 overflow-x-auto rounded-sm ${codeBackgroundClass} p-3 font-mono text-[13px] leading-relaxed first:mt-0 last:mb-0 [&_code]:bg-transparent [&_code]:p-0`}
          >
            {children}
          </pre>
        ),
        table: ({ children }) => (
          <div className="my-2 overflow-x-auto first:mt-0 last:mb-0">
            <table
              className={`min-w-full border-collapse border ${borderClass}`}
            >
              {children}
            </table>
          </div>
        ),
        td: ({ children }) => (
          <td className={`border ${borderClass} px-2 py-1 align-top`}>
            {children}
          </td>
        ),
        th: ({ children }) => (
          <th className={`border ${borderClass} px-2 py-1 text-left align-top`}>
            {children}
          </th>
        ),
        ul: ({ children }) => (
          <ul className="my-2 list-disc space-y-1 pl-5 first:mt-0 last:mb-0">
            {children}
          </ul>
        ),
      }}
    >
      {message.text}
    </ReactMarkdown>
  );
}

function LoadingMessage() {
  return (
    <div
      aria-label="Response loading"
      className="flex max-w-[78%] items-center gap-1.5 self-start rounded-sm border border-[#c9a154]/25 bg-[#241c15] px-4 py-3 shadow-[0_10px_24px_rgba(0,0,0,0.22)]"
      role="status"
    >
      <span className="sr-only">Waiting for response</span>
      {[0, 150, 300].map((delay) => (
        <span
          aria-hidden="true"
          className="h-2 w-2 animate-bounce rounded-full bg-[#d6b46a]"
          key={delay}
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}

export function ChatClient({
  initialIsActive = true,
  initialMessages,
  initialSessionId,
}: ChatClientProps) {
  const [sessionId] = useState(() => initialSessionId ?? crypto.randomUUID());
  const [messages, setMessages] = useState<ChatUiMessage[]>(
    initialMessages?.length ? initialMessages : defaultMessages,
  );
  const [input, setInput] = useState("");
  const [inputError, setInputError] = useState("");
  const [isActive, setIsActive] = useState(initialIsActive);
  const [isSending, setIsSending] = useState(false);
  const isInputDisabled = isSending || !isActive;
  const scrollTrigger = `${messages.length}:${isSending ? "sending" : "idle"}`;

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const shouldSendInitialLanguageRef = useRef(
    !initialMessages?.some((message) => message.role === "user"),
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [scrollTrigger]);

  async function sendMessage() {
    const message = input.trim();

    if (!message || isInputDisabled) return;

    const userMessage: ChatUiMessage = {
      role: "user",
      text: message,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setInputError("");
    setIsSending(true);

    try {
      const language =
        shouldSendInitialLanguageRef.current && navigator.language
          ? navigator.language
          : undefined;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ language, message, sessionId }),
      });

      if (!res.ok) {
        if (res.status === 403) {
          throw new Error("inactive");
        }

        if (res.status === 413) {
          throw new Error("message-too-long");
        }

        if (res.status === 429) {
          window.dispatchEvent(new Event(chatRequestLimitUpdatedEvent));
          throw new Error("request-limit");
        }

        throw new Error("Chat request failed.");
      }

      const body = (await res.json()) as {
        isActive?: unknown;
        reply?: unknown;
      };

      if (typeof body.reply !== "string" || !body.reply.trim()) {
        throw new Error("Chat reply was missing.");
      }

      const reply = body.reply;

      setMessages((prev) => [...prev, { role: "bot", text: reply }]);
      shouldSendInitialLanguageRef.current = false;
      window.dispatchEvent(new Event(chatRequestLimitUpdatedEvent));

      if (body.isActive === false) {
        setIsActive(false);
      }
    } catch (error) {
      if (error instanceof Error && error.message === "inactive") {
        setIsActive(false);
      }

      if (error instanceof Error && error.message === "message-too-long") {
        setInput(message);
        setInputError("Keep replies lightweight and easy to read.");
        setMessages((prev) => prev.filter((msg) => msg !== userMessage));
        return;
      }

      if (error instanceof Error && error.message === "request-limit") {
        setInput(message);
        setMessages((prev) => prev.filter((msg) => msg !== userMessage));
        setInputError("The hourly chat request limit has been reached.");
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text:
            error instanceof Error && error.message === "inactive"
              ? "This chat is inactive and cannot accept new messages."
              : "The MCP server could not handle that message.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col bg-[#f7f5f0] font-serif">
      <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-6">
        <div className="flex h-[min(640px,calc(100svh-112px))] min-h-[480px] w-full max-w-[460px] flex-col rounded-sm border border-[#c9a154]/45 bg-gradient-to-b from-[#17120e] to-[#0b0907] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
          <h1 className="mb-5 border-b border-[#c9a154]/35 pb-4 text-[28px] font-normal uppercase tracking-[0.12em] text-[#d6b46a]">
            Chat
          </h1>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain scroll-smooth pr-1 [scrollbar-color:rgba(201,161,84,0.4)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#c9a154]/40 hover:[&::-webkit-scrollbar-thumb]:bg-[#d6b46a]/70">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={[
                  "max-w-[78%] rounded-sm px-4 py-3 text-[15px] leading-relaxed shadow-[0_10px_24px_rgba(0,0,0,0.22)]",
                  msg.role === "user"
                    ? "self-end border border-[#ffdc8c]/45 bg-gradient-to-br from-[#b88a3b] to-[#6f4f1f] text-[#0b0907]"
                    : "self-start border border-[#c9a154]/25 bg-[#241c15] text-[#f5ead2]",
                ].join(" ")}
              >
                <MarkdownMessage message={msg} />
              </div>
            ))}

            {isSending ? <LoadingMessage /> : null}

            <div ref={messagesEndRef} />
          </div>

          {!isActive ? (
            <p className="mt-[18px] border-t border-[#c9a154]/30 pt-[18px] font-sans text-sm text-[#d8c29b]">
              This chat is inactive and cannot accept new messages.
            </p>
          ) : null}

          <div className="mt-[18px] border-t border-[#c9a154]/30 pt-[18px]">
            <div className="flex gap-2.5">
              <input
                className="min-w-0 flex-1 rounded-sm border border-[#c9a154]/45 bg-[#120f0c] px-3.5 py-3 font-sans text-[#f5ead2] outline-none placeholder:text-[#a89472] disabled:opacity-60"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setInputError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder={isActive ? "Type a message..." : "Chat inactive"}
                disabled={isInputDisabled}
              />

              <button
                className="cursor-pointer rounded-sm border border-[#d6b46a] bg-gradient-to-br from-[#d6b46a] to-[#8f6a2e] px-[18px] py-3 font-sans font-bold uppercase tracking-[0.08em] text-[#0b0907] disabled:opacity-60"
                onClick={sendMessage}
                disabled={isInputDisabled}
              >
                {isSending ? "Sending" : isActive ? "Send" : "Inactive"}
              </button>
            </div>
            {inputError ? (
              <p className="mt-2 font-sans text-sm text-red-400">
                {inputError}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
