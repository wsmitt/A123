"use client";

import { useEffect, useRef, useState } from "react";

// decorative: slow, believable random-walk for values that aren't backed by
// real telemetry (heart rate, armor status, etc). Never jumps between ticks.
function driftValue(value: number, min: number, max: number, maxStep: number): number {
  const next = value + (Math.random() * 2 - 1) * maxStep;
  return Math.min(max, Math.max(min, next));
}

export function useDecorativeDrift(
  initial: number,
  min: number,
  max: number,
  maxStep: number,
  intervalMs = 2200
): number {
  const [value, setValue] = useState(initial);
  const ref = useRef(initial);

  useEffect(() => {
    const id = setInterval(() => {
      ref.current = driftValue(ref.current, min, max, maxStep);
      setValue(ref.current);
    }, intervalMs);
    return () => clearInterval(id);
  }, [min, max, maxStep, intervalMs]);

  return value;
}
