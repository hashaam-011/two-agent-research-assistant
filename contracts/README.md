# Interface Contracts

Agreed-upon shapes for all services. **Do not change these without notifying the whole team.**

> **Python version:** All `.py` contract files require **Python 3.9+** (uses `list[...]` lowercase generics and `Literal`).

---

## 1. A2A Agent Card — Search Agent

File: `agent_card.json`
Published at: `http://localhost:8002/.well-known/agent-card.json`

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

---

## 2. MCP Tool Schema — web_search

File: `tools.py`

```python
def web_search(query: str) -> WebSearchResponse:
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

## 3. AG-UI Endpoint — Planner Agent

File: `planner_request.py`

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
  STATE_DELTA         { active_agent: "search", step: "searching...", tool_calls: [...] }
  TOOL_CALL_START     { tool_call_id, tool_name: "web_search" }
  TOOL_CALL_END       { tool_call_id }
  STATE_DELTA         { active_agent: "planner", step: "writing answer", tool_calls: [...] }
  STEP_FINISHED
  TEXT_MESSAGE_START
  TEXT_MESSAGE_CONTENT  (repeated, one per token)
  TEXT_MESSAGE_END
  RUN_FINISHED
```

---

## 4. STATE_DELTA Payload — Activity Panel

File: `state_delta.py`

```json
{
  "active_agent": "planner | search | idle",
  "step": "string — human readable current step label",
  "tool_calls": [
    {
      "id": "string",
      "name": "web_search",
      "status": "running | done | error",
      "query": "string",
      "resultsCount": "number | null"
    }
  ]
}
```

---

## Port Map

| Service         | Port |
|-----------------|------|
| Planner Agent   | 8000 |
| MCP Tool Server | 8001 |
| Search Agent    | 8002 |
| Frontend        | 3000 |
