"use client";

import { Sparkles, AlertTriangle, RotateCcw } from "lucide-react";
import { useAppState } from "@/components/app-state";
import { ChatBubble } from "@/components/chat-bubble";
import { ThinkingBubble } from "@/components/thinking-bubble";
import { Composer } from "@/components/composer";
import { useStickToBottom } from "@/hooks/use-stick-to-bottom";
import { SUGGESTIONS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export function ChatPanel() {
  const { messages, status, errorMessage, sendMessage, clearThread } = useAppState();
  const scrollRef = useStickToBottom<HTMLDivElement>([messages, status]);

  const lastMessage = messages.at(-1);
  // Show the thinking placeholder once a run starts and before the assistant
  // bubble appears (i.e. last visible message is still the user's).
  const showThinking = status === "streaming" && lastMessage?.role === "user";

  return (
    <section className="flex h-full min-h-0 flex-col bg-panel ring-1 ring-line rounded-lg overflow-hidden">
      {/* Section header */}
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="eyebrow">Conversation</span>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={clearThread}
            title="Start a fresh conversation"
            className={cn(
              "group inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium",
              "text-mobiz ring-1 ring-mobiz/40 bg-mobiz/5",
              "transition-all duration-150",
              "hover:bg-mobiz hover:text-white hover:ring-mobiz",
              "hover:shadow-[0_0_0_3px_rgb(var(--mobiz)/0.15)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mobiz/60",
            )}
          >
            <RotateCcw className="h-3 w-3 transition-transform group-hover:-rotate-45" />
            New chat
          </button>
        )}
      </div>

      {/* Scrollable conversation. No `aria-live` here — token streaming would
          flood screen readers. The error card below uses role="alert" for
          its own announcement. */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-7 py-5 space-y-5"
      >
        {messages.length === 0 ? (
          <EmptyState onPick={sendMessage} />
        ) : (
          <>
            {messages.map((m) => (
              <ChatBubble key={m.id} message={m} />
            ))}
            {showThinking && <ThinkingBubble />}
          </>
        )}

        {errorMessage && status === "error" && (
          <div
            role="alert"
            className="rounded-md bg-err/10 ring-1 ring-err/30 px-3 py-2 text-[12.5px] text-err animate-fade-up"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium">Something went wrong</span>
            </div>
            <div className="mt-1 text-[12px] text-err/80 break-words">{errorMessage}</div>
          </div>
        )}
      </div>

      {/* Composer */}
      <Composer />
    </section>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center gap-6 px-6 py-10">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-panel-2 ring-1 ring-line">
        <Sparkles className="h-5 w-5 text-accent" />
      </div>
      <div className="space-y-1.5">
        <div className="text-[15px] font-medium text-foreground">Ask the agents anything</div>
        <p className="text-[12.5px] text-muted max-w-sm">
          A <span className="text-foreground">Planner</span> and a{" "}
          <span className="text-foreground">Search </span> agent will collaborate to answer your
          question — you&apos;ll see them work live in the activity panel.
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-md">
        {SUGGESTIONS.slice(0, 3).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="rounded-lg bg-panel-2/70 ring-1 ring-line px-3.5 py-2.5 text-left text-[12.5px] text-muted transition-colors hover:bg-panel-2 hover:text-foreground hover:ring-line"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
