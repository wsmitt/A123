"use client";

import { useEffect, useRef } from "react";
import Panel from "./Panel";
import { clearLogs, useLogs } from "@/lib/logBus";

const LEVEL_COLOR: Record<string, string> = {
  info: "var(--cyan-dim)",
  warn: "var(--amber)",
  error: "#ff5f5f",
};

export default function SystemLogPanel({ delay = 0 }: { delay?: number }) {
  const logs = useLogs();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  return (
    <Panel
      tag="RT-LOG"
      redactedLabel="AUDIT STREAM // LOCKED"
      className="h-full"
      bodyClassName="flex min-h-0 flex-col"
      delay={delay}
    >
      <div className="mb-1 flex justify-end">
        <button
          onClick={() => clearLogs()}
          disabled={logs.length === 0}
          className="text-[9px] uppercase tracking-[0.1em] text-cyan-dim/70 transition hover:text-cyan disabled:opacity-30 disabled:hover:text-cyan-dim/70"
        >
          Clear
        </button>
      </div>
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 text-[10px] leading-relaxed"
      >
        {logs.length === 0 && <div className="text-cyan-dim/50">Awaiting activity...</div>}
        {logs.map((entry) => (
          <div key={entry.id} className="log-typewriter" style={{ color: LEVEL_COLOR[entry.level] }}>
            <span className="text-cyan-dim/70">[{entry.time}]</span> {entry.message}
          </div>
        ))}
      </div>
    </Panel>
  );
}
