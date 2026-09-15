"use client";

import { useJarvisStore } from "@/lib/store";

// Rounded to a fixed precision so the path string is byte-identical between
// server and client renders — raw floats can differ in the last bit between
// Node's and the browser's Math.cos/sin, which React flags as a hydration
// mismatch even though the values are visually indistinguishable.
function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const toRad = (d: number) => ((d - 90) * Math.PI) / 180;
  const round = (n: number) => Math.round(n * 100) / 100;
  const x1 = round(cx + r * Math.cos(toRad(startDeg)));
  const y1 = round(cy + r * Math.sin(toRad(startDeg)));
  const x2 = round(cx + r * Math.cos(toRad(endDeg)));
  const y2 = round(cy + r * Math.sin(toRad(endDeg)));
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

// The radar reacts to the voice pipeline's real state: idle dims and slows,
// listening flexes the rings with real mic amplitude, thinking speeds the
// sweep, and speaking pulses the core with real playback amplitude.
export default function CoreRadar() {
  const pipelineState = useJarvisStore((s) => s.pipelineState);
  const micLevel = useJarvisStore((s) => s.micLevel);
  const playbackLevel = useJarvisStore((s) => s.playbackLevel);

  const sweepDuration = pipelineState === "thinking" ? 1.2 : 4;
  const listening = pipelineState === "listening";
  const speaking = pipelineState === "speaking";
  const idle = pipelineState === "idle";

  const ringScale = listening ? 1 + Math.min(0.14, micLevel * 1.6) : 1;
  const centerScale = speaking ? 1 + Math.min(0.3, playbackLevel * 2.2) : 1;

  return (
    <div className="relative mx-auto flex aspect-square w-full max-w-[420px] items-center justify-center">
      <div
        className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2"
        style={{ background: "var(--grid-line)" }}
      />
      <div
        className="absolute bottom-0 left-1/2 top-0 w-px -translate-x-1/2"
        style={{ background: "var(--grid-line)" }}
      />

      <svg
        viewBox="0 0 400 400"
        className="absolute inset-0 h-full w-full"
        style={{ opacity: idle ? 0.55 : 1, transition: "opacity 0.6s ease-out" }}
      >
        <g style={{ transformOrigin: "200px 200px", animation: "radar-spin-slow 60s linear infinite" }}>
          <circle cx="200" cy="200" r="190" fill="none" stroke="var(--cyan-faint)" strokeWidth="1" strokeDasharray="4 9" />
        </g>
        <circle
          cx="200"
          cy="200"
          r="150"
          fill="none"
          stroke="var(--cyan-faint)"
          strokeWidth="1"
          style={{ transform: `scale(${ringScale})`, transformOrigin: "200px 200px", transition: "transform 0.15s ease-out" }}
        />
        <circle
          cx="200"
          cy="200"
          r="108"
          fill="none"
          stroke="var(--cyan-faint)"
          strokeWidth="1"
          style={{ transform: `scale(${ringScale})`, transformOrigin: "200px 200px", transition: "transform 0.15s ease-out" }}
        />
        <path
          d={arcPath(200, 200, 190, 32, 76)}
          fill="none"
          stroke="var(--cyan)"
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{ filter: "drop-shadow(0 0 4px rgba(0,212,255,0.85))" }}
        />
        <path
          d={arcPath(200, 200, 190, 208, 244)}
          fill="none"
          stroke="var(--cyan)"
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{ filter: "drop-shadow(0 0 4px rgba(0,212,255,0.85))" }}
        />
      </svg>

      <div
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg, rgba(0,212,255,0.3) 16deg, transparent 44deg)",
          animation: `radar-sweep ${sweepDuration}s linear infinite`,
        }}
      />

      <div
        className="relative z-10 flex h-24 w-24 flex-col items-center justify-center rounded-full border"
        style={{
          borderColor: "var(--cyan-faint)",
          background: "rgba(0,212,255,0.04)",
          transform: `scale(${centerScale})`,
          transition: "transform 0.1s ease-out",
        }}
      >
        <div className="mb-1.5 grid grid-cols-3 gap-[3px]">
          {Array.from({ length: 9 }).map((_, i) => (
            <span key={i} className="h-[3px] w-[3px]" style={{ background: "var(--cyan)" }} />
          ))}
        </div>
        <div className="text-center text-[11px] font-medium leading-tight text-cyan">
          <div>CORE</div>
          <div>{pipelineState === "error" ? "ERROR" : "ACTIVE"}</div>
        </div>
      </div>
    </div>
  );
}
