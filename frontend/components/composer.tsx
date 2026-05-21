"use client";

import { useEffect, useRef, useState } from "react";
import { Square, ArrowUp, CornerDownLeft, Paperclip } from "lucide-react";
import { useAppState } from "@/components/app-state";
import { cn } from "@/lib/utils";

export function Composer() {
  const { status, setStatus } = useAppState();
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const isStreaming = status === "streaming";
  const canSend = value.trim().length > 0 && !isStreaming;

  // Auto-grow textarea up to 6 lines (~160px)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [value]);

  function submit() {
    if (!canSend) return;
    // F2 will wire this up to the Planner Agent. F1 flips status briefly so the
    // header pulse + activity flow react to the user's first send.
    setStatus("streaming");
    setTimeout(() => setStatus("ready"), 1400);
    setValue("");
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  const charCount = value.length;
  const overLimit = charCount > 4000;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="px-3 sm:px-4 pb-3 sm:pb-4 pt-2"
    >
      <div
        className={cn(
          "group rounded-2xl bg-panel-2/70 ring-1 ring-line transition-all duration-200",
          "focus-within:ring-accent/50 focus-within:bg-panel-2/90",
          "focus-within:shadow-[0_0_0_4px_rgb(124_139_255_/_0.08)]",
          isStreaming && "opacity-80",
        )}
      >
        {/* Textarea row */}
        <label className="block px-4 pt-3.5 pb-1 cursor-text" htmlFor="composer-input">
          <textarea
            id="composer-input"
            ref={ref}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKey}
            rows={1}
            placeholder={isStreaming ? "Agents are working…" : "Ask the agents anything…"}
            disabled={isStreaming}
            aria-label="Ask the agents anything"
            className={cn(
              "block w-full resize-none bg-transparent text-[14px] leading-relaxed",
              "text-foreground placeholder:text-dim outline-none",
              "max-h-[160px] min-h-[24px]",
              "disabled:cursor-not-allowed",
              // Hide the textarea's own scrollbar but allow scrolling
              "scrollbar-thin",
            )}
          />
        </label>

        {/* Action row */}
        <div className="flex items-center justify-between gap-3 px-2.5 pb-2 pt-1">
          {/* Left cluster — secondary actions + hints */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="Attach (coming soon)"
              disabled
              className="grid h-7 w-7 place-items-center rounded-md text-dim/70 transition-colors hover:text-muted hover:bg-panel/60 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Paperclip className="h-3.5 w-3.5" />
            </button>

            <div className="ml-1 hidden sm:flex items-center gap-3 text-[10.5px] text-dim/80">
              <span className="inline-flex items-center gap-1.5">
                <Kbd><CornerDownLeft className="h-2.5 w-2.5" /></Kbd>
                <span>send</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Kbd>⇧↵</Kbd>
                <span>newline</span>
              </span>
            </div>
          </div>

          {/* Right cluster — char counter + send/stop */}
          <div className="flex items-center gap-2">
            {charCount > 0 && (
              <span
                className={cn(
                  "text-[10.5px] tabular-nums",
                  overLimit ? "text-err" : charCount > 3500 ? "text-warn" : "text-dim/70",
                )}
                aria-label={`${charCount} characters`}
              >
                {charCount.toLocaleString()}
              </span>
            )}

            {isStreaming ? (
              <button
                type="button"
                onClick={() => setStatus("ready")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium",
                  "bg-err/15 text-err ring-1 ring-err/30 hover:bg-err/25 transition-colors",
                )}
              >
                <Square className="h-3 w-3 fill-current" />
                stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!canSend}
                aria-label="Send message"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all",
                  canSend
                    ? "bg-ok text-background ring-1 ring-ok shadow-[0_1px_0_rgb(255_255_255_/_0.1)_inset,0_0_0_3px_rgb(52_211_153_/_0.15)] hover:brightness-110"
                    : "bg-panel text-dim/60 ring-1 ring-line cursor-not-allowed",
                )}
              >
                <span>run</span>
                <ArrowUp className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-line bg-panel/70 px-1 font-mono text-[10px] text-muted shadow-[0_1px_0_rgb(0_0_0_/_0.3)]">
      {children}
    </kbd>
  );
}
