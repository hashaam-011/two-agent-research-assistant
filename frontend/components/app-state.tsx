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
  const [threadId, setThreadId] = useState<string>(() => newId("thr"));
  const assistantMsgIdRef = useRef<string | null>(null);
  // Tool calls arrive before the assistant bubble; buffer them and attach
  // once TEXT_MESSAGE_START fires.
  const pendingToolRef = useRef<{ name: string; query: string; results?: SearchResult[] } | null>(
    null,
  );

  const { send, cancel } = useAgentStream();

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
          // spec field: step_name (not name)
          appendEvent({
            id: newId("e"),
            ts: formatHMS(),
            type: e.type,
            title: e.data.step_name,
            agent: agentTagFor(ctx.currentActive.value),
          });
          break;
        }
        case "STEP_FINISHED": {
          // spec field: step_name (not name)
          appendEvent({
            id: newId("e"),
            ts: formatHMS(),
            type: e.type,
            title: `${e.data.step_name} ✓`,
            agent: agentTagFor(ctx.currentActive.value),
          });
          break;
        }
        case "STATE_SNAPSHOT": {
          // Our custom state is wrapped in `snapshot` per AG-UI STATE_SNAPSHOT spec
          const s = e.data.snapshot;
          ctx.currentActive.value = s.active_agent;
          setActiveAgent(s.active_agent);
          setStep(friendlyStep(s.step));
          setToolCalls(s.tool_calls ?? []);
          appendEvent({
            id: newId("e"),
            ts: formatHMS(),
            type: e.type,
            title: `${s.active_agent} · ${friendlyStep(s.step)}`,
            agent: agentTagFor(s.active_agent),
          });
          break;
        }
        case "TOOL_CALL_START": {
          // spec field: tool_call_name (not tool_name); args arrive in TOOL_CALL_ARGS
          pendingToolRef.current = {
            name: e.data.tool_call_name,
            query: "",
          };
          appendEvent({
            id: newId("e"),
            ts: formatHMS(),
            type: e.type,
            title: `${e.data.tool_call_name}()`,
            agent: AgentName.Search,
          });
          break;
        }
        case "TOOL_CALL_ARGS": {
          // Parse args delta and update pending tool query
          if (pendingToolRef.current) {
            try {
              const args = JSON.parse(e.data.delta) as { query?: string };
              if (args.query) {
                pendingToolRef.current.query = args.query;
              }
            } catch {
              // malformed delta — leave query as-is
            }
          }
          appendEvent({
            id: newId("e"),
            ts: formatHMS(),
            type: e.type,
            title: "tool args",
            detail: e.data.delta.slice(0, 60),
            agent: AgentName.Search,
          });
          break;
        }
        case "TOOL_CALL_END": {
          // spec: TOOL_CALL_END carries only tool_call_id; results arrive in TOOL_CALL_RESULT
          appendEvent({
            id: newId("e"),
            ts: formatHMS(),
            type: e.type,
            title: "tool call ended",
            agent: AgentName.Search,
          });
          break;
        }
        case "TOOL_CALL_RESULT": {
          // spec: content is a JSON string containing the tool output
          if (pendingToolRef.current) {
            try {
              const parsed = JSON.parse(e.data.content) as { results?: SearchResult[] };
              pendingToolRef.current.results = parsed.results ?? [];
            } catch {
              pendingToolRef.current.results = [];
            }
          }
          const count = pendingToolRef.current?.results?.length ?? 0;
          appendEvent({
            id: newId("e"),
            ts: formatHMS(),
            type: e.type,
            title: "tool result",
            detail: `${count} result${count === 1 ? "" : "s"}`,
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
          // spec field: delta (required); message_id required
          const chunk = e.data.delta;
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

      const planner: PlannerMessage[] = nextMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

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
