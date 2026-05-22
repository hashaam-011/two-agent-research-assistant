/**
 * Mock Planner Agent.
 *
 * Emits the AG-UI spec-compliant event sequence so the frontend's full F2/F3
 * wiring can be validated locally before the real Planner Agent is running.
 * All event types and field names match ag_ui/core/events.py exactly.
 */

import type { PlannerRequest } from "@/lib/agui-types";

export const runtime = "nodejs";

function sseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

const ANSWER_PARAGRAPHS = [
  "Three open protocols dominate the current agent stack. MCP (Anthropic) standardises how an agent calls tools and reads external data — it ships in Claude, Cursor, and our own ServiceNow / Slack integrations.",
  "A2A (Google → Linux Foundation) gives every agent an Agent Card at /.well-known/agent.json and a JSON-RPC task lifecycle, so one agent can delegate to another regardless of framework.",
  "AG-UI (CopilotKit) is the streaming event protocol between the agent backend and a frontend. Sixteen event types: RUN_*, STEP_*, STATE_SNAPSHOT, TOOL_CALL_*, TEXT_MESSAGE_*. It is how the tokens you are reading right now reach your screen.",
];

export async function POST(req: Request) {
  const body = (await req.json()) as PlannerRequest;
  const lastUserMessage = [...(body.messages ?? [])].reverse().find((m) => m.role === "user");
  const query = lastUserMessage?.content?.trim() || "AI agent protocols";

  const encoder = new TextEncoder();
  const runId = `run_${Math.random().toString(36).slice(2, 10)}`;
  const toolCallId = `call_${Math.random().toString(36).slice(2, 10)}`;
  const messageId = `msg_${Math.random().toString(36).slice(2, 10)}`;
  const resultMsgId = `msg_${Math.random().toString(36).slice(2, 10)}`;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(sseFrame(event, data)));
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

      try {
        // spec: thread_id + run_id required
        send("RUN_STARTED", { run_id: runId, thread_id: body.thread_id });
        await sleep(120);

        // spec field: step_name (not name)
        send("STEP_STARTED", { step_name: "Decomposing question" });
        // STATE_SNAPSHOT wraps state in `snapshot`
        send("STATE_SNAPSHOT", {
          snapshot: { active_agent: "planner", step: "thinking…", tool_calls: [] },
        });
        await sleep(500);

        send("STEP_FINISHED", { step_name: "Decomposing question" });
        send("STEP_STARTED", { step_name: "Delegating to Search Agent (A2A)" });
        send("STATE_SNAPSHOT", {
          snapshot: {
            active_agent: "search",
            step: "preparing search…",
            tool_calls: [
              { id: toolCallId, name: "web_search", status: "running", query, resultsCount: null },
            ],
          },
        });
        await sleep(400);

        // spec: tool_call_name (not tool_name); no arguments in START
        send("TOOL_CALL_START", { tool_call_id: toolCallId, tool_call_name: "web_search" });
        // spec: TOOL_CALL_ARGS carries args as a JSON-encoded delta string
        send("TOOL_CALL_ARGS", { tool_call_id: toolCallId, delta: JSON.stringify({ query }) });
        send("STATE_SNAPSHOT", {
          snapshot: {
            active_agent: "search",
            step: "searching the web…",
            tool_calls: [
              { id: toolCallId, name: "web_search", status: "running", query, resultsCount: null },
            ],
          },
        });
        await sleep(900);

        const results = [
          {
            title: "AG-UI Protocol — Agent–User Interaction over SSE",
            url: "docs.ag-ui.com",
            snippet:
              "16 standard event types for streaming agent runs to a frontend. First-party support in LangGraph, CrewAI, Google ADK, Mastra.",
          },
          {
            title: "A2A specification — Linux Foundation",
            url: "google.github.io/A2A",
            snippet:
              "Agent Card discovery + task lifecycle (submitted → working → completed). Adopted by Salesforce, SAP, ServiceNow, Deutsche Bank.",
          },
          {
            title: "Model Context Protocol — modelcontextprotocol.io",
            url: "modelcontextprotocol.io",
            snippet:
              "Open standard from Anthropic for connecting AI models to tools, resources, and prompts. HTTP/SSE or stdio transport.",
          },
        ];

        // spec: TOOL_CALL_END carries only tool_call_id
        send("TOOL_CALL_END", { tool_call_id: toolCallId });
        // spec: TOOL_CALL_RESULT carries the actual result as a JSON string
        send("TOOL_CALL_RESULT", {
          message_id: resultMsgId,
          tool_call_id: toolCallId,
          content: JSON.stringify({ results }),
          role: "tool",
        });
        send("STATE_SNAPSHOT", {
          snapshot: {
            active_agent: "search",
            step: "search complete",
            tool_calls: [
              {
                id: toolCallId,
                name: "web_search",
                status: "done",
                query,
                resultsCount: results.length,
              },
            ],
          },
        });
        await sleep(180);

        send("STEP_FINISHED", { step_name: "Delegating to Search Agent (A2A)" });
        send("STATE_SNAPSHOT", {
          snapshot: {
            active_agent: "planner",
            step: "writing answer…",
            tool_calls: [
              {
                id: toolCallId,
                name: "web_search",
                status: "done",
                query,
                resultsCount: results.length,
              },
            ],
          },
        });
        await sleep(220);

        // spec: message_id required
        send("TEXT_MESSAGE_START", { message_id: messageId, role: "assistant" });
        const text = ANSWER_PARAGRAPHS.join("\n\n");
        for (let i = 0; i < text.length; i += 3) {
          // spec: delta field (not content); message_id required
          send("TEXT_MESSAGE_CONTENT", {
            message_id: messageId,
            delta: text.slice(i, i + 3),
          });
          await sleep(14);
        }
        // spec: message_id required
        send("TEXT_MESSAGE_END", { message_id: messageId });

        send("STATE_SNAPSHOT", {
          snapshot: {
            active_agent: "idle",
            step: "done",
            tool_calls: [
              {
                id: toolCallId,
                name: "web_search",
                status: "done",
                query,
                resultsCount: results.length,
              },
            ],
          },
        });
        // spec: thread_id + run_id required
        send("RUN_FINISHED", { run_id: runId, thread_id: body.thread_id });
      } catch (err) {
        send("RUN_ERROR", { message: (err as Error).message || "Unknown error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
