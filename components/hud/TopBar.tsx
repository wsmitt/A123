"use client";

import { useEffect, useState } from "react";
import { ASSISTANT_NAME, ASSISTANT_TAGLINE, USER_INITIAL, USER_NAME } from "@/lib/config";
import { useJarvisStore } from "@/lib/store";

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function useClock(): string {
  const [time, setTime] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("en-GB", { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return time ?? "--:--:--";
}

export default function TopBar() {
  const time = useClock();
  const degraded = useJarvisStore((s) => s.degraded);
  const retryAfter = useJarvisStore((s) => s.retryAfter);

  return (
    <div
      className="flex h-16 shrink-0 items-center justify-between border px-6"
      style={{ borderColor: "var(--panel-border)", background: "var(--panel)" }}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="inline-block h-3 w-3 rotate-45"
          style={{ background: "var(--cyan)", boxShadow: "var(--glow)" }}
        />
        <div>
          <div className="text-[18px] font-semibold tracking-[0.15em] text-cyan">
            {ASSISTANT_NAME}
          </div>
          <div className="text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>
            {ASSISTANT_TAGLINE}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2">
          <span className="hud-label">System Status</span>
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${degraded ? "" : "animate-pulse"}`}
            style={{ background: degraded ? "var(--amber)" : "var(--cyan)" }}
          />
          <span
            className="text-[11px] font-semibold tracking-[0.1em]"
            style={{ color: degraded ? "var(--amber)" : "var(--cyan)" }}
          >
            {degraded ? `DEGRADED${retryAfter ? ` (${retryAfter}s)` : ""}` : "OPTIMAL"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hud-label">Local Time</span>
          <span className="text-[11px] font-semibold tracking-[0.1em] text-cyan">{time}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button aria-label="Notifications" className="text-cyan-dim transition hover:text-cyan">
          <BellIcon />
        </button>
        <button aria-label="Settings" className="text-cyan-dim transition hover:text-cyan">
          <GearIcon />
        </button>
        <div
          className="flex items-center gap-2 rounded-full border px-3 py-1"
          style={{ borderColor: "var(--panel-border)" }}
        >
          <span className="text-[11px] tracking-[0.08em] text-cyan-dim">{USER_NAME}</span>
          <span
            aria-hidden
            className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold text-cyan"
            style={{ background: "var(--cyan-faint)" }}
          >
            {USER_INITIAL}
          </span>
        </div>
      </div>
    </div>
  );
}
