"""Search Agent — A2A-compatible agent that performs web search via MCP."""

import json
import os
import uuid

import uvicorn
from fastapi import FastAPI
from fastapi.responses import JSONResponse, StreamingResponse
from fastmcp import Client
from pydantic import BaseModel

# --- Configuration via env vars ---
MCP_SERVER_URL = os.getenv("MCP_SERVER_URL", "http://localhost:8001/sse")
SEARCH_AGENT_HOST = os.getenv("SEARCH_AGENT_HOST", "127.0.0.1")
SEARCH_AGENT_PORT = int(os.getenv("SEARCH_AGENT_PORT", "8002"))

# --- Agent Card (A2A protocol) ---
AGENT_CARD = {
    "name": "Search Agent",
    "description": "Performs web search and returns structured results",
    "url": f"http://localhost:{SEARCH_AGENT_PORT}",
    "version": "1.0.0",
    "capabilities": ["text"],
    "skills": [
        {
            "id": "web_search",
            "description": "Search the web for a given query and return top results",
        }
    ],
}


# --- FastAPI App ---
app = FastAPI(
    title="Search Agent",
    description=(
        "A2A-compatible Search Agent. Receives search tasks, calls MCP Tool Server, "
        "streams AG-UI events back to caller."
    ),
    version="1.0.0",
)


# --- Helper: format SSE event ---
def sse_event(event_type: str, data: dict) -> str:
    """Format a Server-Sent Event string."""
    payload = json.dumps(data)
    return f"event: {event_type}\ndata: {payload}\n\n"


@app.get("/.well-known/agent-card.json", tags=["A2A"])
def agent_card():
    """A2A Agent Card — describes this agent's capabilities."""
    return AGENT_CARD


@app.get("/health", tags=["Health"])
def health():
    """Liveness check."""
    return {"status": "ok"}


class TaskRequest(BaseModel):
    """A2A task request from Planner Agent."""

    task_id: str = "default-task"
    skill: str = "web_search"
    query: str


@app.post("/tasks", tags=["A2A"])
async def receive_task(task: TaskRequest):
    """
    A2A Task endpoint — receives a search task from Planner Agent.
    Returns search results from MCP Tool Server (plain JSON response).
    """
    if task.skill != "web_search":
        return JSONResponse(
            status_code=400,
            content={
                "task_id": task.task_id,
                "status": "error",
                "message": f"Unknown skill: {task.skill}. Only 'web_search' is supported.",
            },
        )

    if not task.query:
        return JSONResponse(
            status_code=400,
            content={
                "task_id": task.task_id,
                "status": "error",
                "message": "Query is required.",
            },
        )

    # Call MCP Tool Server
    try:
        async with Client(MCP_SERVER_URL) as mcp_client:
            result = await mcp_client.call_tool("web_search", {"query": task.query})
            search_results = result.data if result.data else {}
    except Exception as e:
        return JSONResponse(
            status_code=502,
            content={
                "task_id": task.task_id,
                "status": "error",
                "message": f"MCP Tool Server call failed: {str(e)}",
            },
        )

    return {
        "task_id": task.task_id,
        "status": "completed",
        "result": search_results,
    }


@app.post("/tasks/stream", tags=["AG-UI"])
async def receive_task_stream(task: TaskRequest):
    """
    AG-UI streaming endpoint — streams SSE events for real-time progress.

    Events emitted:
    - STEP_STARTED
    - STATE_DELTA (active_agent: search, step: searching)
    - TOOL_CALL_START (web_search)
    - TOOL_CALL_END (web_search + results)
    - STATE_DELTA (active_agent: search, step: done)
    - STEP_FINISHED
    """
    if task.skill != "web_search":
        return JSONResponse(
            status_code=400,
            content={
                "task_id": task.task_id,
                "status": "error",
                "message": f"Unknown skill: {task.skill}. Only 'web_search' is supported.",
            },
        )

    if not task.query:
        return JSONResponse(
            status_code=400,
            content={
                "task_id": task.task_id,
                "status": "error",
                "message": "Query is required.",
            },
        )

    async def event_stream():
        tool_call_id = str(uuid.uuid4())

        yield sse_event(
            "STEP_STARTED",
            {
                "name": "Searching the web",
                "task_id": task.task_id,
            },
        )

        yield sse_event(
            "STATE_DELTA",
            {
                "active_agent": "search",
                "step": f"Searching for: {task.query}",
                "tool_calls": [
                    {"name": "web_search", "status": "running", "query": task.query}
                ],
            },
        )

        yield sse_event(
            "TOOL_CALL_START",
            {
                "tool_call_id": tool_call_id,
                "tool_name": "web_search",
                "arguments": {"query": task.query},
            },
        )

        # Call MCP Tool Server
        try:
            async with Client(MCP_SERVER_URL) as mcp_client:
                result = await mcp_client.call_tool("web_search", {"query": task.query})
                search_results = result.data if result.data else {}
        except Exception as e:
            yield sse_event(
                "ERROR",
                {
                    "task_id": task.task_id,
                    "message": f"MCP Tool Server call failed: {str(e)}",
                },
            )
            return

        yield sse_event(
            "TOOL_CALL_END",
            {
                "tool_call_id": tool_call_id,
                "tool_name": "web_search",
                "result": search_results,
            },
        )

        yield sse_event(
            "STATE_DELTA",
            {
                "active_agent": "search",
                "step": "Search complete",
                "tool_calls": [
                    {"name": "web_search", "status": "done", "query": task.query}
                ],
            },
        )

        yield sse_event(
            "STEP_FINISHED",
            {
                "name": "Searching the web",
                "task_id": task.task_id,
                "result": search_results,
            },
        )

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


if __name__ == "__main__":
    uvicorn.run(app, host=SEARCH_AGENT_HOST, port=SEARCH_AGENT_PORT)
