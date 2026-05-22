/**
 * Same-origin proxy to the Planner Agent.
 *
 * The browser POSTs to /api/agent (this route). We re-issue the request to
 * PLANNER_URL and pipe the SSE response straight back. This avoids needing
 * CORS on the backend.
 *
 * Bypass this proxy by setting NEXT_PUBLIC_AGENT_URL to a non-/api/agent
 * value (e.g. /api/mock-planner) — the client hook uses that URL directly
 * and never hits this route.
 */

export const runtime = "nodejs";
// Streaming responses must not be cached.
export const dynamic = "force-dynamic";

function sseErrorFrame(message: string): string {
  return `event: RUN_ERROR\ndata: ${JSON.stringify({ message })}\n\n`;
}

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

export async function POST(req: Request): Promise<Response> {
  const plannerUrl = process.env.PLANNER_URL?.trim();
  if (!plannerUrl) {
    return new Response(
      sseErrorFrame(
        "PLANNER_URL is not configured. Set it in frontend/.env.local (see .env.example) and restart the dev server.",
      ),
      { status: 500, headers: SSE_HEADERS },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(plannerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      // Pipe the raw body through — avoids re-parsing JSON we don't need to read.
      body: await req.text(),
      // Forward the client abort so cancelling on the browser cancels upstream.
      signal: req.signal,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      sseErrorFrame(`Planner unreachable at ${plannerUrl}: ${message}`),
      { status: 502, headers: SSE_HEADERS },
    );
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return new Response(
      sseErrorFrame(
        `Planner returned ${upstream.status} ${upstream.statusText}${
          detail ? `: ${detail.slice(0, 200)}` : ""
        }`,
      ),
      { status: 502, headers: SSE_HEADERS },
    );
  }

  return new Response(upstream.body, { status: 200, headers: SSE_HEADERS });
}
