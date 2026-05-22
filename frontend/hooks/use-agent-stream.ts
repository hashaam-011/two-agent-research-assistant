"use client";

import { useCallback, useRef } from "react";
import { getAgentUrl } from "@/lib/env";
import type { AgentEventType, AnyAgentEvent, PlannerRequest } from "@/lib/agui-types";

// Set of event names we actually handle. The SSE parser rejects anything
// outside this set so contract drift between backend and frontend doesn't
// silently land as untyped `data` payloads in the handler's default branch.
const KNOWN_EVENTS: ReadonlySet<AgentEventType> = new Set<AgentEventType>([
  "RUN_STARTED",
  "STEP_STARTED",
  "STEP_FINISHED",
  "STATE_DELTA",
  "TOOL_CALL_START",
  "TOOL_CALL_END",
  "TEXT_MESSAGE_START",
  "TEXT_MESSAGE_CONTENT",
  "TEXT_MESSAGE_END",
  "RUN_FINISHED",
  "RUN_ERROR",
]);

/**
 * AG-UI SSE client.
 *
 * Posts to AGENT_URL with the documented planner request body, then parses
 * the `event: <type>\ndata: <json>\n\n` stream and forwards each frame to
 * the supplied onEvent callback.
 *
 * Why fetch + ReadableStream instead of `EventSource`:
 *   - EventSource only supports GET; the planner contract is POST.
 *   - We need to pass the full thread/messages body, so fetch + manual
 *     parsing is the standard pattern (same approach CopilotKit uses).
 */

type Handlers = {
  onEvent: (ev: AnyAgentEvent) => void;
  onError?: (err: Error) => void;
  onDone?: () => void;
};

export function useAgentStream() {
  // Track the in-flight request so we can cancel a run.
  const controllerRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (body: PlannerRequest, h: Handlers) => {
      // Cancel any previous in-flight run first.
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      try {
        const resp = await fetch(getAgentUrl(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!resp.ok || !resp.body) {
          throw new Error(`Planner returned ${resp.status} ${resp.statusText}`);
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        // Stream loop — parse SSE frames as they arrive.
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          // Normalise CRLF at the point of buffering so frame-boundary
          // detection works regardless of whether the server sends \n\n or
          // \r\n\r\n as the separator.
          buffer += decoder.decode(value, { stream: true }).replace(/\r\n?/g, "\n");

          // SSE frames are separated by double-newline.
          let frameEnd: number;
          while ((frameEnd = buffer.indexOf("\n\n")) !== -1) {
            const frame = buffer.slice(0, frameEnd);
            buffer = buffer.slice(frameEnd + 2);
            const parsed = parseSseFrame(frame);
            if (parsed) h.onEvent(parsed);
          }
        }
        h.onDone?.();
      } catch (err) {
        if ((err as Error).name === "AbortError") return; // user cancelled — not an error
        h.onError?.(err as Error);
      } finally {
        if (controllerRef.current === controller) controllerRef.current = null;
      }
    },
    [],
  );

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  return { send, cancel };
}

/**
 * Parse one SSE frame into a typed AG-UI event.
 *   event: STATE_DELTA
 *   data: {"active_agent":"search","step":"searching…","tool_calls":[…]}
 */
function parseSseFrame(frame: string): AnyAgentEvent | null {
  // Buffer is pre-normalised to LF, so a plain split is enough.
  const lines = frame.split("\n");
  let event = "";
  // Per SSE spec, multiple `data:` lines in one frame are joined with `\n`
  // and only a single leading space (after the colon) is stripped.
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^ /, ""));
  }
  const data = dataLines.join("\n");
  if (!event || !data) return null;
  // The Planner Agent emits `ERROR` for upstream failures; the frontend models
  // them as RUN_ERROR. Normalize here so the handler only has one case.
  const type = event === "ERROR" ? "RUN_ERROR" : event;
  if (!KNOWN_EVENTS.has(type as AgentEventType)) {
    console.warn(`[agent-stream] ignoring unknown event type: ${type}`);
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch (err) {
    console.warn(`[agent-stream] malformed JSON for ${type}:`, err);
    return null;
  }
  return { type: type as AgentEventType, data: parsed } as AnyAgentEvent;
}
