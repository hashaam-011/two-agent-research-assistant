"use client";

import { Wrench, User2, Search } from "lucide-react";
import { useAppState } from "@/components/app-state";
import { cn } from "@/lib/utils";
import { AgentName } from "@/lib/agui-types";

type Node = {
  key: "planner" | "search" | "tool";
  label: string;
  protocol: string;
  badge: "agent" | "tool";
  Icon: React.ComponentType<{ className?: string }>;
  // Active state — protocol-matched colors
  activeRing: string;
  activeBg: string;
  activeIcon: string;
};

const PLANNER: Node = {
  key: "planner",
  label: "Planner",
  protocol: "AG-UI",
  badge: "agent",
  Icon: User2,
  activeRing: "ring-agui/60",
  activeBg: "bg-agui/5",
  activeIcon: "text-agui",
};

const SEARCH: Node = {
  key: "search",
  label: "Search",
  protocol: "A2A",
  badge: "agent",
  Icon: Search,
  activeRing: "ring-a2a/60",
  activeBg: "bg-a2a/5",
  activeIcon: "text-a2a",
};

const TOOL: Node = {
  key: "tool",
  label: "web_search",
  protocol: "MCP",
  badge: "tool",
  Icon: Wrench,
  activeRing: "ring-mcp/60",
  activeBg: "bg-mcp/5",
  activeIcon: "text-mcp",
};

// Dot color for the pulse on the active card — matches protocol
const ACTIVE_DOT: Record<Node["key"], string> = {
  planner: "bg-agui",
  search: "bg-a2a",
  tool: "bg-mcp",
};

export function AgentFlow() {
  const { activeAgent, step, toolCalls, status } = useAppState();

  const toolRunning = toolCalls.some((t) => t.status === "running");
  const toolUsed = toolCalls.length > 0;
  const isStreaming = status === "streaming";
  const isActive = (k: Node["key"]) => {
    if (k === "planner") return activeAgent === AgentName.Planner;
    if (k === "search") return activeAgent === AgentName.Search;
    // Tool card stays active as long as there are tool calls in the current run
    // (running OR done) so it doesn't flash off the moment TOOL_CALL_END fires.
    return toolRunning || (toolUsed && activeAgent !== AgentName.Idle);
  };

  // Only show the subline during an active run — no "ready" label at rest.
  const subline =
    isStreaming || activeAgent !== AgentName.Idle
      ? activeAgent === AgentName.Idle
        ? "starting"
        : `${activeAgent} · ${step || (activeAgent === AgentName.Planner ? "thinking" : "searching")}`
      : null;

  // Tint the subline dot with the active agent's protocol color so the
  // status indicator and the highlighted card agree at a glance.
  const sublineDotClass =
    activeAgent === AgentName.Planner
      ? "bg-agui"
      : activeAgent === AgentName.Search
        ? "bg-a2a"
        : toolRunning
          ? "bg-mcp"
          : "bg-muted";

  return (
    <div className="px-3 sm:px-4 pt-4 pb-3">
      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-stretch gap-1.5 sm:gap-2">
        <FlowItem node={PLANNER} active={isActive("planner")} streaming={isStreaming} />
        <Connector label="A2A" tone="a2a" animate={isStreaming} />
        <FlowItem node={SEARCH} active={isActive("search")} streaming={isStreaming} />
        <Connector label="MCP" tone="mcp" animate={isStreaming && toolRunning} />
        <FlowItem node={TOOL} active={isActive("tool")} streaming={isStreaming} />
      </div>

      {subline && (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-muted lowercase">
          <span
            className={cn(
              "inline-flex h-1.5 w-1.5 rounded-full animate-pulse-soft",
              sublineDotClass,
            )}
          />
          <span className="truncate">{subline}</span>
        </div>
      )}
    </div>
  );
}

function FlowItem({
  node,
  active,
  streaming,
}: {
  node: Node;
  active: boolean;
  streaming: boolean;
}) {
  const Icon = node.Icon;
  return (
    <div
      className={cn(
        "min-w-0 rounded-md ring-1 px-2.5 py-2 transition-all bg-panel-2",
        active ? `${node.activeRing} ${node.activeBg}` : "ring-line",
      )}
    >
      <div className="flex items-center gap-1.5">
        <Icon className={cn("h-3 w-3", active ? node.activeIcon : "text-muted")} />
        <span className="eyebrow truncate">{node.badge}</span>
        {active && streaming && (
          <span
            className={cn(
              "ml-auto inline-flex h-1.5 w-1.5 rounded-full animate-pulse-soft",
              ACTIVE_DOT[node.key],
            )}
            aria-label="active"
          />
        )}
      </div>
      <div
        className={cn(
          "mt-1 text-[13px] font-medium truncate",
          active ? "text-foreground" : "text-foreground/90",
        )}
      >
        {node.label}
      </div>
      <div
        className={cn(
          "text-[10.5px] font-mono mt-0.5",
          active ? node.activeIcon + "/80" : "text-dim",
        )}
      >
        {node.protocol}
      </div>
    </div>
  );
}

function Connector({
  label,
  tone,
  animate,
}: {
  label: string;
  tone: "a2a" | "mcp";
  animate?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center pt-3 select-none">
      <span className={cn("eyebrow", tone === "a2a" ? "text-a2a" : "text-mcp")}>{label}</span>
      <svg viewBox="0 0 32 12" className="mt-1 h-3 w-7" aria-hidden="true">
        <line
          x1="0"
          y1="6"
          x2="26"
          y2="6"
          stroke={tone === "a2a" ? "rgb(var(--a2a) / 0.75)" : "rgb(var(--mcp) / 0.75)"}
          strokeWidth="1.5"
          strokeDasharray="4 4"
          className={cn(animate && "animate-flow-dash")}
        />
        <polygon
          points="26,2 32,6 26,10"
          fill={tone === "a2a" ? "rgb(var(--a2a) / 0.85)" : "rgb(var(--mcp) / 0.85)"}
        />
      </svg>
    </div>
  );
}
