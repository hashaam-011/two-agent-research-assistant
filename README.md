# Two-Agent Research Assistant
### AI Agent Protocol Stack · Internal Research Sprint

> **Status:** Live · **Sprint:** 3 days · **Team size:** 3 people

---

## Live Demo

| Service | URL |
|---|---|
| **Frontend** | https://two-agent-research-assistant.vercel.app/ |
| **Planner Agent** | https://hashaam18-planneragent.hf.space |
| **Search Agent** | https://hashaam18-searchagent.hf.space |
| **MCP Tool Server** | https://two-agent-research-assistant-1.onrender.com |

### How to demo
1. Open https://two-agent-research-assistant.vercel.app/
2. Type any research question e.g. *"What are the latest developments in AI agents?"*
3. Watch the **Agent Activity panel** on the right — you will see:
   - Planner Agent starts, delegates to Search Agent
   - Search Agent calls the `web_search` tool via MCP
   - Results bubble back to Planner
   - Answer streams token by token into the chat
4. The full SSE event stream can be inspected at https://hashaam18-planneragent.hf.space/docs

### Deployment overview

| Service | Platform | Notes |
|---|---|---|
| Frontend (Next.js) | Vercel | Auto-deploys from `main` branch |
| Planner Agent (FastAPI) | Hugging Face Spaces | Port 7860, Docker-based |
| Search Agent (FastAPI) | Hugging Face Spaces | Port 7860, Docker-based |
| MCP Tool Server (FastMCP) | Render | Free tier — 30s cold start after inactivity |

### Optional: enable real AI responses
Add `ANTHROPIC_API_KEY` as a secret on the Planner Agent HF Space:
`https://huggingface.co/spaces/hashaam18/planneragent` → Settings → Variables and secrets
Without it, the planner uses a mock response that summarises search results.

---

## 🚀 Quick Start

### Option 1 — Docker (recommended)
```bash
cp .env.example .env          # optionally add ANTHROPIC_API_KEY
docker compose up --build
```
Open http://localhost:3000

### Option 2 — Run locally (4 terminals)

**Prerequisites:** Python 3.9+, Node 20+

```bash
# Terminal 1 — MCP Tool Server
cd backend && py -m venv venv && venv\Scripts\activate   # Windows
pip install -r requirements.txt
python mcp_server/main.py

# Terminal 2 — Search Agent
cd backend && venv\Scripts\activate
python search_agent/main.py

# Terminal 3 — Planner Agent
cd backend && venv\Scripts\activate
python planner_agent/main.py

# Terminal 4 — Frontend
cd frontend
cp .env.example .env.local
npm install && npm run dev
```

### Environment variables

| Variable | Where | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | `backend/.env` or root `.env` | Optional — uses mock responses if not set |
| `NEXT_PUBLIC_AGENT_URL` | `frontend/.env.local` | Default: `/api/agent` |
| `PLANNER_URL` | `frontend/.env.local` | Default: `http://localhost:8000/agent` |

### Port map

| Service | Port |
|---|---|
| Frontend | 3000 |
| Planner Agent | 8000 |
| MCP Tool Server | 8001 |
| Search Agent | 8002 |

---

---

## 🎯 Why we're building this

We've been researching the emerging AI agent protocol ecosystem — MCP, A2A, AG-UI, CopilotKit, and Vercel AI SDK. Rather than keeping this as theory, this POC gives us a concrete, working system that touches every protocol in the stack. By the end, every person on this team will have hands-on experience with all five layers.

This is a learning-first build. We're not shipping this to production. We're building it to understand it.

---

## 📐 What we're building

A **Two-Agent Research Assistant** — a web app where a user types a research question and two AI agents collaborate in real time to answer it.

```
User types: "What are the latest developments in AI agent protocols?"

┌─────────────────────────────────────────────────────────┐
│  Browser (React + CopilotKit)                           │
│                                                         │
│  Chat panel          │  Agent Activity panel            │
│  ─────────────────   │  ─────────────────────────────   │
│  User: What are...   │  🔵 Planner Agent — thinking     │
│                      │  🟡 Search Agent — searching...  │
│  Agent: [streaming   │  🔧 Tool: web_search("AI agent   │
│  tokens appear       │         protocols 2025")         │
│  here in real time]  │  ✓ Search Agent — done           │
│                      │  🔵 Planner Agent — writing      │
└─────────────────────────────────────────────────────────┘
```

### How it works (the full protocol flow)

```
1. User types question in the React frontend
         │
         │  CopilotKit + AG-UI (event stream)
         ▼
2. Planner Agent receives the question
         │
         │  A2A (agent-to-agent delegation)
         ▼
3. Search Agent receives a search task
         │
         │  MCP (tool call)
         ▼
4. web_search tool runs, returns results
         │
         │  A2A response back to Planner
         ▼
5. Planner synthesises and writes the answer
         │
         │  AG-UI (streaming events: tokens, state, steps)
         ▼
6. Frontend renders the answer token by token,
   Activity panel shows both agents' progress live
```

---

## 🧩 The five protocols — what each one does here

| Protocol | Role in this POC |
|---|---|
| **MCP** (Model Context Protocol) | The `web_search` tool is an MCP server. The Search Agent calls it to get results. |
| **A2A** (Agent-to-Agent) | The Planner Agent delegates search tasks to the Search Agent using the A2A protocol. |
| **AG-UI** (Agent-User Interaction) | The event stream between both agents and the React frontend. Carries text tokens, step events, tool calls, and state patches. |
| **CopilotKit** | The React framework wrapping the frontend. Provides chat UI components and consumes the AG-UI stream. |
| **Vercel AI SDK** | Used inside the agents to call the LLM (Claude / GPT). Handles `streamText` and tool use. |

---

## 🏗 System architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend  (Next.js + CopilotKit)          :3000                │
│  - CopilotChat component                                        │
│  - Agent Activity panel (STATE_DELTA events)                    │
└────────────────────────┬────────────────────────────────────────┘
                         │  POST /agent  (AG-UI over SSE)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Planner Agent  (Python + FastAPI)         :8000                │
│  - Receives user question via AG-UI                             │
│  - Calls Search Agent via A2A                                   │
│  - Synthesises answer, streams back via AG-UI                   │
│  - Emits STATE_DELTA: { active_agent, step, tool_calls }        │
└────────────────────────┬────────────────────────────────────────┘
                         │  A2A task delegation
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Search Agent  (Python + FastAPI)          :8002                │
│  - Exposes Agent Card at /.well-known/agent-card.json           │
│  - Receives search task from Planner via A2A                    │
│  - Calls MCP tool server to perform search                      │
│  - Streams results back to Planner via AG-UI                    │
└────────────────────────┬────────────────────────────────────────┘
                         │  MCP tool call
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  MCP Tool Server  (Python + FastMCP)       :8001                │
│  - Exposes web_search(query: str) tool                          │
│  - Returns: { results: [{title, url, snippet}] }                │
│  - Use mock data first, plug in real search API later           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 👥 Team assignments

### 🔧 Backend Developer
**Stack:** Python · FastAPI · FastMCP · ag-ui-python · Vercel AI SDK (Python)

| Task | Description | Protocol |
|---|---|---|
| **B1** | MCP Tool Server — FastMCP server exposing `web_search(query)` on port 8001. Start with mock data (hardcoded results). | MCP |
| **B2** | Search Agent — FastAPI app. Exposes Agent Card at `/.well-known/agent-card.json`. Receives A2A task → calls MCP tool → streams results via AG-UI. | A2A · MCP · AG-UI |
| **B3** | Planner Agent — Main agent on port 8000. Receives user question → delegates to Search Agent via A2A → synthesises answer → streams back via AG-UI. Emits `STATE_DELTA` with `{ active_agent, step }` so the frontend panel knows what's happening. | A2A · AG-UI |

**Key packages:**
```bash
pip install fastapi uvicorn fastmcp ag-ui-python anthropic
```

---

### 🎨 Frontend Developer
**Stack:** Next.js 14 · React · CopilotKit · TypeScript

| Task | Description | Protocol |
|---|---|---|
| **F1** | Scaffold — Next.js app + CopilotKit install. Two-panel layout: chat on the left, Agent Activity panel on the right. | — |
| **F2** | Chat + streaming — Wire `CopilotChat` to the Planner Agent endpoint (`http://localhost:8000/agent`). Tokens must appear character by character. Show a typing cursor during `TEXT_MESSAGE_CONTENT`. | AG-UI · CopilotKit |
| **F3** | Agent Activity panel — Subscribe to `STATE_DELTA` events. Show which agent is currently active, what step it's on, and any tool calls in progress. This is the "window into the agent stack". | AG-UI |

**Key packages:**
```bash
npm install @copilotkit/react-core @copilotkit/react-ui
```

---

### 🔗 Integration / QA
**Stack:** Docker · YAML · Bash · Any

| Task | Description |
|---|---|
| **I1** ⚡ **Do this first** | Shared contracts — define the Agent Card JSON, AG-UI endpoint shape, MCP tool schema, and `STATE_DELTA` payload in a `contracts/` folder. Commit before anyone writes agent code. Both BE and FE import types from here. |
| **I2** | Docker Compose — one `docker compose up` starts all four services (MCP server, Search Agent, Planner Agent, Frontend). Write a `docker-compose.yml` with correct port mappings and health checks. |
| **I3** | E2E test + demo — Run a real question through the full system. Verify: streaming works, A2A delegation appears in Planner logs, MCP tool is called, state panel updates in the browser. Record a short Loom or screen capture. |

---

## 📋 Interface contracts

> **These must be agreed before writing agent code (Task I1).** Put them in `contracts/README.md`.

### A2A Agent Card — Search Agent
```json
{
  "name": "Search Agent",
  "description": "Performs web search and returns structured results",
  "url": "http://localhost:8002",
  "version": "1.0.0",
  "capabilities": ["text"],
  "skills": [
    {
      "id": "web_search",
      "description": "Search the web for a given query and return top results"
    }
  ]
}
```
Published at: `http://localhost:8002/.well-known/agent-card.json`

---

### MCP Tool Schema — web_search
```python
# contracts/tools.py
# Both agents import this shape

def web_search(query: str) -> dict:
    """
    Returns:
    {
        "results": [
            {
                "title": str,
                "url": str,
                "snippet": str
            }
        ]
    }
    """
```

---

### AG-UI Endpoint — Planner Agent
```
POST http://localhost:8000/agent
Content-Type: application/json

Body:
{
    "thread_id": "string",
    "messages": [
        { "role": "user", "content": "string" }
    ]
}

Response: text/event-stream

Events emitted (in order):
  RUN_STARTED
  STEP_STARTED        { name: "Delegating to Search Agent" }
  STATE_DELTA         { active_agent: "search", step: "searching..." }
  TOOL_CALL_START     { tool_call_id, tool_name: "web_search" }
  TOOL_CALL_END       { tool_call_id }
  STATE_DELTA         { active_agent: "planner", step: "writing answer" }
  STEP_FINISHED
  TEXT_MESSAGE_START
  TEXT_MESSAGE_CONTENT  (repeated, one per token)
  TEXT_MESSAGE_END
  RUN_FINISHED
```

---

### STATE_DELTA payload — for the Activity panel
```json
{
  "active_agent": "planner | search | idle",
  "step": "string — human readable current step label",
  "tool_calls": [
    { "name": "web_search", "status": "running | done", "query": "string" }
  ]
}
```

---

## 📅 Timeline

| | Day 1 | Day 2 | Day 3 |
|---|---|---|---|
| **Backend** | B1 — MCP server working, returns mock data | B2 — Search Agent streams via AG-UI | B3 — Planner delegates to Search via A2A |
| **Frontend** | F1 — Scaffold + layout | F2 — Chat streams tokens | F3 — Activity panel reacts to state |
| **Integration** | I1 — Contracts defined and merged ⚡ | I2 — Docker Compose working | I3 — Full E2E test + Loom |

**Key checkpoints:**
- **EOD Day 1:** Contracts merged. MCP server returns mock data. Scaffold runs at localhost:3000.
- **EOD Day 2:** Search Agent streams AG-UI events. Chat UI renders tokens. Can demo half the flow.
- **EOD Day 3:** Full question flows through both agents. Activity panel shows live state. Demo recorded.

---

## ✅ Definition of Done

The POC is complete when **all** of the following are true:

**Backend**
- [x] MCP server returns search results for any query on port 8001
- [x] Search Agent exposes a valid Agent Card at `/.well-known/agent-card.json`
- [x] Search Agent streams AG-UI events when called by the Planner
- [x] Planner Agent delegates to Search Agent via A2A (visible in server logs)
- [x] Planner Agent emits `STATE_DELTA` with active agent name and current step

**Frontend**
- [x] User types a question, tokens stream into the chat bubble in real time
- [x] Agent Activity panel shows which agent is active and what step it's on
- [x] Tool call indicator visible while `web_search` is running

**Integration**
- [x] `docker compose up` starts all services with no manual steps
- [x] Full question → answer flow works end-to-end (live at https://two-agent-research-assistant.vercel.app/)
- [ ] Loom / screen recording of the working demo committed to the repo
- [x] `README.md` with setup instructions committed

---

## 📁 Suggested repo structure

```
two-agent-research/
├── contracts/
│   ├── README.md          ← Interface contracts (do this first)
│   ├── agent_card.json    ← Search Agent A2A card
│   └── tools.py           ← Shared tool schemas
│
├── backend/
│   ├── mcp_server/        ← FastMCP tool server (B1)
│   │   └── main.py
│   ├── search_agent/      ← Search Agent (B2)
│   │   └── main.py
│   └── planner_agent/     ← Planner Agent (B3)
│       └── main.py
│
├── frontend/              ← Next.js + CopilotKit (F1-F3)
│   ├── app/
│   │   ├── page.tsx
│   │   └── api/
│   └── components/
│       ├── ChatPanel.tsx
│       └── ActivityPanel.tsx
│
├── docker-compose.yml     ← All services (I2)
└── README.md              ← Setup guide (I3)
```

---

## 🔗 Reference links

| Resource | URL |
|---|---|
| AG-UI documentation | https://docs.ag-ui.com |
| AG-UI GitHub | https://github.com/ag-ui-protocol/ag-ui |
| CopilotKit docs | https://docs.copilotkit.ai |
| FastMCP | https://github.com/jlowin/fastmcp |
| A2A specification | https://google.github.io/A2A |
| MCP specification | https://modelcontextprotocol.io |
| Vercel AI SDK | https://ai-sdk.dev |

---

## 💬 Questions?

Ping **Hamza** on Slack. If you hit a wall on protocol behaviour, drop the specific event type or error in the channel and we'll debug together.

> *This POC was designed as a practical follow-up to our AI agent protocol research session. The goal is one working demo that everyone on the team can point to and say — I built that part, and I understand how it connects to the rest.*
