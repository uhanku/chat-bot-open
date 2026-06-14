import Link from "next/link";
import { listChatLeads } from "@/lib/database";

export const dynamic = "force-dynamic";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function empty(value: string | null) {
  return value?.trim() || "None";
}

export default async function ChatLeadsPage() {
  const leads = await listChatLeads();

  return (
    <main className="flex-1 bg-[#f7f5f0] px-6 py-8 font-sans text-[#1f1b16]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#d8d0c2] pb-5">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.12em] text-[#746957]">
              Database
            </p>
            <h1 className="mt-1 text-3xl font-semibold">Chat Leads</h1>
          </div>
        </header>

        <div className="overflow-x-auto border border-[#d8d0c2] bg-white">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-[#ece7dc] text-xs uppercase tracking-[0.08em] text-[#5d5446]">
              <tr>
                <th className="px-4 py-3 font-semibold">Client</th>
                <th className="px-4 py-3 font-semibold">Contact</th>
                <th className="px-4 py-3 font-semibold">Company</th>
                <th className="px-4 py-3 font-semibold">Chat</th>
                <th className="px-4 py-3 font-semibold">Score</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Lead updated</th>
                <th className="px-4 py-3 font-semibold">Lead created</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr
                  className="border-t border-[#ebe4d8] align-top hover:bg-[#fbfaf7]"
                  key={lead.id}
                >
                  <td className="px-4 py-3 font-semibold">
                    {empty(lead.client_name)}
                  </td>
                  <td className="max-w-[240px] px-4 py-3">
                    <div className="break-words">
                      {empty(lead.email_address)}
                    </div>
                    <div className="mt-1 text-xs text-[#746957]">
                      {empty(lead.phone_number)}
                    </div>
                  </td>
                  <td className="px-4 py-3">{empty(lead.company_or_studio)}</td>
                  <td className="max-w-[260px] px-4 py-3">
                    <Link
                      className="font-semibold text-[#6b4a12] underline underline-offset-2"
                      href={`/chats/${lead.chat_id}`}
                    >
                      {empty(lead.chat_name)}
                    </Link>
                    <div className="mt-1 break-all font-mono text-xs text-[#746957]">
                      {lead.chat_id}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold">{lead.chat_score}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-sm border border-[#d8d0c2] px-2 py-1 text-xs font-semibold">
                      {lead.chat_is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatDate(lead.updated_at)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatDate(lead.created_at)}
                  </td>
                </tr>
              ))}

              {leads.length === 0 ? (
                <tr>
                  <td
                    className="px-4 py-8 text-center text-[#746957]"
                    colSpan={8}
                  >
                    No chat leads found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
