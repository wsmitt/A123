"use client";

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

export default function NetworkPanel() {
  const online = useJarvisStore((s) => s.online);
  const latencyMs = useJarvisStore((s) => s.latencyMs);
  const color = online ? "var(--cyan-dim)" : "var(--amber)";

  return (
    <Panel tag="UP-LINK: 5GB/S" redactedLabel="COMMS ARRAY // LOCKED" className="h-full">
      <div className="flex h-full flex-col items-center justify-center gap-2 py-4 text-center">
        <NoSignalIcon color={color} />
        <div className="hud-label" style={{ color }}>
          {online ? "Signal Encrypted" : "Uplink Offline"}
        </div>
        <div className="hud-redacted text-[10px] uppercase tracking-[0.1em] text-cyan-dim/70">
          {SAT_LINK_NAME}
        </div>
        {online && latencyMs !== null && (
          <div className="text-[9px] uppercase tracking-[0.1em] text-cyan-dim/60">
            Ping {latencyMs}ms
          </div>
        )}
      </div>
    </Panel>
  );
}
