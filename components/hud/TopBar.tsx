"use client";

import { useEffect, useState } from "react";
import { ASSISTANT_NAME, ASSISTANT_TAGLINE, USER_INITIAL, USER_NAME } from "@/lib/config";
import { useJarvisStore } from "@/lib/store";
import TimerBadge from "./TimerBadge";

function BellIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      {muted && <path d="M3 3l18 18" strokeLinecap="round" />}
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

// Real, not cosmetic: derived entirely from live pipeline/system state, and
// CRITICAL automatically renders in red because it reuses var(--cyan),
// which alert mode (shield engaged) already overrides HUD-wide.
function useThreatLevel(): { label: string; color: string; dim: boolean } {
  const systemOn = useJarvisStore((s) => s.systemOn);
  const pipelineState = useJarvisStore((s) => s.pipelineState);
  const alertMode = useJarvisStore((s) => s.defenseSystems.shield);
  const degraded = useJarvisStore((s) => s.degraded);

  if (!systemOn) return { label: "OFFLINE", color: "var(--cyan-dim)", dim: true };
  if (alertMode) return { label: "CRITICAL", color: "var(--cyan)", dim: false };
  if (degraded) return { label: "ELEVATED", color: "var(--amber)", dim: false };
  if (pipelineState !== "idle") return { label: "ACTIVE", color: "var(--cyan)", dim: false };
  return { label: "MINIMAL", color: "var(--cyan-dim)", dim: true };
}

export default function TopBar() {
  const time = useClock();
  const degraded = useJarvisStore((s) => s.degraded);
  const retryAfter = useJarvisStore((s) => s.retryAfter);
  const standby = useJarvisStore((s) => !s.systemOn);
  const soundEffectsEnabled = useJarvisStore((s) => s.soundEffectsEnabled);
  const toggleSoundEffects = useJarvisStore((s) => s.toggleSoundEffects);
  const reducedMotionOverride = useJarvisStore((s) => s.reducedMotionOverride);
  const toggleReducedMotionOverride = useJarvisStore((s) => s.toggleReducedMotionOverride);
  const threat = useThreatLevel();

  return (
    <div
      className={`sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-2 border px-3 sm:px-6 ${
        standby ? "standby-dim" : ""
      }`}
      style={{ borderColor: "var(--panel-border)", background: "var(--panel)" }}
    >
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <span
          aria-hidden
          className="inline-block h-3 w-3 shrink-0 rotate-45"
          style={{ background: "var(--cyan)", boxShadow: "var(--glow)" }}
        />
        <div className="min-w-0">
          <div className="truncate text-[16px] font-semibold tracking-[0.15em] text-cyan sm:text-[18px]">
            {ASSISTANT_NAME}
          </div>
          <div
            className="hidden truncate text-[9px] uppercase tracking-[0.1em] lg:block"
            style={{ color: "var(--text-muted)" }}
          >
            {ASSISTANT_TAGLINE}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 md:gap-6 xl:gap-8">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="hud-label hidden xl:inline">System Status</span>
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${degraded ? "" : "animate-pulse"}`}
            style={{ background: degraded ? "var(--amber)" : "var(--cyan)" }}
          />
          <span
            className="whitespace-nowrap text-[10px] font-semibold tracking-[0.1em] sm:text-[11px]"
            style={{ color: degraded ? "var(--amber)" : "var(--cyan)" }}
          >
            {degraded ? `DEGRADED${retryAfter ? ` (${retryAfter}s)` : ""}` : "OPTIMAL"}
          </span>
        </div>
        <div className="hidden items-center gap-1.5 sm:flex sm:gap-2">
          <span className="hud-label hidden xl:inline">Threat</span>
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: threat.color, opacity: threat.dim ? 0.5 : 1 }}
          />
          <span
            className="whitespace-nowrap text-[10px] font-semibold tracking-[0.1em] sm:text-[11px]"
            style={{ color: threat.color, opacity: threat.dim ? 0.6 : 1 }}
          >
            {threat.label}
          </span>
        </div>
        <TimerBadge />
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="hud-label hidden xl:inline">Local Time</span>
          <span className="whitespace-nowrap text-[10px] font-semibold tracking-[0.1em] text-cyan sm:text-[11px]">
            {time}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <button
          onClick={toggleSoundEffects}
          aria-pressed={!soundEffectsEnabled}
          aria-label={soundEffectsEnabled ? "Mute notification sounds" : "Unmute notification sounds"}
          title={soundEffectsEnabled ? "Notification sounds on" : "Notification sounds muted"}
          className="hidden transition hover:text-cyan sm:block"
          style={{ color: soundEffectsEnabled ? "var(--cyan-dim)" : "var(--amber)" }}
        >
          <BellIcon muted={!soundEffectsEnabled} />
        </button>
        <button
          onClick={toggleReducedMotionOverride}
          aria-pressed={reducedMotionOverride}
          aria-label={
            reducedMotionOverride ? "Disable reduced motion" : "Enable reduced motion"
          }
          title={reducedMotionOverride ? "Reduced motion on" : "Reduced motion off"}
          className="hidden transition hover:text-cyan sm:block"
          style={{ color: reducedMotionOverride ? "var(--cyan)" : "var(--cyan-dim)" }}
        >
          <GearIcon />
        </button>
        <div
          className="flex items-center gap-2 rounded-full border px-2 py-1 sm:px-3"
          style={{ borderColor: "var(--panel-border)" }}
        >
          <span className="hidden text-[11px] tracking-[0.08em] text-cyan-dim sm:inline">
            {USER_NAME}
          </span>
          <span
            aria-hidden
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-cyan"
            style={{ background: "var(--cyan-faint)" }}
          >
            {USER_INITIAL}
          </span>
        </div>
      </div>
    </div>
  );
}
