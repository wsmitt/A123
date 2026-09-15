"use client";

import { useCallback, useEffect, useRef } from "react";
import { DEFENSE_LABELS, isDefenseKey } from "./defenseSystems";
import type { ChatMessage, ToolCallPayload } from "./groq";
import { pushLog } from "./logBus";
import { sanitizeForSpeech } from "./persona";
import { playClickSound } from "./sfx";
import { useJarvisStore, type ChatTurn } from "./store";

interface SpeechQueue {
  push: (sentence: string) => void;
  finish: () => void;
  clear: () => void;
}

// A handle on one sentence's in-flight audio playback. `finished` resolves
// only on the element's own `ended` or `error` event — never on `pause`,
// which the HTML spec also fires at the natural end of playback (right
// before `ended`) and which raced with `currentTime` reaching `duration`
// in the old code, occasionally revoking the blob URL a hair before the
// tail of the clip had actually finished playing. `stop()` is the one
// deliberate way to cut a sentence short (barge-in); nothing else may
// pause the element.
interface PlaybackHandle {
  finished: Promise<void>;
  stop: () => void;
}

// A tool call the model wants us to make, fully assembled from possibly
// many streamed delta fragments (see streamChat's accumulator below).
interface ParsedToolCall {
  id: string;
  name: string;
  argsText: string;
  arguments: Record<string, unknown>;
}

interface StreamChatResult {
  content: string;
  toolCalls: ParsedToolCall[];
}

// A single tool-calling round trip can chain at most this many times before
// we force a final answer — a safety valve against a model that keeps
// calling tools instead of ever replying.
const MAX_TOOL_ROUNDS = 4;

// ---------------------------------------------------------------------------
// Voice activity detection tuning. RMS is 0..1; below SILENCE_THRESHOLD for
// SILENCE_HOLD_MS in a row is treated as "the user stopped talking".
// ---------------------------------------------------------------------------
const SILENCE_THRESHOLD = 0.02;
const SILENCE_HOLD_MS = 1500;
const VAD_MIN_SPEECH_MS = 300; // ignore trigger-happy stops before any speech

async function callWithRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    pushLog(`${label} failed, retrying...`, "warn");
    await new Promise((r) => setTimeout(r, 800));
    return fn();
  }
}

export interface VoicePipeline {
  toggleListening: () => void;
  playBoot: (line: string) => void;
}

export function useVoicePipeline(): VoicePipeline {
  const store = useJarvisStore;

  // Refs hold the actual Web Audio / MediaRecorder graph. None of this is
  // stored in Zustand because it's mutable engine state, not UI state — re-
  // rendering React on every audio frame would blow the frame budget.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const vadRafRef = useRef<number | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const speechStartedAtRef = useRef<number>(0);
  // The handle for whatever sentence is *currently* playing, so barge-in has
  // exactly one thing to stop. Only ever set by drain() (see
  // createSpeechQueue below) and cleared by that same handle's own
  // settlement or by SpeechQueue.clear().
  const playbackRef = useRef<PlaybackHandle | null>(null);
  const stoppingRef = useRef(false);
  const speechQueueRef = useRef<SpeechQueue | null>(null);

  const getAudioCtx = useCallback((): AudioContext => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    return audioCtxRef.current;
  }, []);

  // -- VAD loop: watches the mic AnalyserNode's real amplitude and auto-stops
  // recording after a sustained quiet period. ------------------------------
  const runVad = useCallback(() => {
    const analyser = micAnalyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.fftSize);

    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sumSquares = 0;
      for (let i = 0; i < data.length; i++) {
        const centered = (data[i] - 128) / 128;
        sumSquares += centered * centered;
      }
      const rms = Math.sqrt(sumSquares / data.length);
      store.getState().setMicLevel(rms);

      const now = performance.now();
      const pastMinSpeech = now - speechStartedAtRef.current > VAD_MIN_SPEECH_MS;

      if (rms < SILENCE_THRESHOLD) {
        if (silenceStartRef.current === null) silenceStartRef.current = now;
        if (pastMinSpeech && now - silenceStartRef.current > SILENCE_HOLD_MS) {
          stopListening();
          return;
        }
      } else {
        silenceStartRef.current = null;
      }

      vadRafRef.current = requestAnimationFrame(tick);
    };
    vadRafRef.current = requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const teardownMic = useCallback(() => {
    if (vadRafRef.current !== null) cancelAnimationFrame(vadRafRef.current);
    vadRafRef.current = null;
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    store.getState().setMicLevel(0);
  }, [store]);

  // -- LISTENING ------------------------------------------------------------
  const startListening = useCallback(async () => {
    if (!store.getState().systemOn) {
      // The radar's center hub is the real power switch — every entry
      // point into listening (click, spacebar, barge-in) funnels through
      // here, so this one guard covers all of them.
      pushLog("Can't listen — system is powered down.", "warn");
      return;
    }

    if (store.getState().pipelineState === "speaking") {
      // Barge-in: a single cancellation path. clear() both stops whatever
      // sentence is currently playing (via playbackRef) and drops anything
      // still queued behind it — there's deliberately no separate pause()
      // call here that could race it.
      speechQueueRef.current?.clear();
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      store.getState().setMicBlocked(false);

      const ctx = getAudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      micAnalyserRef.current = analyser;

      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => void handleRecordingStopped();
      recorderRef.current = recorder;
      recorder.start();

      silenceStartRef.current = null;
      speechStartedAtRef.current = performance.now();
      store.getState().setPipelineState("listening");
      pushLog("Mic opened, listening for command.");
      runVad();
    } catch {
      store.getState().setMicBlocked(true);
      store.getState().setPipelineState("error");
      pushLog("Microphone permission denied.", "error");
      setTimeout(() => store.getState().setPipelineState("idle"), 2000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getAudioCtx, runVad]);

  function stopListening() {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    teardownMic();
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    } else {
      stoppingRef.current = false;
    }
  }

  // -- TRANSCRIBING -> THINKING -> SPEAKING ---------------------------------
  async function handleRecordingStopped() {
    stoppingRef.current = false;
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    chunksRef.current = [];

    if (blob.size < 500) {
      // Essentially silence / an accidental tap — go back to idle quietly.
      store.getState().setPipelineState("idle");
      return;
    }

    store.getState().setPipelineState("transcribing");
    pushLog("Transcribing audio...");

    try {
      const transcript = await callWithRetry(() => transcribe(blob), "Transcription");
      if (!transcript.trim()) {
        pushLog("No speech detected.", "warn");
        store.getState().setPipelineState("idle");
        return;
      }
      pushLog(`Transcript received: "${transcript}"`);
      store.getState().setTerminalCommand(transcript);
      await think(transcript);
    } catch (err) {
      handlePipelineError(err, "Transcription");
    }
  }

  async function transcribe(blob: Blob): Promise<string> {
    const form = new FormData();
    form.append("file", blob, "clip.webm");
    const res = await fetch("/api/transcribe", { method: "POST", body: form });
    if (!res.ok) throw await toApiError(res);
    const data: { text: string } = await res.json();
    return data.text;
  }

  // Applies one tool call to app state and returns the "tool" role message
  // reporting the result back to the model. toggle_defense_system runs
  // through the exact same handler a manual button tap uses
  // (store.setDefenseSystem), so voice and touch can never fall out of
  // sync. web_search is the only one that needs a server round trip
  // (TAVILY_API_KEY never reaches the client). Every call is logged and
  // gets a soft click, regardless of outcome.
  async function applyToolCall(call: ParsedToolCall): Promise<ChatMessage> {
    playClickSound();

    if (call.name === "toggle_defense_system") {
      const system = call.arguments.system;
      const rawState = call.arguments.state;
      pushLog(`Tool call: toggle_defense_system(${String(system)}, ${String(rawState)})`);

      if (!isDefenseKey(system)) {
        pushLog(`Tool call rejected: unknown system "${String(system)}".`, "warn");
        return {
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({ status: "error", message: "Unknown system" }),
        };
      }
      if (rawState !== "on" && rawState !== "off") {
        pushLog(`Tool call rejected: invalid state "${String(rawState)}".`, "warn");
        return {
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({ status: "error", message: "Invalid state" }),
        };
      }

      store.getState().setDefenseSystem(system, rawState === "on");
      return {
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify({
          status: "ok",
          system,
          state: rawState,
          label: DEFENSE_LABELS[system],
        }),
      };
    }

    if (call.name === "web_search") {
      const query = call.arguments.query;
      pushLog(`Tool call: web_search(${String(query)})`);

      if (typeof query !== "string" || !query.trim()) {
        pushLog("Tool call rejected: missing query.", "warn");
        return {
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({ status: "error", message: "Missing query" }),
        };
      }
      try {
        const res = await fetch("/api/tools/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });
        if (!res.ok) throw await toApiError(res);
        const data = await res.json();
        pushLog(`Web search returned ${data.results?.length ?? 0} result(s).`);
        return { role: "tool", tool_call_id: call.id, content: JSON.stringify(data) };
      } catch (err) {
        const e = err as Error;
        pushLog(`Web search failed: ${e.message}`, "error");
        return {
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({ status: "error", message: "Search unavailable" }),
        };
      }
    }

    if (call.name === "launch_missiles") {
      const target = call.arguments.target;
      const targetLabel = typeof target === "string" && target.trim() ? target.trim() : "unspecified target";
      pushLog(`Tool call: launch_missiles(${targetLabel})`);
      // Purely theatrical: a log line and a spoken confirmation, nothing
      // else. See the tool's description in lib/tools.ts.
      pushLog(`Simulated missile launch sequence initiated — target: ${targetLabel}.`, "warn");
      return {
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify({
          status: "ok",
          target: targetLabel,
          note: "Simulated for this HUD demo only — no real system was affected.",
        }),
      };
    }

    pushLog(`Unknown tool call: ${call.name}`, "warn");
    return {
      role: "tool",
      tool_call_id: call.id,
      content: JSON.stringify({ status: "error", message: "Unknown tool" }),
    };
  }

  async function think(transcript: string) {
    store.getState().setPipelineState("thinking");
    store.getState().setTerminalReply("");
    const userTurn: ChatTurn = { role: "user", content: transcript };

    // Ephemeral wire history for this request only. Tool-call/tool-result
    // messages never enter the persisted `turns` in store.ts (capped at 12
    // and reused as context for future turns), so later turns don't need
    // to re-see raw tool-call JSON — only the model's final, in-persona
    // reply is remembered, exactly as if it had answered directly.
    let wireMessages: ChatMessage[] = [...store.getState().turns, userTurn].map((t) => ({
      role: t.role,
      content: t.content,
    }));

    // Sentences are pushed into this queue the moment streamChat sees a
    // completed sentence boundary — JARVIS starts speaking well before the
    // full reply has finished streaming in, rather than waiting for it.
    const speechQueue = createSpeechQueue();
    speechQueueRef.current = speechQueue;

    try {
      let finalReply = "";

      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const result = await callWithRetry(
          () => streamChat(wireMessages, (sentence) => speechQueue.push(sentence)),
          "Chat"
        );

        if (result.toolCalls.length === 0) {
          finalReply = result.content;
          break;
        }

        pushLog(
          `Model invoked ${result.toolCalls.length} tool call${
            result.toolCalls.length > 1 ? "s" : ""
          }.`
        );

        const assistantToolMessage: ChatMessage = {
          role: "assistant",
          content: result.content || null,
          tool_calls: result.toolCalls.map(
            (tc): ToolCallPayload => ({
              id: tc.id,
              type: "function",
              function: { name: tc.name, arguments: tc.argsText },
            })
          ),
        };
        // eslint-disable-next-line no-await-in-loop
        const toolResultMessages = await Promise.all(result.toolCalls.map(applyToolCall));
        wireMessages = [...wireMessages, assistantToolMessage, ...toolResultMessages];

        if (round === MAX_TOOL_ROUNDS - 1) {
          // Force a final answer rather than looping forever. This text
          // never went through streamChat, so it never reached the speech
          // queue via onSentence — queue it directly.
          finalReply = result.content || "Done, sir.";
          if (!result.content) speechQueue.push(finalReply);
        }
      }

      store.getState().addTurn(userTurn);
      store.getState().addTurn({ role: "assistant", content: finalReply });
      store.getState().setTerminalReply(finalReply);
      pushLog("Model responded.");
      speechQueue.finish();
    } catch (err) {
      speechQueueRef.current = null;
      handlePipelineError(err, "Chat");
    }
  }

  async function streamChat(
    messages: ChatMessage[],
    onSentence?: (sentence: string) => void
  ): Promise<StreamChatResult> {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });
    if (!res.ok || !res.body) throw await toApiError(res);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = "";
    let spokenUpTo = 0;
    let buffer = "";
    // Streamed tool_calls arrive in fragments keyed by index — name and id
    // typically land in the first fragment, arguments accumulate across
    // several as the model streams out the JSON piece by piece.
    const toolCallAcc: Record<number, { id: string; name: string; argsText: string }> = {};

    // Speaks each fully-formed sentence (ending in . ! or ? followed by
    // real whitespace already in the buffer) as soon as it's complete,
    // rather than waiting for the whole reply — this is what lets JARVIS
    // start talking mid-stream. `force` flushes whatever's left at the end
    // of the stream even without trailing punctuation/whitespace.
    function flushSentences(force: boolean) {
      if (!onSentence) return;
      const unspoken = full.slice(spokenUpTo);
      if (!unspoken) return;
      if (force) {
        const trimmed = unspoken.trim();
        if (trimmed) onSentence(trimmed);
        spokenUpTo = full.length;
        return;
      }
      const sentenceRe = /[^.!?]*[.!?]+\s+/g;
      let match: RegExpExecArray | null;
      let consumedEnd = 0;
      while ((match = sentenceRe.exec(unspoken))) {
        const trimmed = match[0].trim();
        if (trimmed) onSentence(trimmed);
        consumedEnd = sentenceRe.lastIndex;
      }
      if (consumedEnd > 0) spokenUpTo += consumedEnd;
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload);
          const delta = json.choices?.[0]?.delta ?? {};
          const contentDelta: string = delta.content ?? "";
          if (contentDelta) {
            full += contentDelta;
            store.getState().setTerminalReply(full);
            flushSentences(false);
          }
          const toolCallDeltas = delta.tool_calls;
          if (Array.isArray(toolCallDeltas)) {
            for (const tc of toolCallDeltas) {
              const idx: number = tc.index ?? 0;
              if (!toolCallAcc[idx]) toolCallAcc[idx] = { id: "", name: "", argsText: "" };
              if (tc.id) toolCallAcc[idx].id = tc.id;
              if (tc.function?.name) toolCallAcc[idx].name = tc.function.name;
              if (tc.function?.arguments) toolCallAcc[idx].argsText += tc.function.arguments;
            }
          }
        } catch {
          // ignore partial/non-JSON keep-alive lines
        }
      }
    }

    flushSentences(true);

    const toolCalls: ParsedToolCall[] = Object.values(toolCallAcc)
      .filter((tc) => tc.name)
      .map((tc) => {
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = tc.argsText ? JSON.parse(tc.argsText) : {};
        } catch {
          parsedArgs = {};
        }
        return { id: tc.id, name: tc.name, argsText: tc.argsText, arguments: parsedArgs };
      });

    return { content: full.trim(), toolCalls };
  }

  // -- SPEAKING -----------------------------------------------------------
  // A per-turn FIFO of sentences: push() enqueues and kicks off playback if
  // nothing is currently draining, finish() marks no more sentences are
  // coming (so the queue can return to idle once it's empty), and clear()
  // drops everything queued for a barge-in. Sentences arrive here from
  // streamChat's onSentence callback well before the full reply is done
  // streaming, which is what lets JARVIS start talking mid-response.
  function createSpeechQueue(): SpeechQueue {
    const queue: string[] = [];
    let draining = false;
    let finished = false;
    let cleared = false;

    // Strictly sequential: the while loop only ever holds one playback
    // handle at a time, and always awaits handle.finished — which resolves
    // only on that element's own ended/error — before shifting the next
    // sentence off the queue. There is no path that starts a new play()
    // call while a previous one is still in flight.
    async function drain() {
      if (draining) return;
      draining = true;
      console.debug(`[speech-queue] drain start, ${queue.length} queued`);
      while (queue.length > 0 && !cleared) {
        const sentence = queue.shift()!;
        console.debug(`[speech-queue] dequeued, ${queue.length} remaining`);
        const clean = sanitizeForSpeech(sentence);
        if (!clean) continue;
        if (store.getState().pipelineState !== "speaking") {
          store.getState().setPipelineState("speaking");
        }
        try {
          const res = await callWithRetry(() => synthesize(clean), "Speech synthesis");
          if (cleared) break;
          console.debug(`[speech-queue] playback start: "${clean}"`);
          const handle = startPlayback(res);
          playbackRef.current = handle;
          await handle.finished;
          playbackRef.current = null;
          // A barge-in can resolve handle.finished (via stop()) partway
          // through — don't log this sentence as having actually played.
          if (cleared) {
            console.debug(`[speech-queue] playback interrupted: "${clean}"`);
            break;
          }
          console.debug(`[speech-queue] playback end: "${clean}"`);
          pushLog("TTS played.");
        } catch (err) {
          playbackRef.current = null;
          handlePipelineError(err, "Speech synthesis");
          queue.length = 0;
          draining = false;
          return;
        }
      }
      draining = false;
      console.debug(`[speech-queue] drain end (cleared=${cleared}, finished=${finished})`);
      if ((finished || cleared) && queue.length === 0 && store.getState().pipelineState === "speaking") {
        store.getState().setPipelineState("idle");
      }
    }

    return {
      push(sentence) {
        if (cleared) return;
        queue.push(sentence);
        console.debug(`[speech-queue] enqueued, ${queue.length} pending`);
        void drain();
      },
      finish() {
        finished = true;
        if (!draining && queue.length === 0 && store.getState().pipelineState === "speaking") {
          store.getState().setPipelineState("idle");
        }
      },
      clear() {
        cleared = true;
        queue.length = 0;
        // The one and only cancellation path: stop whatever's actually
        // playing right now (a no-op if we're between sentences, mid-fetch
        // of the next one). Nothing else is allowed to touch playbackRef.
        playbackRef.current?.stop();
        playbackRef.current = null;
        console.debug("[speech-queue] cleared (barge-in)");
      },
    };
  }

  async function synthesize(text: string): Promise<Blob> {
    const res = await fetch("/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw await toApiError(res);
    return res.blob();
  }

  // Starts one audio element playing and returns a handle to it. `finished`
  // resolves only on `ended` or `error` — see PlaybackHandle above for why
  // `pause` is never used to detect completion. `stop()` is the only
  // sanctioned way to cut playback short.
  function startPlayback(blob: Blob): PlaybackHandle {
    const ctx = getAudioCtx();
    const url = URL.createObjectURL(blob);
    const el = new Audio(url);

    const source = ctx.createMediaElementSource(el);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    analyser.connect(ctx.destination);

    const data = new Uint8Array(analyser.fftSize);
    let raf: number;
    const pump = () => {
      analyser.getByteTimeDomainData(data);
      let sumSquares = 0;
      for (let i = 0; i < data.length; i++) {
        const centered = (data[i] - 128) / 128;
        sumSquares += centered * centered;
      }
      store.getState().setPlaybackLevel(Math.sqrt(sumSquares / data.length));
      raf = requestAnimationFrame(pump);
    };
    raf = requestAnimationFrame(pump);

    let settled = false;
    let resolveFinished: () => void;
    const finished = new Promise<void>((resolve) => {
      resolveFinished = resolve;
    });

    const settle = (reason: "ended" | "error" | "stopped") => {
      if (settled) return;
      settled = true;
      cancelAnimationFrame(raf);
      store.getState().setPlaybackLevel(0);
      URL.revokeObjectURL(url);
      console.debug(`[speech] playback settled (${reason})`);
      resolveFinished();
    };

    el.onended = () => settle("ended");
    el.onerror = () => settle("error");
    void el.play();

    return {
      finished,
      stop() {
        if (settled) return;
        el.pause();
        settle("stopped");
      },
    };
  }

  async function playAudioBlob(blob: Blob): Promise<void> {
    await startPlayback(blob).finished;
  }

  // -- One-off boot line, gated behind a user click to satisfy autoplay policy.
  const playBoot = useCallback(
    (line: string) => {
      void (async () => {
        try {
          const res = await synthesize(sanitizeForSpeech(line));
          await playAudioBlob(res);
        } catch {
          // Non-fatal — the HUD still works without the boot line.
        }
      })();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // -- Errors -----------------------------------------------------------------
  async function toApiError(res: Response): Promise<Error> {
    const body = await res.json().catch(() => ({}) as { error?: string });
    const err = new Error(body.error ?? `Request failed (${res.status})`);
    (err as Error & { status?: number; retryAfter?: string | null }).status = res.status;
    (err as Error & { status?: number; retryAfter?: string | null }).retryAfter =
      res.headers.get("retry-after");
    return err;
  }

  function handlePipelineError(err: unknown, stage: string) {
    const e = err as Error & { status?: number; retryAfter?: string | null };
    const status = e.status;
    pushLog(`${stage} error${status ? ` (${status})` : ""}: ${e.message}`, "error");

    if (status === 429) {
      const seconds = e.retryAfter ? Number(e.retryAfter) : 15;
      store.getState().setDegraded(true, seconds);
    } else {
      store.getState().setDegraded(true, null);
    }

    store.getState().setPipelineState("error");
    store.getState().setTerminalReply("I'm having trouble reaching my systems, sir.");
    setTimeout(() => {
      store.getState().setPipelineState("idle");
      store.getState().setDegraded(false, null);
    }, 4000);
  }

  // -- Public toggle: click / spacebar entry point. ---------------------------
  const toggleListening = useCallback(() => {
    const state = store.getState().pipelineState;
    if (state === "idle" || state === "error") {
      void startListening();
    } else if (state === "listening") {
      stopListening();
    } else if (state === "speaking") {
      void startListening(); // barge-in
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startListening]);

  // Spacebar push-to-talk.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      e.preventDefault();
      if (store.getState().pipelineState === "idle") void startListening();
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      if (store.getState().pipelineState === "listening") stopListening();
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startListening]);

  useEffect(() => {
    return () => {
      teardownMic();
      playbackRef.current?.stop();
      audioCtxRef.current?.close().catch(() => {});
    };
  }, [teardownMic]);

  return { toggleListening, playBoot };
}
