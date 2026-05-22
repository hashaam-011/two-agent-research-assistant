/**
 * Typed env-var access for the frontend.
 *
 * Required vars are validated on first read, not at module load. Reasoning:
 * `NEXT_PUBLIC_*` values are inlined by the Next.js compiler at build time,
 * but the module's *body* still runs on the server during SSR and during
 * `next build`. A module-level throw would crash CI builds that don't have
 * `.env.local`. Lazy access means the build succeeds and the failure
 * surfaces in the browser the first time a user actually starts a run —
 * with a clear directive message.
 */

function requireEnv(name: string, value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(
      `Missing required env var ${name}. Copy frontend/.env.example to ` +
        `frontend/.env.local and fill it in, then restart the dev server ` +
        `(or rebuild for production).`,
    );
  }
  return trimmed;
}

/**
 * SSE endpoint the browser POSTs the planner request to.
 *
 *   - `/api/agent`         — same-origin proxy (recommended; backend stays CORS-free)
 *   - `/api/mock-planner`  — drive the UI from the in-process mock, no backend
 *   - absolute URL         — only if upstream allows CORS from this origin
 *
 * Resolved on first call so `next build` doesn't crash when `.env.local` is
 * absent on the build host. The throw fires the first time the SSE hook runs.
 */
export function getAgentUrl(): string {
  return requireEnv("NEXT_PUBLIC_AGENT_URL", process.env.NEXT_PUBLIC_AGENT_URL);
}
