"use client";

import { useJarvisStore } from "@/lib/store";

// Rounded to a fixed precision so the path string is byte-identical between
// server and client renders — raw floats can differ in the last bit between
// Node's and the browser's Math.cos/sin, which React flags as a hydration
// mismatch even though the values are visually indistinguishable.
// decorative: fixed (not random — avoids a server/client hydration
// mismatch) starting positions; the slow per-contact drift + staggered
// ping keyframes are what make them read as alive.
const RADAR_CONTACTS = [
  { r: 170, angle: 45, driftSec: 38, reverse: false, pingDelay: 0 },
  { r: 130, angle: 200, driftSec: 52, reverse: true, pingDelay: 1.3 },
  { r: 90, angle: 300, driftSec: 45, reverse: false, pingDelay: 2.6 },
  { r: 155, angle: 110, driftSec: 60, reverse: true, pingDelay: 0.6 },
];

function RadarContact({
  r,
  angle,
  driftSec,
  reverse,
  pingDelay,
  running,
}: (typeof RADAR_CONTACTS)[number] & { running: boolean }) {
  return (
    <g
      style={{
        transformOrigin: "200px 200px",
        animation: `radar-contact-drift ${driftSec}s linear infinite${reverse ? " reverse" : ""}`,
        animationPlayState: running ? "running" : "paused",
      }}
    >
      <g transform={`rotate(${angle} 200 200)`}>
        <circle cx={200 + r} cy="200" r="3" fill="var(--cyan)" opacity="0.85" />
        <circle
          cx={200 + r}
          cy="200"
          r="4"
          fill="none"
          stroke="var(--cyan)"
          strokeWidth="1"
          style={{
            transformBox: "fill-box",
            transformOrigin: "center",
            animation: `radar-ping 2.6s ease-out ${pingDelay}s infinite`,
            animationPlayState: running ? "running" : "paused",
          }}
        />
      </g>
    </g>
  );
}

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
// sweep, and speaking pulses the core with real playback amplitude. The
// center hub is also the HUD's real power switch — tapping it is the same
// systemOn toggle the standby dimming and voice pipeline gate read from.
export default function CoreRadar() {
  const pipelineState = useJarvisStore((s) => s.pipelineState);
  const micLevel = useJarvisStore((s) => s.micLevel);
  const playbackLevel = useJarvisStore((s) => s.playbackLevel);
  const systemOn = useJarvisStore((s) => s.systemOn);
  const toggleSystemPower = useJarvisStore((s) => s.toggleSystemPower);

  const sweepDuration = pipelineState === "thinking" ? 1.2 : 4;
  const listening = pipelineState === "listening";
  const speaking = pipelineState === "speaking";
  const idle = pipelineState === "idle";

  const ringScale = listening ? 1 + Math.min(0.14, micLevel * 1.6) : 1;
  const centerScale = speaking ? 1 + Math.min(0.3, playbackLevel * 2.2) : 1;
  const animPlayState = systemOn ? "running" : "paused";

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
        <g
          style={{
            transformOrigin: "200px 200px",
            animation: "radar-spin-slow 60s linear infinite",
            animationPlayState: animPlayState,
          }}
        >
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
          style={{ filter: "drop-shadow(0 0 4px rgba(var(--cyan-rgb),0.85))" }}
        />
        <path
          d={arcPath(200, 200, 190, 208, 244)}
          fill="none"
          stroke="var(--cyan)"
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{ filter: "drop-shadow(0 0 4px rgba(var(--cyan-rgb),0.85))" }}
        />
        {RADAR_CONTACTS.map((contact, i) => (
          <RadarContact key={i} {...contact} running={systemOn} />
        ))}
      </svg>

      <div
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg, rgba(var(--cyan-rgb),0.3) 16deg, transparent 44deg)",
          animation: `radar-sweep ${sweepDuration}s linear infinite`,
          animationPlayState: animPlayState,
        }}
      />

      <button
        onClick={toggleSystemPower}
        aria-pressed={systemOn}
        aria-label={systemOn ? "Power down JARVIS" : "Restore JARVIS power"}
        className="relative z-10 flex h-24 w-24 flex-col items-center justify-center rounded-full border transition"
        style={{
          borderColor: "var(--cyan-faint)",
          background: "rgba(var(--cyan-rgb),0.04)",
          transform: `scale(${centerScale})`,
          transition: "transform 0.1s ease-out, border-color 0.3s ease",
        }}
      >
        <div className="mb-1.5 grid grid-cols-3 gap-[3px]">
          {Array.from({ length: 9 }).map((_, i) => (
            <span key={i} className="h-[3px] w-[3px]" style={{ background: "var(--cyan)" }} />
          ))}
        </div>
        <div className="text-center text-[11px] font-medium leading-tight text-cyan">
          <div>CORE</div>
          <div>{!systemOn ? "STANDBY" : pipelineState === "error" ? "ERROR" : "ACTIVE"}</div>
        </div>
      </button>
    </div>
  );
}
