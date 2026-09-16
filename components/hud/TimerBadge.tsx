"use client";

import { useEffect, useState } from "react";
import { useJarvisStore } from "@/lib/store";

function formatRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Live countdown for a voice-set timer (see the set_timer tool in
// useVoicePipeline.ts) — only ticks while a timer is actually running, so
// it costs nothing the rest of the time.
export default function TimerBadge() {
  const activeTimer = useJarvisStore((s) => s.activeTimer);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!activeTimer) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [activeTimer]);

  if (!activeTimer) return null;

  return (
    <div
      className="hidden items-center gap-1.5 sm:flex sm:gap-2"
      title={`Timer: ${activeTimer.label}`}
    >
      <span className="hud-label hidden xl:inline">Timer</span>
      <span
        aria-hidden
        className="h-1.5 w-1.5 animate-pulse rounded-full"
        style={{ background: "var(--amber)" }}
      />
      <span
        className="whitespace-nowrap text-[10px] font-semibold tracking-[0.1em] sm:text-[11px]"
        style={{ color: "var(--amber)" }}
      >
        {formatRemaining(activeTimer.endsAt - now)}
      </span>
    </div>
  );
}
