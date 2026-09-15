"use client";

import { useState, type ReactNode } from "react";
import Panel from "./Panel";
import { useJarvisStore } from "@/lib/store";

function formatUptime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
}

function CpuIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="6" y="6" width="12" height="12" rx="1" />
      <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
    </svg>
  );
}

function MemoryIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="6" width="18" height="4" rx="0.5" />
      <rect x="3" y="14" width="18" height="4" rx="0.5" />
    </svg>
  );
}

function StorageIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
    </svg>
  );
}

function Row({ icon, label, value, pct }: { icon: ReactNode; label: string; value: string; pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-cyan-dim">
          {icon}
          <span className="hud-label">{label}</span>
        </div>
        <span className="hud-value text-[13px]">{value}</span>
      </div>
      <div className="h-[3px] w-full overflow-hidden rounded-full" style={{ background: "var(--grid-line)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${clamped}%`,
            background: "var(--cyan)",
            boxShadow: "1px 0 6px 1px rgba(var(--cyan-rgb),0.7)",
          }}
        />
      </div>
    </div>
  );
}

export default function ResourceMonitorPanel({ delay = 0 }: { delay?: number }) {
  const cpuLoadPct = useJarvisStore((s) => s.cpuLoadPct);
  const memUsedGB = useJarvisStore((s) => s.memUsedGB);
  const memTotalGB = useJarvisStore((s) => s.memTotalGB);
  const storagePct = useJarvisStore((s) => s.storagePct);
  const hostUptimeSec = useJarvisStore((s) => s.hostUptimeSec);
  const hostPlatform = useJarvisStore((s) => s.hostPlatform);
  const hostCpuCount = useJarvisStore((s) => s.hostCpuCount);
  const hostNodeVersion = useJarvisStore((s) => s.hostNodeVersion);
  const [expanded, setExpanded] = useState(false);

  return (
    <Panel
      tag="RT-MONITOR"
      redactedLabel="SYSTEM RESOURCES // LOCKED"
      className="h-full"
      delay={delay}
      onClick={() => setExpanded((v) => !v)}
      clickLabel={expanded ? "Collapse resource detail" : "Expand resource detail"}
    >
      <Row icon={<CpuIcon />} label="CPU Load" value={`${cpuLoadPct}%`} pct={cpuLoadPct} />
      <Row
        icon={<MemoryIcon />}
        label="Memory"
        value={`${memUsedGB.toFixed(1)} GB`}
        pct={memTotalGB > 0 ? (memUsedGB / memTotalGB) * 100 : 0}
      />
      <Row icon={<StorageIcon />} label="Storage" value={`${storagePct}%`} pct={storagePct} />

      {expanded && (
        <div className="mt-1 space-y-1 border-t pt-2 text-[10px]" style={{ borderColor: "var(--panel-border)" }}>
          <div className="flex justify-between">
            <span className="hud-label">Uptime</span>
            <span className="text-cyan-dim">{formatUptime(hostUptimeSec)}</span>
          </div>
          <div className="flex justify-between">
            <span className="hud-label">Platform</span>
            <span className="text-cyan-dim">
              {hostPlatform || "—"} · {hostCpuCount || "—"} cores
            </span>
          </div>
          <div className="flex justify-between">
            <span className="hud-label">Runtime</span>
            <span className="text-cyan-dim">{hostNodeVersion || "—"}</span>
          </div>
        </div>
      )}
    </Panel>
  );
}
