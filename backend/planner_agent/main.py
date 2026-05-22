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
MODEL_ID = "claude-sonnet-4-6"


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
    payload = json.dumps(data)
    return f"event: {event_type}\ndata: {payload}\n\n"


# --- LLM token streaming ---
async def stream_llm_tokens(
    query: str, search_results: dict
) -> AsyncGenerator[str, None]:
    """Stream tokens from LLM if key available, else mock with delay.
    Raises RuntimeError on LLM failure so the caller can emit RUN_ERROR.
    """
    if ANTHROPIC_API_KEY:
        try:
            from anthropic import Anthropic

            client = Anthropic(api_key=ANTHROPIC_API_KEY)
            results_text = json.dumps(search_results.get("results", []), indent=2)

            with client.messages.stream(
                model=MODEL_ID,
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
            raise RuntimeError(f"LLM error: {e}") from e

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
    return {"status": "ok"}


@app.post("/agent", tags=["AG-UI"])
async def agent_endpoint(request: PlannerRequest):
    """
    AG-UI endpoint — receives user question, orchestrates search, streams response.

    Emits spec-compliant AG-UI SSE events:
    RUN_STARTED, STEP_STARTED, STATE_SNAPSHOT, TOOL_CALL_START, TOOL_CALL_ARGS,
    TOOL_CALL_END, TOOL_CALL_RESULT, STEP_FINISHED, TEXT_MESSAGE_START,
    TEXT_MESSAGE_CONTENT, TEXT_MESSAGE_END, RUN_FINISHED / RUN_ERROR.
    """
    user_message = ""
    for msg in reversed(request.messages):
        if msg.role == "user":
            user_message = msg.content
            break

    if not user_message:
        return StreamingResponse(
            iter([sse_event("RUN_ERROR", {"message": "No user message found."})]),
            media_type="text/event-stream",
        )

    async def event_stream():
        run_id = str(uuid.uuid4())
        tool_call_id = str(uuid.uuid4())
        msg_id = str(uuid.uuid4())
        result_msg_id = str(uuid.uuid4())

        # 1. RUN_STARTED — spec requires thread_id + run_id
        yield sse_event(
            "RUN_STARTED", {"thread_id": request.thread_id, "run_id": run_id}
        )

        # 2. STEP_STARTED — spec field: step_name (not name)
        yield sse_event("STEP_STARTED", {"step_name": "Delegating to Search Agent"})

        # 3. STATE_SNAPSHOT — our custom state shape wrapped in `snapshot`
        #    (STATE_DELTA requires RFC 6902 JSON Patch; use STATE_SNAPSHOT instead)
        yield sse_event(
            "STATE_SNAPSHOT",
            {
                "snapshot": {
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
                }
            },
        )

        # 4. TOOL_CALL_START — spec: tool_call_name (not tool_name); no args here
        yield sse_event(
            "TOOL_CALL_START",
            {"tool_call_id": tool_call_id, "tool_call_name": "web_search"},
        )

        # 5. TOOL_CALL_ARGS — spec: separate event; delta is a JSON-encoded string
        yield sse_event(
            "TOOL_CALL_ARGS",
            {
                "tool_call_id": tool_call_id,
                "delta": json.dumps({"query": user_message}),
            },
        )

        # 6. Call Search Agent via A2A
        search_results: dict = {}
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
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
                        "RUN_ERROR",
                        {"message": f"Search Agent returned {response.status_code}"},
                    )
                    return
        except Exception as e:
            yield sse_event(
                "RUN_ERROR", {"message": f"Search Agent call failed: {str(e)}"}
            )
            return

        results_count = len(search_results.get("results", []))

        # 7. TOOL_CALL_END — spec: only tool_call_id
        yield sse_event("TOOL_CALL_END", {"tool_call_id": tool_call_id})

        # 8. TOOL_CALL_RESULT — spec: message_id + tool_call_id + content (JSON string)
        yield sse_event(
            "TOOL_CALL_RESULT",
            {
                "message_id": result_msg_id,
                "tool_call_id": tool_call_id,
                "content": json.dumps(search_results),
                "role": "tool",
            },
        )

        # 9. STATE_SNAPSHOT — planner writing answer
        yield sse_event(
            "STATE_SNAPSHOT",
            {
                "snapshot": {
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
                }
            },
        )

        # 10. STEP_FINISHED — spec field: step_name (not name)
        yield sse_event("STEP_FINISHED", {"step_name": "Delegating to Search Agent"})

        # 11. TEXT_MESSAGE_START — message_id + role required by spec
        yield sse_event(
            "TEXT_MESSAGE_START", {"message_id": msg_id, "role": "assistant"}
        )

        # 12. TEXT_MESSAGE_CONTENT — spec: delta (not content) + message_id
        try:
            async for token in stream_llm_tokens(user_message, search_results):
                yield sse_event(
                    "TEXT_MESSAGE_CONTENT", {"message_id": msg_id, "delta": token}
                )
        except RuntimeError as e:
            yield sse_event("TEXT_MESSAGE_END", {"message_id": msg_id})
            yield sse_event("RUN_ERROR", {"message": str(e)})
            return

        # 13. TEXT_MESSAGE_END — message_id required by spec
        yield sse_event("TEXT_MESSAGE_END", {"message_id": msg_id})

        # 14. RUN_FINISHED — spec requires thread_id + run_id
        yield sse_event(
            "RUN_FINISHED", {"thread_id": request.thread_id, "run_id": run_id}
        )

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
