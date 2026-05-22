"use client";

import Image from "next/image";
import { ProtocolPill } from "@/components/protocol-pill";
import { StatusPill } from "@/components/status-pill";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAppState } from "@/components/app-state";

const PILLS = ["MCP", "A2A", "AG-UI", "CopilotKit"] as const;

export function ConsoleHeader() {
  const { status } = useAppState();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/65">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 pl-3 pr-4 sm:pl-4 sm:pr-6 lg:pl-6 lg:pr-8">
        {/* Brand — anchored to the left edge of the nav. */}
        <div className="flex shrink-0 items-center gap-3 min-w-0">
          <Image
            src="/mobiz-logo.png"
            alt="Mobiz"
            width={160}
            height={96}
            priority
            className="h-10 w-auto"
          />
          <span className="hidden sm:inline text-[12px] font-medium text-muted truncate">
            · Agent Research Console
          </span>
        </div>

        {/* Protocol pills */}
        <div className="mobile-pill-fade ml-1 flex flex-1 items-center gap-1.5 overflow-x-auto md:ml-2 md:justify-center md:overflow-visible">
          {PILLS.map((pill) => (
            <ProtocolPill key={pill} name={pill} />
          ))}
        </div>

        {/* Right cluster */}
        <div className="ml-auto flex items-center gap-3">
          <StatusPill status={status} />
          <span className="hidden h-4 w-px bg-line sm:block" />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
