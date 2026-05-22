# Two-Agent Research Assistant
### AI Agent Protocol Stack · Internal Research Sprint

> **Status:** Live · **Sprint:** 3 days · **Team size:** 3 people

---

## Live Demo

| Service | Platform | URL |
|---|---|---|
| **Frontend** | Vercel | https://two-agent-research-assistant.vercel.app/ |
| **Planner Agent** | Hugging Face Spaces | https://hashaam18-planneragent.hf.space |
| **Search Agent** | Hugging Face Spaces | https://hashaam18-searchagent.hf.space |
| **MCP Tool Server** | Render | https://two-agent-research-assistant-1.onrender.com |

### How to demo
1. Open https://two-agent-research-assistant.vercel.app/
2. Type any research question — e.g. *"What are the latest developments in AI agents?"*
3. Watch the **Agent Activity panel** on the right:
   - Planner Agent starts and delegates to Search Agent
   - Search Agent calls the `web_search` tool via MCP
   - Results bubble back to Planner
   - Answer streams token by token into the chat
4. Raw SSE event stream: https://hashaam18-planneragent.hf.space/docs → POST `/agent`
5. A2A Agent Card: https://hashaam18-searchagent.hf.space/.well-known/agent-card.json

### Deployment notes
- MCP Tool Server is on Render free tier — first query may take ~30s if it has been idle (cold start)
- Real AI answers require `ANTHROPIC_API_KEY` added as a secret on the Planner HF Space. Without it, the planner uses a mock response that summarises search results
- Frontend auto-deploys from `main` branch on Vercel

---

## What we built

A **Two-Agent Research Assistant** — a web app where a user types a research question and two AI agents collaborate in real time to answer it. The system demonstrates five AI agent protocols working together in one coherent flow.

```
User types: "What are the latest developments in AI agent protocols?"

┌─────────────────────────────────────────────────────────┐
│  Browser (Next.js + CopilotKit)                         │
│                                                         │
│  Chat panel          │  Agent Activity panel            │
│  ─────────────────   │  ─────────────────────────────   │
│  User: What are...   │  Planner Agent — thinking        │
│                      │  Search Agent  — searching...    │
│  Agent: [streaming   │  Tool: web_search("AI agent      │
│  tokens appear       │        protocols 2025")          │
│  here in real time]  │  Search Agent  — done            │
│                      │  Planner Agent — writing         │
└─────────────────────────────────────────────────────────┘
```

### Full protocol flow

```
1. User types question in the React frontend
         │
         │  AG-UI  (SSE event stream)
         ▼
2. Planner Agent receives the question
         │
         │  A2A  (agent-to-agent task delegation)
         ▼
3. Search Agent receives a search task
         │
         │  MCP  (tool call)
         ▼
4. web_search tool runs, returns results
         │
         │  A2A  (response back to Planner)
         ▼
5. Planner synthesises and writes the answer
         │
         │  AG-UI  (streaming: tokens, state, steps)
         ▼
6. Frontend renders answer token by token
   Activity panel shows both agents live
```

---

## The five protocols

| Protocol | Role in this project |
|---|---|
| **MCP** (Model Context Protocol) | The `web_search` tool is an MCP server. The Search Agent calls it to get results. |
| **A2A** (Agent-to-Agent) | The Planner Agent delegates search tasks to the Search Agent using the A2A protocol. The Search Agent advertises itself via an Agent Card at `/.well-known/agent-card.json`. |
| **AG-UI** (Agent-User Interaction) | The SSE event stream between the agents and the React frontend. Carries text tokens, step events, tool calls, and state patches. |
| **CopilotKit** | The React framework wrapping the frontend. Provides chat UI components and consumes the AG-UI stream. |
| **Vercel AI SDK** | Used inside the agents to call the LLM (Claude). Handles streaming and tool use. |

---

## System architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend  (Next.js + CopilotKit)          Vercel               │
│  - Chat panel (streaming tokens)                                │
│  - Agent Activity panel (STATE_DELTA events)                    │
│  - /api/agent route proxies to Planner (avoids CORS)           │
└────────────────────────┬────────────────────────────────────────┘
                         │  POST /agent  (AG-UI over SSE)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Planner Agent  (Python + FastAPI)         HF Spaces :7860      │
│  - Receives user question via AG-UI                             │
│  - Delegates to Search Agent via A2A                            │
│  - Synthesises answer, streams back via AG-UI                   │
│  - Emits STATE_DELTA: { active_agent, step, tool_calls }        │
└────────────────────────┬────────────────────────────────────────┘
                         │  POST /tasks  (A2A)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Search Agent  (Python + FastAPI)          HF Spaces :7860      │
│  - Exposes Agent Card at /.well-known/agent-card.json           │
│  - Receives search task from Planner via A2A                    │
│  - Calls MCP tool server to run the search                      │
└────────────────────────┬────────────────────────────────────────┘
                         │  MCP tool call (SSE)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  MCP Tool Server  (Python + FastMCP)       Render :8001         │
│  - Exposes web_search(query: str) tool                          │
│  - Returns: { results: [{title, url, snippet}] }                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Repo structure

```
two-agent-research-assistant/
├── contracts/
│   ├── README.md              ← Interface contracts
│   ├── agent_card.json        ← Search Agent A2A card
│   ├── planner_request.py     ← AG-UI request shape
│   ├── state_delta.py         ← STATE_DELTA payload shape
│   └── tools.py               ← Shared MCP tool schema
│
├── backend/
│   ├── mcp_server/            ← FastMCP tool server
│   │   ├── main.py
│   │   └── Dockerfile
│   ├── search_agent/          ← Search Agent
│   │   ├── main.py
│   │   └── Dockerfile
│   ├── planner_agent/         ← Planner Agent
│   │   ├── main.py
│   │   └── Dockerfile
│   └── requirements.txt
│
├── planneragent/              ← HF Space for Planner
│   ├── planner_agent/
│   │   └── main.py
│   ├── requirements.txt
│   └── Dockerfile
│
├── searchagent/               ← HF Space for Search Agent
│   ├── search_agent/
│   │   └── main.py
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/                  ← Next.js + CopilotKit
│   ├── app/
│   │   ├── page.tsx
│   │   └── api/agent/route.ts ← Proxy to Planner Agent
│   ├── components/
│   │   ├── chat-bubble.tsx
│   │   └── agent-flow.tsx
│   └── .env.example
│
├── docker-compose.yml         ← Local dev: all 4 services
└── README.md
```

---

## Quick Start (local)

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
cd backend
python -m venv venv && venv\Scripts\activate   # Windows
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

| Variable | Where | Value |
|---|---|---|
| `ANTHROPIC_API_KEY` | `backend/.env` | Optional — uses mock if not set |
| `NEXT_PUBLIC_AGENT_URL` | `frontend/.env.local` | `/api/agent` |
| `PLANNER_URL` | `frontend/.env.local` | `http://localhost:8000/agent` |

### Local port map

| Service | Port |
|---|---|
| Frontend | 3000 |
| Planner Agent | 8000 |
| MCP Tool Server | 8001 |
| Search Agent | 8002 |

---

## Interface contracts

### A2A Agent Card — Search Agent
Published at `/.well-known/agent-card.json`
```json
{
  "name": "Search Agent",
  "description": "Performs web search and returns structured results",
  "url": "http://localhost:8002",
  "version": "1.0.0",
  "capabilities": {
    "streaming": false,
    "pushNotifications": false,
    "stateTransitionHistory": false
  },
  "skills": [
    {
      "id": "web_search",
      "name": "Web Search",
      "description": "Search the web for a given query and return top results"
    }
  ]
}
```

### AG-UI Endpoint — Planner Agent
```
POST /agent
Content-Type: application/json

{
  "thread_id": "string",
  "messages": [{ "role": "user", "content": "string" }]
}

Response: text/event-stream

RUN_STARTED
STEP_STARTED        { name: "Delegating to Search Agent" }
STATE_DELTA         { active_agent: "search", step: "searching...", tool_calls: [...] }
TOOL_CALL_START     { tool_call_id, tool_name: "web_search", arguments: { query } }
TOOL_CALL_END       { tool_call_id, tool_name, result }
STATE_DELTA         { active_agent: "planner", step: "writing answer", tool_calls: [...] }
STEP_FINISHED
TEXT_MESSAGE_START
TEXT_MESSAGE_CONTENT  (×N — one per token)
TEXT_MESSAGE_END
RUN_FINISHED
```

### MCP Tool Schema
```python
def web_search(query: str) -> dict:
    """Returns: { "results": [{ "title": str, "url": str, "snippet": str }] }"""
```

---

## Definition of Done

**Backend**
- [x] MCP server returns search results for any query
- [x] Search Agent exposes a valid Agent Card at `/.well-known/agent-card.json`
- [x] Search Agent streams AG-UI events when called by the Planner
- [x] Planner Agent delegates to Search Agent via A2A
- [x] Planner Agent emits `STATE_DELTA` with active agent and current step

**Frontend**
- [x] User types a question, tokens stream into the chat bubble in real time
- [x] Agent Activity panel shows which agent is active and what step it's on
- [x] Tool call indicator visible while `web_search` is running

**Integration**
- [x] `docker compose up` starts all services with no manual steps
- [x] Full question → answer flow works end-to-end (live at https://two-agent-research-assistant.vercel.app/)
- [x] README with setup instructions and deployment details
- [ ] Loom / screen recording of the working demo

---

## Timeline

| | Day 1 | Day 2 | Day 3 |
|---|---|---|---|
| **Backend** | MCP server + mock data | Search Agent streams AG-UI | Planner delegates via A2A |
| **Frontend** | Scaffold + layout | Chat streams tokens | Activity panel reacts to state |
| **Integration** | Contracts defined | Docker Compose | E2E live deployment |

---

## Team

| Role | Responsibilities |
|---|---|
| **Backend** | MCP Tool Server, Search Agent, Planner Agent |
| **Frontend** | Next.js app, CopilotKit chat, Agent Activity panel |
| **Integration** | Contracts, Docker Compose, deployment, E2E testing |

---

## Reference links

| Resource | URL |
|---|---|
| AG-UI documentation | https://docs.ag-ui.com |
| AG-UI GitHub | https://github.com/ag-ui-protocol/ag-ui |
| CopilotKit docs | https://docs.copilotkit.ai |
| FastMCP | https://github.com/jlowin/fastmcp |
| A2A specification | https://google.github.io/A2A |
| MCP specification | https://modelcontextprotocol.io |
| Vercel AI SDK | https://ai-sdk.dev |
