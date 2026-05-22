import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/agui-types";
import { ToolCallCard } from "@/components/tool-call-card";

export function ChatBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end animate-fade-up">
        <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tr-sm bg-panel-2 px-3.5 py-2 text-[13.5px] text-foreground ring-1 ring-line whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  // Tint the avatar with the protocol color of the agent that produced the
  // message so the chat and the activity panel use the same visual language.
  const avatarTone = message.agent === "search" ? "text-a2a" : "text-agui";

  return (
    <div className="flex gap-3 animate-fade-up">
      <div
        className={cn(
          "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-panel-2 ring-1 ring-line text-[10.5px] font-semibold",
          avatarTone,
        )}
      >
        {message.agent === "search" ? "SE" : "PL"}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-baseline gap-2 text-[11px]">
          <span className="text-muted">{message.agent}.agent</span>
        </div>
        {message.tool && (
          <ToolCallCard
            name={message.tool.name}
            query={message.tool.query}
            results={message.tool.results}
            status="done"
          />
        )}
        <p
          className={cn(
            "text-[13.5px] leading-relaxed text-foreground whitespace-pre-wrap",
            message.streaming && "caret",
          )}
        >
          {message.content}
        </p>
      </div>
    </div>
  );
}
