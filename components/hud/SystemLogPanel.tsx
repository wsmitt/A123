"use client";

import { useEffect, useRef } from "react";
import Panel from "./Panel";
import { useLogs } from "@/lib/logBus";

const LEVEL_COLOR: Record<string, string> = {
  info: "var(--cyan-dim)",
  warn: "var(--amber)",
  error: "#ff5f5f",
};

export default function SystemLogPanel() {
  const logs = useLogs();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  return (
    <Panel tag="RT-LOG" redactedLabel="AUDIT STREAM // LOCKED" className="h-full" bodyClassName="min-h-0">
      <div ref={scrollRef} className="h-full max-h-full space-y-1 overflow-y-auto pr-1 text-[10px] leading-relaxed">
        {logs.length === 0 && (
          <div className="text-cyan-dim/50">Awaiting activity...</div>
        )}
        {logs.map((entry) => (
          <div key={entry.id} style={{ color: LEVEL_COLOR[entry.level] }}>
            <span className="text-cyan-dim/70">[{entry.time}]</span> {entry.message}
          </div>
        ))}
      </div>
    </Panel>
  );
}
