import { getDemoCredentials, sanitizeNextPath } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(params.next ?? null);
  // const credentials = getDemoCredentials();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f5f0] px-6 py-8 font-sans text-[#1f1b16]">
      <div className="w-full max-w-[380px] border border-[#d8d0c2] bg-white p-6 shadow-[0_20px_60px_rgba(31,27,22,0.12)]">
        <div className="border-b border-[#ebe4d8] pb-5">
          <h1 className="mt-1 text-3xl font-semibold">Chat Demo</h1>
        </div>

        {params.error ? (
          <div className="mt-5 border border-[#b35c47] bg-[#fff6f2] px-3 py-2 text-sm font-medium text-[#7a2d1f]">
            The username or password is incorrect.
          </div>
        ) : null}

        <form
          action="/api/auth/login"
          className="mt-5 flex flex-col gap-4"
          method="post"
        >
          <input name="next" type="hidden" value={nextPath} />
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Username
            <input
              autoComplete="username"
              className="rounded-sm border border-[#cfc6b8] px-3 py-2.5 font-normal outline-none focus:border-[#9a7a3a]"
              name="username"
              required
              type="text"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Password
            <input
              autoComplete="current-password"
              className="rounded-sm border border-[#cfc6b8] px-3 py-2.5 font-normal outline-none focus:border-[#9a7a3a]"
              name="password"
              required
              type="password"
            />
          </label>
          <button
            className="cursor-pointer mt-1 rounded-sm border border-[#9a7a3a] bg-[#1f1b16] px-4 py-2.5 text-sm font-semibold text-white"
            type="submit"
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
