"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Turns a single real amplitude scalar (0..1, sampled every frame from a
 * live mic or playback AnalyserNode in useVoicePipeline) into a symmetric
 * bar array for the waveform UI. Bars nearer the center read louder, which
 * is how a real voice waveform reads, and each bar gets light per-frame
 * jitter so the shape keeps moving even under a sustained level. When
 * `active` is false the bars fall back to a slow sine shimmer instead of
 * flatlining.
 */
export function useWaveformBars(level: number, active: boolean, barCount = 24): number[] {
  const [bars, setBars] = useState<number[]>(() => new Array(barCount).fill(0.05));
  const rafRef = useRef<number | null>(null);
  const frameRef = useRef(0);
  const levelRef = useRef(level);
  const activeRef = useRef(active);

  levelRef.current = level;
  activeRef.current = active;

  useEffect(() => {
    const tick = () => {
      frameRef.current += 1;
      const next: number[] = [];
      for (let i = 0; i < barCount; i++) {
        const centerDistance = Math.abs(i - (barCount - 1) / 2) / (barCount / 2);
        const envelope = 1 - centerDistance * 0.7;
        if (activeRef.current) {
          const jitter = 0.65 + Math.random() * 0.35;
          next.push(Math.min(1, Math.max(0.04, levelRef.current * 3 * envelope * jitter)));
        } else {
          const shimmer = (Math.sin(frameRef.current / 18 + i * 0.5) + 1) / 2;
          next.push(0.04 + shimmer * 0.05);
        }
      }
      setBars(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [barCount]);

  return bars;
}
