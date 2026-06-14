"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ChatSummaryModalProps = {
  summary: {
    text: string;
    messageCount: number;
    updatedAt: string;
  } | null;
};

export function ChatSummaryModal({ summary }: ChatSummaryModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", closeOnEscape);

    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  if (!summary) {
    return (
      <button
        className="rounded-sm border border-[#d8d0c2] px-4 py-2 text-sm font-semibold text-[#746957]"
        disabled
        type="button"
      >
        No summary available
      </button>
    );
  }

  return (
    <>
      <button
        className="cursor-pointer rounded-sm border border-[#9a7a3a] px-4 py-2 text-sm font-semibold text-[#4d3714]"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        View summary
      </button>

      {isOpen ? (
        <div
          aria-labelledby="chat-summary-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6"
          role="dialog"
        >
          <button
            aria-label="Close current chat summary"
            className="absolute inset-0 h-full w-full cursor-default"
            onClick={() => setIsOpen(false)}
            type="button"
          />
          <div className="relative max-h-full w-full max-w-2xl overflow-y-auto border border-[#d8d0c2] bg-white p-5 text-[#1f1b16] shadow-lg">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#ebe4d8] pb-3">
              <div>
                <h2 className="text-xl font-semibold" id="chat-summary-title">
                  Current chat summary
                </h2>
                <p className="mt-1 text-xs uppercase tracking-[0.08em] text-[#746957]">
                  {summary.messageCount} messages summarized - Updated{" "}
                  {summary.updatedAt}
                </p>
              </div>
              <button
                className="cursor-pointer rounded-sm border border-[#9a7a3a] bg-[#1f1b16] px-4 py-2 text-sm font-semibold text-white"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>
            <div className="mt-4 break-words text-sm leading-6">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ children, ...props }) => (
                    <a
                      className="text-[#4d3714] underline decoration-[#9a7a3a]/50 underline-offset-2"
                      rel="noreferrer"
                      target="_blank"
                      {...props}
                    >
                      {children}
                    </a>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="my-2 border-l-2 border-[#d8d0c2] pl-3 text-[#746957]">
                      {children}
                    </blockquote>
                  ),
                  code: ({ children, className }) => (
                    <code
                      className={[
                        className,
                        "rounded-sm bg-[#f4efe6] px-1 py-0.5 font-mono text-[0.9em]",
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
                  hr: () => (
                    <hr className="my-3 border-0 border-t border-[#d8d0c2]" />
                  ),
                  input: ({ checked, type }) => (
                    <input
                      checked={checked}
                      className="mr-2 align-middle"
                      disabled
                      readOnly
                      type={type}
                    />
                  ),
                  li: ({ children }) => (
                    <li className="my-1 pl-1">{children}</li>
                  ),
                  ol: ({ children }) => (
                    <ol className="my-2 list-decimal space-y-1 pl-5 first:mt-0 last:mb-0">
                      {children}
                    </ol>
                  ),
                  p: ({ children }) => (
                    <p className="my-2 first:mt-0 last:mb-0">{children}</p>
                  ),
                  pre: ({ children }) => (
                    <pre className="my-2 overflow-x-auto rounded-sm bg-[#f4efe6] p-3 font-mono text-[13px] leading-relaxed first:mt-0 last:mb-0 [&_code]:bg-transparent [&_code]:p-0">
                      {children}
                    </pre>
                  ),
                  table: ({ children }) => (
                    <div className="my-2 overflow-x-auto first:mt-0 last:mb-0">
                      <table className="min-w-full border-collapse border border-[#d8d0c2]">
                        {children}
                      </table>
                    </div>
                  ),
                  td: ({ children }) => (
                    <td className="border border-[#d8d0c2] px-2 py-1 align-top">
                      {children}
                    </td>
                  ),
                  th: ({ children }) => (
                    <th className="border border-[#d8d0c2] px-2 py-1 text-left align-top">
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
                {summary.text}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
