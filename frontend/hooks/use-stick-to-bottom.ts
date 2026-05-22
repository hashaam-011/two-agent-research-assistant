"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Sticky-scroll behaviour: keep the container pinned to the bottom as new
 * content arrives, but only while the user is already near the bottom. The
 * moment they scroll up to re-read earlier content, auto-scroll pauses; when
 * they scroll back down it resumes.
 *
 * `deps` should include the data that triggers content growth (messages,
 * events, etc.). `threshold` is the px slack we consider "at the bottom" —
 * 80px tolerates a single new line arriving between renders.
 */
export function useStickToBottom<T extends HTMLElement>(
  deps: ReadonlyArray<unknown>,
  threshold = 80,
): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const stuckRef = useRef(true);

  // Track whether the user is currently "at the bottom". Re-attach when the
  // ref node changes (e.g. on remount).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      stuckRef.current = distanceFromBottom <= threshold;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [threshold]);

  // Pin to bottom whenever the watched deps change AND the user is stuck.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = ref.current;
    if (!el || !stuckRef.current) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, deps);

  return ref;
}
