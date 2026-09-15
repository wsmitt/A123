"use client";

// Lightweight synthesized UI sounds via Web Audio oscillators — no audio
// assets to host or fetch. A separate, dedicated AudioContext from the one
// in useVoicePipeline.ts keeps this module decoupled and callable from
// anywhere (tool-call handlers, the boot sequence) without threading a ref
// through the whole app; browsers allow more than one AudioContext.
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  return ctx;
}

function tone(freq: number, startAt: number, duration: number, gainPeak: number, type: OscillatorType) {
  const audio = getCtx();
  if (!audio) return;
  void audio.resume().catch(() => {});

  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audio.currentTime + startAt);
  gain.gain.setValueAtTime(0, audio.currentTime + startAt);
  gain.gain.linearRampToValueAtTime(gainPeak, audio.currentTime + startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + startAt + duration);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(audio.currentTime + startAt);
  osc.stop(audio.currentTime + startAt + duration + 0.02);
}

/** A soft, short click — played whenever a tool call executes. */
export function playClickSound(): void {
  tone(1400, 0, 0.05, 0.08, "square");
}

/** A rising three-note sweep — played once when the boot sequence starts. */
export function playBootTone(): void {
  tone(320, 0, 0.18, 0.07, "sine");
  tone(640, 0.15, 0.28, 0.09, "sine");
  tone(960, 0.35, 0.32, 0.07, "sine");
}
