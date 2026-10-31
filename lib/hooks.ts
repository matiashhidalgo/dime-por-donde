"use client";

import { useEffect, useRef, useState } from "react";

/** Elapsed ms since `startedAt`, ticking ~4×/s while running. */
export function useElapsed(startedAt: number | null, stoppedAt: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startedAt === null || stoppedAt !== null) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [startedAt, stoppedAt]);
  if (startedAt === null) return 0;
  return Math.max(0, (stoppedAt ?? now) - startedAt);
}

export function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Keeps the screen awake while `active` (mobile). Silently no-ops where unsupported. */
export function useWakeLock(active: boolean): void {
  const lock = useRef<{ release: () => Promise<void> } | null>(null);
  useEffect(() => {
    if (!active) return;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    let cancelled = false;
    const request = async () => {
      try {
        const l = await nav.wakeLock?.request("screen");
        if (cancelled) await l?.release();
        else lock.current = l ?? null;
      } catch {
        // Battery saver or unsupported: fine.
      }
    };
    request();
    // The lock drops when the tab hides; ask again when it comes back.
    const onVisible = () => document.visibilityState === "visible" && request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock.current?.release().catch(() => {});
      lock.current = null;
    };
  }, [active]);
}

export function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const on = () => setReduce(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce;
}

/** Crypto-backed random in [0,1) for creating codes. */
export function cryptoRandom(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 4294967296;
}
