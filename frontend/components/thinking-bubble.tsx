"use client";

import { useAppState } from "@/components/app-state";
import { cn } from "@/lib/utils";
import { AgentName } from "@/lib/agui-types";

/**
 * Pre-message "thinking" placeholder, in the spirit of Claude / ChatGPT.
 * Shown while the run is in progress but the assistant message hasn't
 * started streaming yet (i.e. between RUN_STARTED and TEXT_MESSAGE_START).
 *
 * Reads the live step label from app state so the dots are accompanied by
 * the current human-readable activity ("thinking", "searching the web",
 * "writing answer").
 */
export function ThinkingBubble() {
  const { activeAgent, step } = useAppState();

  const agentLabel =
    activeAgent === AgentName.Search
      ? "search"
      : activeAgent === AgentName.Planner
        ? "planner"
        : "agent";

  // Tint the agent name with the same protocol color used in the chat bubble
  // and the activity flow — the only visual cue for which agent is active
  // now that the circular avatar is gone.
  const nameTone =
    activeAgent === AgentName.Search
      ? "text-a2a"
      : activeAgent === AgentName.Planner
        ? "text-agui"
        : "text-accent";

  return (
    <div className="animate-fade-up min-w-0 space-y-1.5">
      <div className="flex items-baseline gap-2 text-[11px]">
        <span className={cn("font-medium", nameTone)}>{agentLabel}</span>
        <span className="text-dim">.agent</span>
      </div>
      <div className="flex items-center gap-2 text-[13.5px] text-muted">
        <span className="lowercase">{step || "thinking"}</span>
        <span className="inline-flex items-center gap-1" aria-hidden>
          <Dot delay={0} />
          <Dot delay={140} />
          <Dot delay={280} />
        </span>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="inline-block h-1 w-1 rounded-full bg-current animate-pulse-soft"
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}
