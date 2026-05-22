import { cn } from "@/lib/utils";

const PROTOCOL_TOKEN: Record<string, string> = {
  MCP: "bg-mcp/10 text-mcp ring-mcp/30",
  A2A: "bg-a2a/10 text-a2a ring-a2a/30",
  "AG-UI": "bg-agui/10 text-agui ring-agui/30",
  CopilotKit: "bg-copilot/10 text-copilot ring-copilot/30",
  "Vercel AI": "bg-vercel/10 text-vercel ring-vercel/30",
};

const PROTOCOL_DOT: Record<string, string> = {
  MCP: "bg-mcp",
  A2A: "bg-a2a",
  "AG-UI": "bg-agui",
  CopilotKit: "bg-copilot",
  "Vercel AI": "bg-vercel",
};

export function ProtocolPill({
  name,
  className,
}: {
  name: keyof typeof PROTOCOL_TOKEN | string;
  className?: string;
}) {
  return (
    <span
      title={`${name} protocol`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11px] font-medium ring-1",
        PROTOCOL_TOKEN[name] ?? "bg-muted/10 text-muted ring-line",
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", PROTOCOL_DOT[name] ?? "bg-muted")} />
      {name}
    </span>
  );
}
