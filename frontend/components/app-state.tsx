"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAgentStream } from "@/hooks/use-agent-stream";
import { friendlyStep } from "@/lib/mock-data";
import { formatHMS } from "@/lib/utils";
import { AgentName } from "@/lib/agui-types";
import type {
  AgentEvent,
  AnyAgentEvent,
  ChatMessage,
  PlannerMessage,
  SearchResult,
  ToolCall,
} from "@/lib/agui-types";

export type RunStatus = "idle" | "ready" | "streaming" | "error";

export type AppState = {
  status: RunStatus;
  activeAgent: AgentName;
  step: string;
  toolCalls: ToolCall[];
  events: AgentEvent[];
  messages: ChatMessage[];
  threadId: string;
  errorMessage?: string;
  sendMessage: (text: string) => void;
  cancelRun: () => void;
  clearThread: () => void;
};

const AppStateContext = createContext<AppState | null>(null);

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function agentTagFor(active: AgentName) {
  return active === AgentName.Planner || active === AgentName.Search ? active : undefined;
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<RunStatus>("ready");
  const [activeAgent, setActiveAgent] = useState<AgentName>(AgentName.Idle);
  const [step, setStep] = useState<string>("idle");
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  // Lives in state so clearThread can rotate it — without that, "New chat"
  // resets the UI but the planner still resumes the prior conversation.
  // threadId is never rendered, only sent in the request body, so a
  // server/client mismatch from Math.random doesn't cause a hydration error.
  const [threadId, setThreadId] = useState<string>(() => newId("thr"));
  const assistantMsgIdRef = useRef<string | null>(null);
  // Tool calls land before the assistant message exists, so buffer them and
  // attach to the assistant bubble when TEXT_MESSAGE_START fires.
  const pendingToolRef = useRef<{ name: string; query: string; results?: SearchResult[] } | null>(
    null,
  );

  const { send, cancel } = useAgentStream();

  // Abort any in-flight stream if the provider unmounts (route change,
  // hot-reload). Without this the fetch keeps running in the background.
  useEffect(() => {
    return () => cancel();
  }, [cancel]);

  const appendEvent = useCallback((ev: AgentEvent) => {
    setEvents((prev) => [...prev, ev]);
  }, []);

  const finalizeStreamingMessage = useCallback(() => {
    const id = assistantMsgIdRef.current;
    if (!id) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id && m.role === "assistant" ? { ...m, streaming: false } : m,
      ),
    );
  }, []);

  const handleEvent = useCallback(
    (e: AnyAgentEvent, ctx: { currentActive: { value: AgentName } }) => {
      switch (e.type) {
        case "RUN_STARTED": {
          appendEvent({
            id: newId("e"),
            ts: formatHMS(),
            type: e.type,
            title: "Run started",
            detail: `run_id=${e.data.run_id}`,
            agent: AgentName.Planner,
          });
          break;
        }
        case "STEP_STARTED": {
          appendEvent({
            id: newId("e"),
            ts: formatHMS(),
            type: e.type,
            title: e.data.name,
            agent: agentTagFor(ctx.currentActive.value),
          });
          break;
        }
        case "STEP_FINISHED": {
          appendEvent({
            id: newId("e"),
            ts: formatHMS(),
            type: e.type,
            title: `${e.data.name} ✓`,
            agent: agentTagFor(ctx.currentActive.value),
          });
          break;
        }
        case "STATE_DELTA": {
          ctx.currentActive.value = e.data.active_agent;
          setActiveAgent(e.data.active_agent);
          setStep(friendlyStep(e.data.step));
          setToolCalls(e.data.tool_calls ?? []);
          appendEvent({
            id: newId("e"),
            ts: formatHMS(),
            type: e.type,
            title: `${e.data.active_agent} · ${friendlyStep(e.data.step)}`,
            agent: agentTagFor(e.data.active_agent),
          });
          break;
        }
        case "TOOL_CALL_START": {
          const args = (e.data.arguments as { query?: string }) ?? {};
          // Buffer the call so the assistant bubble (created later by
          // TEXT_MESSAGE_START) can render the expandable tool-call card.
          pendingToolRef.current = {
            name: e.data.tool_name,
            query: String(args.query ?? ""),
          };
          appendEvent({
            id: newId("e"),
            ts: formatHMS(),
            type: e.type,
            title: `${e.data.tool_name}()`,
            detail: args.query ? `"${args.query}"` : undefined,
            agent: AgentName.Search,
          });
          break;
        }
        case "TOOL_CALL_END": {
          const results = e.data.result?.results ?? [];
          if (pendingToolRef.current) {
            pendingToolRef.current.results = results;
          }
          appendEvent({
            id: newId("e"),
            ts: formatHMS(),
            type: e.type,
            title: "tool returned",
            detail: `${results.length} result${results.length === 1 ? "" : "s"}`,
            agent: AgentName.Search,
          });
          break;
        }
        case "TEXT_MESSAGE_START": {
          const id = newId("m");
          assistantMsgIdRef.current = id;
          const tool = pendingToolRef.current;
          pendingToolRef.current = null;
          setMessages((prev) => [
            ...prev,
            {
              id,
              role: "assistant",
              agent: AgentName.Planner,
              content: "",
              streaming: true,
              tool:
                tool && tool.results
                  ? { name: tool.name, query: tool.query, results: tool.results }
                  : undefined,
            },
          ]);
          appendEvent({
            id: newId("e"),
            ts: formatHMS(),
            type: e.type,
            title: "assistant message open",
            agent: AgentName.Planner,
          });
          break;
        }
        case "TEXT_MESSAGE_CONTENT": {
          const id = assistantMsgIdRef.current;
          if (!id) break;
          // Real backend sends `content`; AG-UI-spec mocks send `delta`.
          const chunk = e.data.content ?? e.data.delta ?? "";
          if (!chunk) break;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === id && m.role === "assistant"
                ? { ...m, content: m.content + chunk }
                : m,
            ),
          );
          break;
        }
        case "TEXT_MESSAGE_END": {
          finalizeStreamingMessage();
          appendEvent({
            id: newId("e"),
            ts: formatHMS(),
            type: e.type,
            title: "assistant message closed",
            agent: AgentName.Planner,
          });
          break;
        }
        case "RUN_FINISHED": {
          appendEvent({
            id: newId("e"),
            ts: formatHMS(),
            type: e.type,
            title: "Run finished",
            agent: AgentName.Planner,
          });
          break;
        }
        case "RUN_ERROR": {
          setErrorMessage(e.data.message);
          setStatus("error");
          setActiveAgent(AgentName.Idle);
          finalizeStreamingMessage();
          appendEvent({
            id: newId("e"),
            ts: formatHMS(),
            type: e.type,
            title: "Run error",
            detail: e.data.message,
            agent: AgentName.Planner,
          });
          break;
        }
      }
    },
    [appendEvent, finalizeStreamingMessage],
  );

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim() || status === "streaming") return;

      // Reset transient state for a clean run, then append the user message.
      // Note: events are NOT cleared here — they accumulate across turns in
      // the same thread so the activity log shows the whole conversation's
      // history. Use "New chat" / clearThread to wipe.
      setErrorMessage(undefined);
      setStatus("streaming");
      setActiveAgent(AgentName.Idle);
      setStep("starting");
      setToolCalls([]);
      assistantMsgIdRef.current = null;
      pendingToolRef.current = null;

      const userMsg: ChatMessage = { id: newId("m"), role: "user", content: text };
      const nextMessages = [...messages, userMsg];
      setMessages(nextMessages);

      // Build the planner request body from the full conversation. Strip the
      // UI-only `tool` field — the planner only needs role + content.
      const planner: PlannerMessage[] = nextMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Local context object so STATE_DELTA can pass the latest active agent
      // through to subsequent STEP_* events without round-tripping React state.
      const ctx = { currentActive: { value: AgentName.Idle as AgentName } };

      void send(
        { thread_id: threadId, messages: planner },
        {
          onEvent: (e) => handleEvent(e, ctx),
          onError: (err) => {
            setStatus("error");
            setErrorMessage(err.message);
            setActiveAgent(AgentName.Idle);
            finalizeStreamingMessage();
          },
          onDone: () => {
            // Don't clobber an error status set in-stream by RUN_ERROR.
            setStatus((prev) => (prev === "error" ? prev : "ready"));
            setActiveAgent(AgentName.Idle);
            setStep("idle");
          },
        },
      );
    },
    [messages, status, threadId, send, handleEvent, finalizeStreamingMessage],
  );

  const cancelRun = useCallback(() => {
    cancel();
    setStatus("ready");
    setActiveAgent(AgentName.Idle);
    setStep("cancelled");
    finalizeStreamingMessage();
    // Clear refs so any chunk that races past the abort can't append onto the
    // finalised bubble or attach a stale tool card to the next run.
    assistantMsgIdRef.current = null;
    pendingToolRef.current = null;
  }, [cancel, finalizeStreamingMessage]);

  const clearThread = useCallback(() => {
    cancel();
    setMessages([]);
    setEvents([]);
    setToolCalls([]);
    setActiveAgent(AgentName.Idle);
    setStep("idle");
    setStatus("ready");
    setErrorMessage(undefined);
    // Rotate threadId so the planner treats the next message as a fresh
    // conversation rather than resuming the old context.
    setThreadId(newId("thr"));
    assistantMsgIdRef.current = null;
    pendingToolRef.current = null;
  }, [cancel]);

  const value = useMemo<AppState>(
    () => ({
      status,
      activeAgent,
      step,
      toolCalls,
      events,
      messages,
      threadId,
      errorMessage,
      sendMessage,
      cancelRun,
      clearThread,
    }),
    [
      status,
      activeAgent,
      step,
      toolCalls,
      events,
      messages,
      threadId,
      errorMessage,
      sendMessage,
      cancelRun,
      clearThread,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used inside AppStateProvider");
  return ctx;
}
