"use client";

import { useJarvisStore, type PipelineState } from "@/lib/store";
import { useWaveformBars } from "@/lib/useAudioLevels";

const STATUS_LABEL: Record<PipelineState, string> = {
  idle: "AWAITING COMMAND...",
  listening: "LISTENING...",
  transcribing: "PROCESSING...",
  thinking: "PROCESSING...",
  speaking: "RESPONDING...",
  error: "SYSTEM ERROR",
};

function MicIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <path d="M12 19v3" strokeLinecap="round" />
    </svg>
  );
}

interface VoiceBarProps {
  onToggle: () => void;
}

export default function VoiceBar({ onToggle }: VoiceBarProps) {
  const pipelineState = useJarvisStore((s) => s.pipelineState);
  const micBlocked = useJarvisStore((s) => s.micBlocked);
  const micLevel = useJarvisStore((s) => s.micLevel);
  const playbackLevel = useJarvisStore((s) => s.playbackLevel);

  const active = pipelineState === "listening" || pipelineState === "speaking";
  const level = pipelineState === "listening" ? micLevel : pipelineState === "speaking" ? playbackLevel : 0;
  const bars = useWaveformBars(level, active, 24);

  const label = micBlocked ? "MIC BLOCKED" : STATUS_LABEL[pipelineState];
  const amber = micBlocked || pipelineState === "error";

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex h-10 items-end gap-[3px]" aria-hidden>
        {bars.map((h, i) => (
          <div
            key={i}
            className="w-[3px] rounded-full transition-[height] duration-75 ease-out"
            style={{
              height: `${Math.max(3, h * 40)}px`,
              background: "var(--cyan)",
              boxShadow: h > 0.45 ? "0 0 6px rgba(0,212,255,0.7)" : "none",
            }}
          />
        ))}
      </div>

      <button
        onClick={onToggle}
        className={`flex items-center gap-2 rounded-full border px-5 py-2 text-[11px] uppercase tracking-[0.12em] transition ${
          micBlocked ? "animate-[flash-amber_1.4s_ease-in-out_2]" : ""
        }`}
        style={{
          borderColor: amber ? "var(--amber)" : "var(--panel-border)",
          color: amber ? "var(--amber)" : "var(--cyan)",
          background: "var(--panel)",
        }}
      >
        <MicIcon />
        {label}
      </button>
    </div>
  );
}
