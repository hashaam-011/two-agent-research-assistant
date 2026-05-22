# Frontend — Two-Agent Research Assistant

Next.js + TypeScript console for the [Two-Agent Research Assistant POC](../README.md). The left panel is the chat; the right panel is the live agent-activity view driven by the AG-UI event stream.

- **Framework:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript 5.7
- **Styling:** Tailwind 3 · hand-rolled primitives
- **Transport:** AG-UI events over SSE, consumed via `fetch` + `ReadableStream`
- **Dev server:** <http://localhost:3000>

---

## Quick start (UI-only, no backend)

```bash
cd frontend
npm install
cp .env.example .env.local           # then edit:
# NEXT_PUBLIC_AGENT_URL=/api/mock-planner
# PLANNER_URL=                        # not needed when using the mock
npm run dev
```

Open <http://localhost:3000> and ask a question. The in-process mock planner at `app/api/mock-planner/route.ts` replays the full AG-UI event sequence so every panel lights up without a backend running.

> **The frontend has no silent defaults.** `.env.local` is required — the app throws at startup if `NEXT_PUBLIC_AGENT_URL` is missing, so misconfiguration is caught immediately instead of producing mystery 404s.

---

## Full stack (live agents)

The full demo runs four services. Start each in its own terminal, in this order, then open the frontend.

### Prerequisites

- **Python 3.12+** (3.13 recommended) for the backend
- **Node 20+** for the frontend
- **(Optional)** `ANTHROPIC_API_KEY` exported in your shell — without it the Planner Agent falls back to a deterministic mock summary, which still demonstrates the full protocol flow

### 1. MCP Tool Server — port 8001

```bash
cd backend
python -m venv venv
# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
python mcp_server/main.py
```

Smoke test (in another terminal): `curl http://localhost:8001/health` → `{"status":"ok"}`.

### 2. Search Agent — port 8002

```bash
cd backend
venv\Scripts\activate   # or `source venv/bin/activate`
python search_agent/main.py
```

Smoke test:
- A2A Agent Card: <http://localhost:8002/.well-known/agent-card.json>
- Swagger UI: <http://localhost:8002/docs>

### 3. Planner Agent — port 8000

```bash
cd backend
venv\Scripts\activate
# Optional — without it the Planner uses a mock synthesizer.
# Windows
set ANTHROPIC_API_KEY=sk-ant-...
# macOS / Linux
export ANTHROPIC_API_KEY=sk-ant-...

python planner_agent/main.py
```

Smoke test:
- Swagger UI: <http://localhost:8000/docs>
- Health: `curl http://localhost:8000/health`

### 4. Frontend — port 3000

```bash
cd frontend
npm install                           # first time only
cp .env.example .env.local            # first time only
npm run dev
```

`.env.example` ships with sane local-dev values (`NEXT_PUBLIC_AGENT_URL=/api/agent`, `PLANNER_URL=http://localhost:8000/agent`). Edit `.env.local` if you're pointing at a different backend host.

Open <http://localhost:3000>, ask a research question, and you should see:

- left panel — a "thinking…" bubble that swaps to "searching the web…" then to a streaming answer
- right panel — the Planner card highlights violet (AG-UI), then the Search card highlights cyan (A2A), the `web_search` tool card highlights green (MCP) while running, and the event log fills with timestamped frames in order

---

## Environment variables

There are no silent defaults — copy `.env.example` to `.env.local` and set values explicitly. The app throws at module-load time if anything required is missing.

| Variable | Required? | Notes |
|---|---|---|
| `NEXT_PUBLIC_AGENT_URL` | **Required** | Where the browser POSTs the planner request. `/api/agent` (same-origin proxy), `/api/mock-planner` (in-process mock), or an absolute URL (only if upstream allows CORS). |
| `PLANNER_URL` | Required when `NEXT_PUBLIC_AGENT_URL=/api/agent` | Server-side only. Where the proxy forwards to. Typically `http://localhost:8000/agent` for local dev, or your staging/Docker hostname. |

---

## Architecture

```
Browser            Next.js (this app)         Backend
┌───────┐  POST   ┌──────────────────┐  POST  ┌──────────────────┐  A2A   ┌─────────────┐  MCP   ┌──────────────┐
│ ChatPanel  ───► │ /api/agent       │ ─────► │ Planner :8000    │ ─────► │ Search :8002│ ─────► │  MCP   :8001 │
│ Activity   ◄─── │ (SSE proxy)      │ ◄───── │ AG-UI SSE        │ ◄───── │  AG-UI/JSON │ ◄───── │  web_search  │
└───────┘   SSE   └──────────────────┘  SSE   └──────────────────┘        └─────────────┘        └──────────────┘
```

The proxy at `app/api/agent/route.ts` exists so the browser never makes a cross-origin request; the backend stays CORS-free.

### Key files

| Path | Purpose |
|---|---|
| `app/api/agent/route.ts` | Same-origin SSE proxy to the Planner Agent |
| `app/api/mock-planner/route.ts` | Deterministic mock that emits the full event sequence |
| `hooks/use-agent-stream.ts` | `fetch` + `ReadableStream` SSE parser, with cancellation |
| `components/app-state.tsx` | Context provider; routes AG-UI events to chat + activity state |
| `lib/agui-types.ts` | TypeScript mirror of `contracts/*.py` |
| `components/agent-flow.tsx` | Planner → Search → web_search node row with protocol-tinted active state |
| `components/event-log.tsx` | Timestamped per-event-type log |
| `components/chat-panel.tsx` | Conversation + streaming bubble + composer |

---

## Verifying the integration

A complete end-to-end run should produce this event order. Watch the event log in the right panel:

```
RUN_STARTED         — run kicks off
STEP_STARTED        — "Delegating to Search Agent"
STATE_DELTA         — active_agent=search, tool_calls[running]
TOOL_CALL_START     — web_search({ query })
TOOL_CALL_END       — web_search → 3 results
STATE_DELTA         — active_agent=planner, "writing answer"
STEP_FINISHED       — "Delegating to Search Agent ✓"
TEXT_MESSAGE_START  — assistant bubble opens
TEXT_MESSAGE_CONTENT× N — tokens stream in
TEXT_MESSAGE_END    — bubble finalises
RUN_FINISHED        — run closes
```

If `TOOL_CALL_END` never arrives, check the Search Agent terminal — most often the MCP server isn't running on `:8001`.

---

## Scripts

```bash
npm run dev         # local dev server (Turbopack)
npm run build       # production build
npm run start       # serve the production build
npm run typecheck   # tsc --noEmit
```

> ESLint: not currently wired. ESLint 9 needs a flat-config migration and Next 16 dropped `next lint`. Tracked separately.

---

## Troubleshooting

- **"Planner unreachable at http://localhost:8000/agent"** — the Planner Agent isn't running. Start it (`python planner_agent/main.py`).
- **The tool call card never fills in results** — the Search Agent couldn't reach the MCP server. Start `python mcp_server/main.py` and confirm port 8001 is free.
- **Stream stops mid-answer** — most commonly the Planner crashed. Check its terminal for tracebacks.
- **CORS errors in the browser console** — you've set `NEXT_PUBLIC_AGENT_URL` to a cross-origin URL. Either drop it (the default `/api/agent` proxy avoids CORS) or add CORS middleware to the Planner.
- **Port 3000 in use** — Next will pick the next free port and print it. Restart your other dev server or pass `PORT=3001 npm run dev`.

---

## Links

- Root POC plan and contracts: [`../README.md`](../README.md)
- Wire-level contracts: [`../contracts/README.md`](../contracts/README.md)
- Frontend task tracker: [`./PROGRESS.md`](./PROGRESS.md)
