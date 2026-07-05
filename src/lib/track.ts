"use client";

import { useCallback, useEffect } from "react";
import type { EventName } from "@/shared/schemas";

// FE-14 — useTrack: fila local + flush em batch para /api/events
// (flush no visibilitychange via sendBeacon). RNF-10.

type EventProps = Record<string, string | number | boolean>;

interface QueuedEvent {
  name: EventName;
  props: EventProps;
}

const queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flush(useBeacon = false) {
  if (queue.length === 0) return;
  const batch = queue.splice(0, 20);
  const payload = JSON.stringify({ events: batch });
  if (useBeacon && navigator.sendBeacon) {
    navigator.sendBeacon("/api/events", new Blob([payload], { type: "application/json" }));
  } else {
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  }
  if (queue.length > 0) scheduleFlush();
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, 5_000);
}

export function trackEvent(name: EventName, props: EventProps = {}) {
  queue.push({ name, props });
  if (queue.length >= 20) flush();
  else scheduleFlush();
}

let listenerInstalled = false;

export function useTrack() {
  useEffect(() => {
    if (listenerInstalled) return;
    listenerInstalled = true;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
  }, []);

  return useCallback((name: EventName, props: EventProps = {}) => {
    trackEvent(name, props);
  }, []);
}

/** page views das telas do funil (FE-14) */
export function usePageView(page: string) {
  const track = useTrack();
  useEffect(() => {
    track("page_view", { page });
  }, [page, track]);
}
