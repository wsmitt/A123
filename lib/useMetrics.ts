"use client";

import { useEffect } from "react";
import { useJarvisStore } from "./store";

const POLL_MS = 3000;
// Soft cap used only to turn "bytes of conversation held in memory" into a
// bar-friendly percentage — not a real storage limit.
const SESSION_BYTES_CAP = 8000;

interface MetricsResponse {
  cpuLoadPct: number;
  memUsedGB: number;
  memTotalGB: number;
  uptimeSec: number;
  platform: string;
  cpuCount: number;
  nodeVersion: string;
}

/**
 * Polls /api/metrics for real host telemetry and measures the round-trip
 * latency of that same request as the "network" reading. Session storage
 * (turn count / byte size) is computed from the in-memory conversation the
 * browser is already holding — there's no server-side session to ask.
 */
export function useMetrics(): void {
  const setMetrics = useJarvisStore((s) => s.setMetrics);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const turns = useJarvisStore.getState().turns;
      const sessionBytes = new TextEncoder().encode(JSON.stringify(turns)).length;
      const storagePct = Math.min(100, Math.round((sessionBytes / SESSION_BYTES_CAP) * 100));

      const start = performance.now();
      try {
        const res = await fetch("/api/metrics", { cache: "no-store" });
        const latencyMs = Math.round(performance.now() - start);
        if (!res.ok) throw new Error(`metrics ${res.status}`);
        const data: MetricsResponse = await res.json();
        if (cancelled) return;
        setMetrics({
          cpuLoadPct: data.cpuLoadPct,
          memUsedGB: data.memUsedGB,
          memTotalGB: data.memTotalGB,
          storagePct,
          sessionTurns: turns.length,
          sessionBytes,
          online: typeof navigator === "undefined" ? true : navigator.onLine,
          latencyMs,
          hostUptimeSec: data.uptimeSec,
          hostPlatform: data.platform,
          hostCpuCount: data.cpuCount,
          hostNodeVersion: data.nodeVersion,
        });
      } catch {
        if (cancelled) return;
        setMetrics({
          storagePct,
          sessionTurns: turns.length,
          sessionBytes,
          online: typeof navigator === "undefined" ? true : navigator.onLine,
          latencyMs: null,
        });
      }
    }

    void poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [setMetrics]);
}
