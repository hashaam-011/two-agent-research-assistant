"use client";

import { useEffect } from "react";

/**
 * Root-level error boundary. Next.js routes uncaught errors from the root
 * layout (i.e. ThemeProvider, AppStateProvider) here — `app/error.tsx`
 * doesn't cover the layout itself.
 *
 * The root layout is bypassed when this fires, so this component must render
 * its own `<html>` and `<body>` tags. Keep markup minimal and inline-styled
 * since global CSS may not be available.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#080b16",
          color: "#e6e9f5",
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
          padding: "24px",
        }}
      >
        <div
          role="alert"
          style={{
            maxWidth: 480,
            width: "100%",
            background: "#0e1221",
            border: "1px solid #262e4e",
            borderRadius: 8,
            padding: 20,
          }}
        >
          <div style={{ color: "#fb7185", fontWeight: 600, marginBottom: 12 }}>
            Fatal: root layout crashed
          </div>
          <p style={{ color: "#8a94b8", fontSize: 13, lineHeight: 1.5, margin: "0 0 16px" }}>
            Something failed before the app could mount. Check the browser console for the
            stack trace, then click reset.
          </p>
          {error.message && (
            <pre
              style={{
                background: "#12172a",
                border: "1px solid #262e4e",
                borderRadius: 6,
                padding: 10,
                fontSize: 11.5,
                color: "#e6e9f5",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                margin: "0 0 16px",
              }}
            >
              {error.message}
            </pre>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#12172a",
              color: "#e6e9f5",
              border: "1px solid #262e4e",
              borderRadius: 6,
              padding: "6px 12px",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Reset
          </button>
        </div>
      </body>
    </html>
  );
}
