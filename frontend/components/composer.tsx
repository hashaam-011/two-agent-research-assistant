"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Square } from "lucide-react";
import { useAppState } from "@/components/app-state";
import { cn } from "@/lib/utils";

/**
 * Composer — single rounded card with an icon-only send button, modeled after
 * Claude / ChatGPT / Gemini. No keyboard hints (Enter/Shift+Enter is the
 * universally-understood default), no character counter, no attachment slot
 * until we actually support attachments.
 */
export function Composer() {
  const { status, sendMessage, cancelRun } = useAppState();
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const isStreaming = status === "streaming";
  const canSend = value.trim().length > 0 && !isStreaming;

  // Auto-grow up to ~6 lines
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  }, [value]);

  function submit() {
    if (!canSend) return;
    const text = value.trim();
    setValue("");
    sendMessage(text);
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Skip Enter while an IME composition is active so CJK users can confirm
    // suggestions without accidentally submitting. `keyCode === 229` covers
    // older browsers where `isComposing` isn't set.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

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
          "group relative flex items-center gap-2 rounded-2xl bg-panel-2/70 ring-1 ring-line",
          "transition-all duration-200",
          "focus-within:ring-mobiz/40 focus-within:bg-panel-2/90",
          "focus-within:shadow-[0_0_0_4px_rgb(var(--mobiz)/0.10)]",
        )}
      >
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
          rows={1}
          placeholder={isStreaming ? "Agents are working…" : "Ask anything…"}
          aria-label="Ask anything"
          className={cn(
            "block flex-1 resize-none bg-transparent text-[14px] leading-relaxed",
            "px-4 py-3.5 outline-none",
            "text-foreground placeholder:text-dim",
            "max-h-[180px] min-h-[28px]",
          )}
        />

        <div className="flex shrink-0 items-center p-1.5">
          {isStreaming ? (
            <button
              type="button"
              onClick={cancelRun}
              aria-label="Stop generating"
              title="Stop"
              className="grid h-8 w-8 place-items-center rounded-full bg-err/15 text-err ring-1 ring-err/30 transition-colors hover:bg-err/25"
            >
              <Square className="h-3 w-3 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Send"
              title="Send"
              className={cn(
                "grid h-8 w-8 place-items-center rounded-full transition-all",
                canSend
                  ? "bg-mobiz text-white hover:brightness-110 shadow-[0_0_0_3px_rgb(var(--mobiz)/0.20)]"
                  : "bg-panel text-dim/60 ring-1 ring-line cursor-not-allowed",
              )}
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
