# Backend — Two-Agent Research Assistant

FastAPI + FastMCP backend for the Two-Agent Research Assistant POC.

## Tech stack

- Python 3.13 (3.12 also supported)
- FastAPI + Pydantic v2
- FastMCP (MCP tool server)
- ag-ui-protocol (AG-UI event streaming)
- Anthropic SDK (LLM calls)
- uvicorn (ASGI server)

## Setup

```bash
cd backend
py -m venv venv

# Windows
venv\Scripts\activate

# Unix / macOS
source venv/bin/activate

pip install -r requirements.txt
```

## Environment variables

Copy the example env file:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | _(empty)_ | Anthropic API key for LLM. If not set, mock response is used |

## Run locally

### MCP Tool Server (Port 8001)

```bash
python mcp_server/main.py
```

Pure MCP server — no Swagger. Connects via MCP protocol (SSE transport).

### Search Agent (Port 8002)

```bash
python search_agent/main.py
```

Open <http://localhost:8002/docs> for the Swagger UI.

### Planner Agent (Port 8000)

```bash
python planner_agent/main.py
```

Open <http://localhost:8000/docs> for the Swagger UI.

## Services overview

| Service | Port | Protocol | Swagger | Description |
|---------|------|----------|---------|-------------|
| MCP Tool Server | 8001 | MCP (SSE) | No | Exposes `web_search(query)` tool, returns mock results |
| Search Agent | 8002 | A2A + MCP + AG-UI | Yes | Agent Card + receives tasks + calls MCP tool |
| Planner Agent | 8000 | A2A + AG-UI | Yes | Orchestrator, delegates to Search Agent, streams to frontend |

## Project layout

```
backend/
├── requirements.txt
├── README.md
├── mcp_server/
│   └── main.py          ← FastMCP tool server (B1) — MCP protocol only
├── search_agent/
│   └── main.py          ← Search Agent (B2) — FastAPI + Swagger
└── planner_agent/
    └── main.py          ← Planner Agent (B3) — FastAPI + Swagger
```
