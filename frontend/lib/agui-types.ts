/**
 * TypeScript mirror of contracts/{planner_request,state_delta,tools}.py.
 *
 * Keep field names IDENTICAL to the Python contracts so the SSE event
 * payloads deserialize cleanly into these shapes. If the contract changes
 * upstream, mirror the change here in the same PR.
 */

// ─────────────────────────────────────────────
// Planner request — POST /agent body
// ─────────────────────────────────────────────

export type PlannerRole = "user" | "assistant";

export type PlannerMessage = {
  role: PlannerRole;
  content: string;
};

export type PlannerRequest = {
  thread_id: string;
  messages: PlannerMessage[];
};

// ─────────────────────────────────────────────
// MCP — web_search tool shape
// ─────────────────────────────────────────────

export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

export type WebSearchResponse = {
  results: SearchResult[];
};

// ─────────────────────────────────────────────
// STATE_DELTA payload — Activity panel state
// ─────────────────────────────────────────────

export type AgentName = "planner" | "search" | "idle";
export type ToolStatus = "running" | "done" | "error";

export type ToolCall = {
  id: string;
  name: string;
  status: ToolStatus;
  query: string;
  resultsCount: number | null;
};

export type StateDelta = {
  active_agent: AgentName;
  step: string;
  tool_calls: ToolCall[];
};

// ─────────────────────────────────────────────
// AG-UI event envelope
// ─────────────────────────────────────────────

export type AgentEventType =
  | "RUN_STARTED"
  | "STEP_STARTED"
  | "STEP_FINISHED"
  | "STATE_DELTA"
  | "TOOL_CALL_START"
  | "TOOL_CALL_END"
  | "TEXT_MESSAGE_START"
  | "TEXT_MESSAGE_CONTENT"
  | "TEXT_MESSAGE_END"
  | "RUN_FINISHED"
  | "RUN_ERROR";

// Per-type payload shapes, indexed by event name.
export type AgentEventPayload = {
  RUN_STARTED: { run_id: string; thread_id: string };
  STEP_STARTED: { name: string };
  STEP_FINISHED: { name: string };
  STATE_DELTA: StateDelta;
  TOOL_CALL_START: { tool_call_id: string; tool_name: string; arguments?: Record<string, unknown> };
  TOOL_CALL_END: { tool_call_id: string; tool_name: string; result?: WebSearchResponse };
  TEXT_MESSAGE_START: { message_id?: string; role?: "assistant" };
  // The real backend emits `content`; the AG-UI spec uses `delta`. Accept both
  // so we work against the live Planner Agent and the spec-shaped mock.
  TEXT_MESSAGE_CONTENT: { message_id?: string; content?: string; delta?: string };
  TEXT_MESSAGE_END: { message_id?: string };
  RUN_FINISHED: { run_id: string };
  RUN_ERROR: { message: string };
};

// Discriminated union for typed event handling.
export type AnyAgentEvent = {
  [K in AgentEventType]: { type: K; data: AgentEventPayload[K] };
}[AgentEventType];

// ─────────────────────────────────────────────
// UI-only types — flattened events for the activity log and chat
// ─────────────────────────────────────────────

export type AgentEvent = {
  id: string;
  ts: string; // HH:MM:SS
  type: AgentEventType;
  title: string;
  detail?: string;
  agent?: "planner" | "search";
};

export type ChatMessage =
  | { id: string; role: "user"; content: string }
  | {
      id: string;
      role: "assistant";
      agent: "planner" | "search";
      content: string;
      streaming?: boolean;
      tool?: {
        name: string;
        query: string;
        results: SearchResult[];
      };
    };
