/**
 * UI helpers and static labels used by the chat and activity panels.
 * Runtime state during a run is driven by the AG-UI SSE stream consumed in
 * hooks/use-agent-stream.ts.
 */

import type { AgentEventType } from "@/lib/agui-types";

// Suggested prompts shown in the empty state.
export const SUGGESTIONS: readonly string[] = [
  "What are the latest developments in AI agent protocols?",
  "Compare A2A and MCP in one paragraph.",
  "Summarise how CopilotKit consumes AG-UI events.",
  "What is FastMCP and when would I use it?",
] as const;

// Maps the raw `step` strings the backend sends onto display-friendly labels.
// Anything not in the map falls through unchanged.
const FRIENDLY_STEP: Record<string, string> = {
  "decomposing question": "thinking…",
  "synthesising answer": "writing answer…",
  "writing answer": "writing answer…",
  "preparing web_search call": "preparing search…",
  "searching the web": "searching the web…",
  "searching...": "searching the web…",
  "search complete": "search complete",
};

export function friendlyStep(raw: string): string {
  return FRIENDLY_STEP[raw.toLowerCase()] ?? raw;
}

// Tailwind text-color tokens for the per-event-type tint in the activity log.
export const EVENT_COLOR: Record<AgentEventType, string> = {
  RUN_STARTED: "text-ok",
  STEP_STARTED: "text-a2a",
  STEP_FINISHED: "text-a2a",
  STATE_DELTA: "text-agui",
  TOOL_CALL_START: "text-mcp",
  TOOL_CALL_END: "text-mcp",
  TEXT_MESSAGE_START: "text-copilot",
  TEXT_MESSAGE_CONTENT: "text-copilot",
  TEXT_MESSAGE_END: "text-copilot",
  RUN_FINISHED: "text-ok",
  RUN_ERROR: "text-err",
};
