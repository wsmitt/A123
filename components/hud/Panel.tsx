"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface PanelProps {
  tag: string;
  redactedLabel?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  delay?: number;
}

// Shared panel frame: border, L-shaped corner brackets, header row with the
// blurred/redacted sub-label seen under every panel header in the reference.
export default function Panel({
  tag,
  redactedLabel = "SYS-REF-8841 // NODE-4",
  children,
  className = "",
  bodyClassName = "",
  delay = 0,
}: PanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      className={`relative flex min-w-0 flex-col rounded-[2px] border p-4 ${className}`}
      style={{ borderColor: "var(--panel-border)", background: "var(--panel)" }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute h-2 w-2 border-l-2 border-t-2"
        style={{ top: -1, left: -1, borderColor: "var(--cyan)" }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute h-2 w-2 border-b-2 border-r-2"
        style={{ bottom: -1, right: -1, borderColor: "var(--cyan)" }}
      />
      <span className="absolute right-3 top-3 flex gap-1" aria-hidden>
        <span className="h-[3px] w-[3px] rounded-full" style={{ background: "var(--cyan-faint)" }} />
        <span className="h-[3px] w-[3px] rounded-full" style={{ background: "var(--cyan-faint)" }} />
      </span>

      <div
        className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 border-b pb-1.5 pr-6"
        style={{ borderColor: "var(--panel-border)" }}
      >
        <span className="hud-label whitespace-nowrap">SYSTEM //</span>
        <span className="hud-label whitespace-nowrap">{tag}</span>
      </div>
      <div className="hud-redacted select-none py-1 text-[10px] uppercase tracking-[0.12em] text-cyan-dim/70">
        {redactedLabel}
      </div>

      <div className={`mt-2 min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </motion.div>
  );
}
