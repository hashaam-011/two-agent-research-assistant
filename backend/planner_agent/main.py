"""Planner Agent — orchestrates Search Agent and streams AG-UI events to frontend."""

import asyncio
import json
import os
import uuid
from collections.abc import AsyncGenerator

import httpx
import uvicorn
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

# --- Configuration ---
SEARCH_AGENT_URL = os.getenv("SEARCH_AGENT_URL", "http://localhost:8002")
PLANNER_HOST = os.getenv("PLANNER_HOST", "127.0.0.1")
PLANNER_PORT = int(os.getenv("PLANNER_PORT", "8000"))
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")


# --- FastAPI App ---
app = FastAPI(
    title="Planner Agent",
    description=(
        "Main orchestrator agent. Receives user questions via AG-UI, "
        "delegates to Search Agent via A2A, synthesizes answer, "
        "streams back via AG-UI SSE events."
    ),
    version="1.0.0",
)


# --- Pydantic models (aligned with contracts/planner_request.py) ---
class PlannerMessage(BaseModel):
    role: str
    content: str


class PlannerRequest(BaseModel):
    thread_id: str = "default-thread"
    messages: list[PlannerMessage]


# --- Helper: format SSE event ---
def sse_event(event_type: str, data: dict) -> str:
    """Format a Server-Sent Event string."""
    payload = json.dumps(data)
    return f"event: {event_type}\ndata: {payload}\n\n"


# --- LLM token streaming ---
async def stream_llm_tokens(
    query: str, search_results: dict
) -> AsyncGenerator[str, None]:
    """Stream tokens from LLM if key available, else mock with delay."""
    if ANTHROPIC_API_KEY:
        try:
            from anthropic import Anthropic

            client = Anthropic(api_key=ANTHROPIC_API_KEY)
            results_text = json.dumps(search_results.get("results", []), indent=2)

            with client.messages.stream(
                model="claude-sonnet-4-20250514",
                max_tokens=1024,
                messages=[
                    {
                        "role": "user",
                        "content": (
                            f"Based on the following search results, provide a comprehensive "
                            f"answer to the question: '{query}'\n\n"
                            f"Search Results:\n{results_text}\n\n"
                            f"Provide a clear, well-structured answer."
                        ),
                    }
                ],
            ) as stream:
                for text in stream.text_stream:
                    yield text
            return
        except Exception as e:
            yield f"LLM error: {e}. "

    # Fallback: mock response with artificial delay
    results = search_results.get("results", [])
    summary_parts = [
        f"Based on my research about '{query}', here are the key findings:\n"
    ]
    for i, result in enumerate(results, 1):
        summary_parts.append(f"{i}. **{result.get('title', 'Untitled')}**")
        summary_parts.append(
            f"   {result.get('snippet', 'No description available.')}\n"
        )
    summary_parts.append(
        "These sources provide a comprehensive overview of the topic "
        "with recent developments and practical resources."
    )
    answer = "\n".join(summary_parts)
    for token in answer.split(" "):
        yield token + " "
        await asyncio.sleep(0.05)


# --- Endpoints ---
@app.get("/health", tags=["Health"])
def health():
    """Liveness check."""
    return {"status": "ok"}


@app.post("/agent", tags=["AG-UI"])
async def agent_endpoint(request: PlannerRequest):
    """
    AG-UI endpoint — receives user question, orchestrates search, streams response.

    This is the main endpoint the frontend connects to.
    Streams SSE events: RUN_STARTED, STEP_STARTED, STATE_DELTA,
    TOOL_CALL_START, TOOL_CALL_END, TEXT_MESSAGE_START,
    TEXT_MESSAGE_CONTENT, TEXT_MESSAGE_END, STEP_FINISHED, RUN_FINISHED.
    """
    # Extract the latest user message
    user_message = ""
    for msg in reversed(request.messages):
        if msg.role == "user":
            user_message = msg.content
            break

    if not user_message:
        return StreamingResponse(
            iter([sse_event("ERROR", {"message": "No user message found."})]),
            media_type="text/event-stream",
        )

    async def event_stream():
        run_id = str(uuid.uuid4())
        tool_call_id = str(uuid.uuid4())

        # 1. RUN_STARTED
        yield sse_event("RUN_STARTED", {"run_id": run_id})

        # 2. STEP_STARTED — delegating to search
        yield sse_event(
            "STEP_STARTED",
            {"name": "Delegating to Search Agent"},
        )

        # 3. STATE_DELTA — search agent active
        yield sse_event(
            "STATE_DELTA",
            {
                "active_agent": "search",
                "step": "searching...",
                "tool_calls": [
                    {
                        "id": tool_call_id,
                        "name": "web_search",
                        "status": "running",
                        "query": user_message,
                        "resultsCount": None,
                    }
                ],
            },
        )

        # 4. TOOL_CALL_START
        yield sse_event(
            "TOOL_CALL_START",
            {
                "tool_call_id": tool_call_id,
                "tool_name": "web_search",
                "arguments": {"query": user_message},
            },
        )

        # 5. Call Search Agent via A2A
        search_results = {}
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{SEARCH_AGENT_URL}/tasks",
                    json={
                        "task_id": run_id,
                        "skill": "web_search",
                        "query": user_message,
                    },
                )
                if response.status_code == 200:
                    data = response.json()
                    search_results = data.get("result", {})
                else:
                    yield sse_event(
                        "ERROR",
                        {"message": f"Search Agent returned {response.status_code}"},
                    )
                    return
        except Exception as e:
            yield sse_event(
                "ERROR",
                {"message": f"Search Agent call failed: {str(e)}"},
            )
            return

        # 6. TOOL_CALL_END
        results_count = len(search_results.get("results", []))
        yield sse_event(
            "TOOL_CALL_END",
            {
                "tool_call_id": tool_call_id,
                "tool_name": "web_search",
                "result": search_results,
            },
        )

        # 7. STATE_DELTA — planner writing answer
        yield sse_event(
            "STATE_DELTA",
            {
                "active_agent": "planner",
                "step": "writing answer",
                "tool_calls": [
                    {
                        "id": tool_call_id,
                        "name": "web_search",
                        "status": "done",
                        "query": user_message,
                        "resultsCount": results_count,
                    }
                ],
            },
        )

        # 8. STEP_FINISHED
        yield sse_event("STEP_FINISHED", {"name": "Delegating to Search Agent"})

        # 9. TEXT_MESSAGE_START
        yield sse_event("TEXT_MESSAGE_START", {"message_id": str(uuid.uuid4())})

        # 10. TEXT_MESSAGE_CONTENT — stream tokens from LLM or mock
        # With real LLM: tokens arrive naturally with network delay
        # With mock: artificial asyncio.sleep simulates streaming
        async for token in stream_llm_tokens(user_message, search_results):
            yield sse_event("TEXT_MESSAGE_CONTENT", {"content": token})

        # 11. TEXT_MESSAGE_END
        yield sse_event("TEXT_MESSAGE_END", {})

        # 12. RUN_FINISHED
        yield sse_event("RUN_FINISHED", {"run_id": run_id})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Transfer-Encoding": "chunked",
        },
    )


if __name__ == "__main__":
    uvicorn.run(app, host=PLANNER_HOST, port=PLANNER_PORT)
