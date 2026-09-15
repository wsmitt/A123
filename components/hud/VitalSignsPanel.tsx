"use client";

import { useEffect, useRef, useState } from "react";
import Panel from "./Panel";
import { useDecorativeDrift } from "@/lib/decorative";

// decorative: a stylized, looping heartbeat trace — not a real biosignal.
function ecgPoints(offsetX: number): string {
  const points: [number, number][] = [];
  const blip = (bx: number) => {
    points.push([bx, 20], [bx + 8, 20], [bx + 12, 20], [bx + 15, 5], [bx + 18, 35], [bx + 21, 17], [bx + 24, 20], [bx + 40, 20]);
  };
  for (let i = 0; i < 4; i++) blip(offsetX + i * 60);
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

function EcgWave() {
  return (
    // min-w-0 matters here: the svg's intrinsic width (200% for the seamless
    // scroll loop) would otherwise force this flex-nested ancestor chain
    // wider than the viewport, even though overflow-hidden clips the paint.
    <div className="h-10 w-full min-w-0 overflow-hidden">
      <svg
        viewBox="0 0 480 40"
        preserveAspectRatio="none"
        width="200%"
        height="100%"
        className="ecg-track"
      >
        <polyline
          points={ecgPoints(0)}
          fill="none"
          stroke="var(--cyan)"
          strokeWidth="1.5"
          style={{ filter: "drop-shadow(0 0 3px rgba(var(--cyan-rgb),0.6))" }}
        />
        <polyline
          points={ecgPoints(240)}
          fill="none"
          stroke="var(--cyan)"
          strokeWidth="1.5"
          style={{ filter: "drop-shadow(0 0 3px rgba(var(--cyan-rgb),0.6))" }}
        />
      </svg>
    </div>
  );
}

// decorative: histogram bars regenerate on an interval, gently, for texture.
// Starts at a fixed height so the server-rendered and first client render
// match; randomizes only after mount to avoid a hydration mismatch.
function useHistogram(barCount: number, intervalMs: number): number[] {
  const [bars, setBars] = useState<number[]>(() => Array.from({ length: barCount }, () => 45));
  useEffect(() => {
    const randomize = () => setBars(Array.from({ length: barCount }, () => 20 + Math.random() * 70));
    randomize();
    const id = setInterval(randomize, intervalMs);
    return () => clearInterval(id);
  }, [barCount, intervalMs]);
  return bars;
}

function SubCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-[2px] border px-3 py-2" style={{ borderColor: "var(--panel-border)" }}>
      <div className="hud-label">{label}</div>
      <div className="hud-value text-[15px]">{value}</div>
    </div>
  );
}

export default function VitalSignsPanel({ delay = 0 }: { delay?: number }) {
  const heartRate = useDecorativeDrift(72, 68, 76, 0.4, 1800); // decorative
  const bodyTemp = useDecorativeDrift(98.6, 98.2, 98.9, 0.05, 2400); // decorative
  const bars = useHistogram(28, 2000); // decorative
  const [expanded, setExpanded] = useState(false);

  // Real, if modest: tapping the panel is a genuine action, and the
  // session min/max readout it reveals is real (min/max of the decorative
  // stream actually observed this session), not just a second copy of the
  // same number.
  const rangeRef = useRef({ min: heartRate, max: heartRate });
  rangeRef.current.min = Math.min(rangeRef.current.min, heartRate);
  rangeRef.current.max = Math.max(rangeRef.current.max, heartRate);

  return (
    <Panel
      tag="VITAL SIGNS"
      redactedLabel="BIO-METRICS // LOCKED"
      className="h-full"
      delay={delay}
      onClick={() => setExpanded((v) => !v)}
      clickLabel={expanded ? "Collapse vital signs detail" : "Expand vital signs detail"}
    >
      <div className="flex items-baseline justify-between">
        <span className="hud-label">Heart Rate</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="hud-value text-[26px] leading-none">{Math.round(heartRate)}</span>
        <span className="hud-label">bpm</span>
      </div>

      <div className="mt-1">
        <EcgWave />
      </div>

      <div className="mt-2 flex h-10 items-end gap-[2px]">
        {bars.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm transition-all duration-500"
            style={{ height: `${h}%`, background: "var(--cyan-faint)" }}
          />
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <SubCard label="Body Temp" value={`${bodyTemp.toFixed(1)} °F`} />
        <SubCard label="Neural Link" value="ACTIVE" />
      </div>

      {expanded && (
        <div className="mt-3 flex gap-2">
          <SubCard label="Session Min" value={`${Math.round(rangeRef.current.min)} bpm`} />
          <SubCard label="Session Max" value={`${Math.round(rangeRef.current.max)} bpm`} />
        </div>
      )}
    </Panel>
  );
}
