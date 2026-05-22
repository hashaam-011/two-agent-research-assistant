/**
 * TypeScript mirror of contracts/{planner_request,state_delta,tools}.py
 * and the installed ag-ui-protocol spec (ag_ui/core/events.py).
 *
 * Field names match the AG-UI spec exactly so this client can consume
 * any spec-conformant AG-UI stream (LangGraph, CrewAI, Mastra, CopilotKit).
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
// STATE_SNAPSHOT payload — Activity panel state
// ─────────────────────────────────────────────

export const AgentName = {
  Planner: "planner",
  Search: "search",
  Idle: "idle",
} as const;
export type AgentName = (typeof AgentName)[keyof typeof AgentName];

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

export type AppSnapshot = {
  active_agent: AgentName;
  step: string;
  tool_calls: ToolCall[];
};

// ─────────────────────────────────────────────
// AG-UI event envelope — spec-conformant
// ─────────────────────────────────────────────

export type AgentEventType =
  | "RUN_STARTED"
  | "STEP_STARTED"
  | "STEP_FINISHED"
  | "STATE_SNAPSHOT"
  | "TOOL_CALL_START"
  | "TOOL_CALL_ARGS"
  | "TOOL_CALL_END"
  | "TOOL_CALL_RESULT"
  | "TEXT_MESSAGE_START"
  | "TEXT_MESSAGE_CONTENT"
  | "TEXT_MESSAGE_END"
  | "RUN_FINISHED"
  | "RUN_ERROR";

// Per-type payload shapes — field names match ag_ui/core/events.py exactly.
export type AgentEventPayload = {
  // Lifecycle — spec: thread_id + run_id required on both
  RUN_STARTED: { thread_id: string; run_id: string };
  RUN_FINISHED: { thread_id: string; run_id: string };
  RUN_ERROR: { message: string; code?: string };

  // Steps — spec field: step_name (not name)
  STEP_STARTED: { step_name: string };
  STEP_FINISHED: { step_name: string };

  // State — STATE_SNAPSHOT wraps our custom shape in `snapshot`
  STATE_SNAPSHOT: { snapshot: AppSnapshot };

  // Tool calls — spec-correct lifecycle
  TOOL_CALL_START: { tool_call_id: string; tool_call_name: string; parent_message_id?: string };
  TOOL_CALL_ARGS: { tool_call_id: string; delta: string };
  TOOL_CALL_END: { tool_call_id: string };
  TOOL_CALL_RESULT: { message_id: string; tool_call_id: string; content: string; role?: "tool" };

  // Text messages — spec: delta (not content); message_id required on all three
  TEXT_MESSAGE_START: { message_id: string; role?: "assistant" | "user" | "system" | "developer" };
  TEXT_MESSAGE_CONTENT: { message_id: string; delta: string };
  TEXT_MESSAGE_END: { message_id: string };
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
