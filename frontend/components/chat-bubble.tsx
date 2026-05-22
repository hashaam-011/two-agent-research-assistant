import { cn } from "@/lib/utils";
import { AgentName, type ChatMessage } from "@/lib/agui-types";
import { ToolCallCard } from "@/components/tool-call-card";
import ReactMarkdown from "react-markdown";

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

  // Carry the protocol color forward through the agent name itself now that
  // the circular avatar is gone — keeps the chat and activity panel speaking
  // the same visual language without a DP-style affordance.
  const nameTone = message.agent === AgentName.Search ? "text-a2a" : "text-agui";

  return (
    <div className="animate-fade-up min-w-0 space-y-2">
      <div className="flex items-baseline gap-2 text-[11px]">
        <span className={cn("font-medium", nameTone)}>{message.agent}</span>
        <span className="text-dim">.agent</span>
      </div>
      {message.tool && (
        <ToolCallCard
          name={message.tool.name}
          query={message.tool.query}
          results={message.tool.results}
          status="done"
        />
      )}
      <div
        className={cn(
          "text-[13.5px] leading-relaxed text-foreground prose prose-invert prose-sm max-w-none",
          message.streaming && "caret",
        )}
      >
        <ReactMarkdown>{message.content}</ReactMarkdown>
      </div>
    </div>
  );
}
