"use client";

import { useAppState } from "@/components/app-state";
import { AgentFlow } from "@/components/agent-flow";
import { EventLog } from "@/components/event-log";
import { useStickToBottom } from "@/hooks/use-stick-to-bottom";

export function ActivityPanel() {
  const { events, status } = useAppState();
  const scrollRef = useStickToBottom<HTMLDivElement>([events]);

  return (
    <section className="flex h-full min-h-0 flex-col bg-panel ring-1 ring-line rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="eyebrow">Agent activity</span>
        <span className="text-[11px] text-dim tabular-nums">
          <span className="text-foreground/80 font-mono">{events.length}</span> events
        </span>
      </div>

      {/* Agent flow cards + connectors (always visible — labels react to state) */}
      <AgentFlow />

      {/* Divider */}
      <div className="hairline mx-3 sm:mx-4 mt-1 mb-3 opacity-70" />

      {/* Event log */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto" aria-live="polite">
        {events.length === 0 ? (
          <EmptyActivity streaming={status === "streaming"} />
        ) : (
          <EventLog events={events} />
        )}
      </div>
    </section>
  );
}

function EmptyActivity({ streaming }: { streaming: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center gap-2 px-6 py-10">
      <div className="text-[12.5px] text-muted max-w-xs">
        {streaming
          ? "Listening for the first event…"
          : "Ask a question on the left. Each step the agents take will show up here, in order."}
      </div>
    </div>
  );
}
