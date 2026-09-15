"use client";

import { create } from "zustand";
import { DEFENSE_LABELS, type DefenseKey } from "./defenseSystems";
import { pushLog } from "./logBus";

export type PipelineState =
  | "idle"
  | "listening"
  | "transcribing"
  | "thinking"
  | "speaking"
  | "error";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

interface JarvisStore {
  pipelineState: PipelineState;
  setPipelineState: (s: PipelineState) => void;

  micBlocked: boolean;
  setMicBlocked: (v: boolean) => void;

  degraded: boolean;
  retryAfter: number | null;
  setDegraded: (v: boolean, retryAfter?: number | null) => void;

  soundEnabled: boolean;
  enableSound: () => void;

  // Real audio amplitude, 0..1, sampled from the mic / playback AnalyserNodes.
  micLevel: number;
  playbackLevel: number;
  setMicLevel: (v: number) => void;
  setPlaybackLevel: (v: number) => void;

  // Conversation memory: last 12 turns, system prompt is added server-side.
  turns: ChatTurn[];
  addTurn: (turn: ChatTurn) => void;

  terminalCommand: string;
  terminalReply: string;
  setTerminalCommand: (cmd: string) => void;
  setTerminalReply: (reply: string) => void;

  // The single state handler for all four DEFENSE SYSTEMS buttons — a
  // physical tap and a voice-command tool call both call this, so the
  // button, the system log, and alert mode (shield => red HUD) can never
  // fall out of sync with each other.
  defenseSystems: Record<DefenseKey, boolean>;
  setDefenseSystem: (key: DefenseKey, on: boolean) => void;

  // Real host + session metrics, polled from /api/metrics.
  cpuLoadPct: number;
  memUsedGB: number;
  memTotalGB: number;
  storagePct: number;
  sessionTurns: number;
  sessionBytes: number;
  online: boolean;
  latencyMs: number | null;
  setMetrics: (
    m: Partial<
      Pick<
        JarvisStore,
        | "cpuLoadPct"
        | "memUsedGB"
        | "memTotalGB"
        | "storagePct"
        | "sessionTurns"
        | "sessionBytes"
        | "online"
        | "latencyMs"
      >
    >
  ) => void;
}

export const useJarvisStore = create<JarvisStore>((set) => ({
  pipelineState: "idle",
  setPipelineState: (pipelineState) => set({ pipelineState }),

  micBlocked: false,
  setMicBlocked: (micBlocked) => set({ micBlocked }),

  degraded: false,
  retryAfter: null,
  setDegraded: (degraded, retryAfter = null) => set({ degraded, retryAfter }),

  soundEnabled: false,
  enableSound: () => set({ soundEnabled: true }),

  micLevel: 0,
  playbackLevel: 0,
  setMicLevel: (micLevel) => set({ micLevel }),
  setPlaybackLevel: (playbackLevel) => set({ playbackLevel }),

  turns: [],
  addTurn: (turn) => set((s) => ({ turns: [...s.turns, turn].slice(-12) })),

  terminalCommand: "jarvis --analyze --current-environment",
  terminalReply: "",
  setTerminalCommand: (terminalCommand) => set({ terminalCommand }),
  setTerminalReply: (terminalReply) => set({ terminalReply }),

  defenseSystems: { shield: false, power: true, signal: true, reactor: false },
  setDefenseSystem: (key, on) =>
    set((s) => {
      if (s.defenseSystems[key] === on) return {};
      pushLog(`${DEFENSE_LABELS[key]} ${on ? "engaged" : "disengaged"}.`);
      return { defenseSystems: { ...s.defenseSystems, [key]: on } };
    }),

  cpuLoadPct: 0,
  memUsedGB: 0,
  memTotalGB: 0,
  storagePct: 0,
  sessionTurns: 0,
  sessionBytes: 0,
  online: true,
  latencyMs: null,
  setMetrics: (m) => set(m),
}));
