"use client";

import { useState } from "react";
import Panel from "./Panel";
import { SAT_LINK_NAME } from "@/lib/config";
import { useJarvisStore } from "@/lib/store";

function NoSignalIcon({ color }: { color: string }) {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
      <path d="M4 18h1.5v-3H4v3zM8 18h1.5V9H8v9zM12 18h1.5V6H12v12zM16 18h1.5v-8H16v8z" strokeLinejoin="round" />
      <path d="M3 3l18 18" strokeLinecap="round" />
    </svg>
  );
}

export default function NetworkPanel({ delay = 0 }: { delay?: number }) {
  const online = useJarvisStore((s) => s.online);
  const latencyMs = useJarvisStore((s) => s.latencyMs);
  const setMetrics = useJarvisStore((s) => s.setMetrics);
  // Real, not cosmetic: the Signal defense button cuts this panel's uplink
  // directly, independent of actual network status — toggle it off and the
  // panel drops to "Uplink Offline" and refuses to ping until it's back on.
  const signalOn = useJarvisStore((s) => s.defenseSystems.signal);
  const [pinging, setPinging] = useState(false);
  const up = online && signalOn;
  const color = up ? "var(--cyan-dim)" : "var(--amber)";

  // Real: fires an actual request to /api/metrics and measures its own
  // round trip, independent of the background 3s poll — a real re-ping on
  // demand, not just re-showing the last cached number.
  async function pingNow() {
    if (pinging || !signalOn) return;
    setPinging(true);
    const start = performance.now();
    try {
      const res = await fetch("/api/metrics", { cache: "no-store" });
      const measured = Math.round(performance.now() - start);
      setMetrics({ latencyMs: res.ok ? measured : null, online: navigator.onLine });
    } catch {
      setMetrics({ latencyMs: null, online: navigator.onLine });
    } finally {
      setPinging(false);
    }
  }

  return (
    <Panel
      tag="UP-LINK: 5GB/S"
      redactedLabel="COMMS ARRAY // LOCKED"
      className="h-full"
      delay={delay}
      onClick={() => void pingNow()}
      clickLabel={signalOn ? "Ping uplink now" : "Signal disabled"}
    >
      <div className="flex h-full flex-col items-center justify-center gap-2 py-4 text-center">
        <NoSignalIcon color={color} />
        <div className="hud-label" style={{ color }}>
          {!signalOn ? "Signal Disabled" : online ? "Signal Encrypted" : "Uplink Offline"}
        </div>
        <div className="hud-redacted text-[10px] uppercase tracking-[0.1em] text-cyan-dim/70">
          {SAT_LINK_NAME}
        </div>
        <div className="text-[9px] uppercase tracking-[0.1em] text-cyan-dim/60">
          {!signalOn ? "No carrier" : pinging ? "Pinging..." : latencyMs !== null ? `Ping ${latencyMs}ms` : "Tap to ping"}
        </div>
      </div>
    </Panel>
  );
}
