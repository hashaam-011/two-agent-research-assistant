"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted ? resolvedTheme !== "light" : true;
  const next = isDark ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} mode`}
      aria-pressed={isDark}
      title={`Switch to ${next} mode`}
      className={cn(
        "group inline-flex h-7 w-12 items-center rounded-full ring-1 px-0.5",
        "transition-colors duration-200",
        // Track tint follows the current mode — red wash in dark, lighter
        // panel in light so the knob always pops against it.
        isDark
          ? "ring-mobiz/40 bg-mobiz/15 hover:bg-mobiz/20"
          : "ring-line bg-panel-2 hover:ring-mobiz/50",
        className,
      )}
    >
      <span
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-full shadow-sm",
          "transition-all duration-200",
          isDark
            ? "translate-x-0 bg-mobiz text-white shadow-[0_0_0_2px_rgb(var(--mobiz)/0.25)]"
            : "translate-x-5 bg-mobiz text-white shadow-[0_0_0_2px_rgb(var(--mobiz)/0.25)]",
        )}
      >
        {isDark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
      </span>
    </button>
  );
}
