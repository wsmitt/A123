"use client";

import { useEffect, useRef, useState } from "react";
import Panel from "./Panel";
import { useJarvisStore } from "@/lib/store";

const TYPE_MS = 18;

// Types out the real model reply at a steady ~18ms/char regardless of how
// bursty the underlying stream chunks are, so the terminal always reads as
// a deliberate typewriter rather than jumpy network chunks.
function useTypewriter(target: string): string {
  const [displayed, setDisplayed] = useState("");
  const targetRef = useRef(target);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  targetRef.current = target;

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDisplayed(target);
      return;
    }

    setDisplayed((prev) => (target.startsWith(prev) ? prev : ""));

    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      setDisplayed((prev) => {
        const t = targetRef.current;
        if (prev.length >= t.length) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return prev;
        }
        return t.slice(0, prev.length + 1);
      });
    }, TYPE_MS);
  }, [target]);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    []
  );

  return displayed;
}

export default function TerminalPanel({ delay = 0 }: { delay?: number }) {
  const command = useJarvisStore((s) => s.terminalCommand);
  const reply = useJarvisStore((s) => s.terminalReply);
  const displayed = useTypewriter(reply);
  const [copied, setCopied] = useState(false);

  async function copyReply() {
    if (!reply || typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(reply);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard permission denied — not worth surfacing as an error.
    }
  }

  return (
    <Panel
      tag="ROOT@JARVIS"
      redactedLabel="SHELL SESSION // LOCKED"
      className="h-full"
      bodyClassName="flex min-h-0 flex-col"
      delay={delay}
    >
      <div className="flex items-baseline justify-between text-[11px] text-cyan">
        <div className="min-w-0 truncate">
          <span className="text-cyan-dim">{">_"}</span> {command}
        </div>
        {reply && (
          <button
            onClick={() => void copyReply()}
            className="shrink-0 pl-2 text-[9px] uppercase tracking-[0.1em] text-cyan-dim/70 transition hover:text-cyan"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>
      <div
        className="mt-2 flex-1 overflow-y-auto text-[11px] italic leading-relaxed"
        style={{ color: "var(--text-muted)" }}
      >
        {displayed}
        {displayed.length < reply.length && <span className="animate-pulse">▋</span>}
      </div>
    </Panel>
  );
}
