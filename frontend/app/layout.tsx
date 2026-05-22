import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  // Tab favicon comes from `app/icon.png` (the Mobiz logo) — App Router
  // auto-detects it. Title text drops the "Mobiz" word since the favicon
  // already carries the brand.
  title: "Agent Research Console",
  description:
    "Two AI agents collaborating in real time over the AI agent protocol stack — MCP · A2A · AG-UI · CopilotKit · Vercel AI SDK.",
};

export const viewport = {
  colorScheme: "dark" as const,
  themeColor: "#080b16",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark" style={{ colorScheme: "dark" }} suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
