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

/**
 * Agent identity. Two declarations sharing the same name:
 *   - The `const` lives in the value space — use it for comparisons
 *     (`activeAgent === AgentName.Planner`), avoiding stringly-typed checks.
 *   - The `type` lives in the type space — derived from the const so the
 *     two can never drift.
 *
 * Prefer this over the legacy string literals: `"planner"` etc. still
 * type-check because the literal is assignable, but the const is the
 * canonical source.
 */
export const AgentName = {
  Planner: "planner",
  Search: "search",
  Idle: "idle",
} as const;
export type AgentName = (typeof AgentName)[keyof typeof AgentName];

/** Subset of AgentName for places that can only be a working agent (not "idle"). */
export type WorkingAgent = typeof AgentName.Planner | typeof AgentName.Search;

export const ToolStatus = {
  Running: "running",
  Done: "done",
  Error: "error",
} as const;
export type ToolStatus = (typeof ToolStatus)[keyof typeof ToolStatus];

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
  agent?: WorkingAgent;
};

export type ChatMessage =
  | { id: string; role: "user"; content: string }
  | {
      id: string;
      role: "assistant";
      agent: WorkingAgent;
      content: string;
      streaming?: boolean;
      tool?: {
        name: string;
        query: string;
        results: SearchResult[];
      };
    };
