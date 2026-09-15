# JARVIS — Voice AI Assistant + HUD Dashboard

A personal, voice-driven AI assistant behind a sci-fi HUD dashboard. Talk to it,
it transcribes you, answers in the JARVIS persona, speaks the reply back in a
cloned voice, and the HUD reacts to the real audio in real time.

This is a personal project. The visual style is *inspired by* fictional sci-fi
interfaces — it isn't affiliated with, endorsed by, or trying to imitate any
film studio's branding, and it isn't intended for commercial use.

## Stack

Next.js 14 (App Router) + TypeScript + Tailwind CSS, Framer Motion for panel
entrances, raw SVG/Canvas-free CSS for the radar and waveform, Zustand for
state, Groq for the LLM + speech-to-text, and Fish Audio for text-to-speech.
No database, no auth — everything lives in the browser tab.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in your keys:

   ```bash
   cp .env.example .env.local
   ```

   | Variable | Where to get it | Notes |
   | --- | --- | --- |
   | `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) → API Keys | Powers both the chat model and Whisper transcription. |
   | `FISH_AUDIO_API_KEY` | [fish.audio](https://fish.audio) → API dashboard | Powers text-to-speech. |
   | `FISH_VOICE_ID` | Fish Audio → pick or clone a voice, copy its `reference_id` | Defaults to a sample voice ID; **swap this to change JARVIS's voice.** |
   | `GROQ_CHAT_MODEL` | Optional | Leave blank to auto-discover a live chat model from your Groq account on first request. Set it to pin a specific model and skip discovery. |
   | `GROQ_STT_MODEL` | Optional | Defaults to `whisper-large-v3-turbo`. |
   | `FISH_TTS_MODEL` | Optional | Defaults to `s2.1-pro-free`; change to `s2-pro` / `s1` depending on your plan. |
   | `TAVILY_API_KEY` | [tavily.com](https://tavily.com) → API Keys | Powers the `web_search` voice tool. Without it, a search attempt fails gracefully (JARVIS reports it can't reach the search, everything else keeps working). |

   All keys are read server-side only (inside `app/api/**/route.ts`), and the
   dev server fails loudly at request time with a readable error if one is
   missing. None of them are ever sent to the browser — verified by grepping
   the production client bundle (`npm run build` + `grep` over `.next/static`)
   for the key names and upstream URLs.

3. Run it:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000), click **Enable
   Audio** once (browsers block autoplay until a user gesture), then press
   and hold **Space** (or click the mic pill) to talk. Release, or wait for
   ~1.5s of silence, and JARVIS answers.

## Changing the voice

Fish Audio identifies voices by a `reference_id`. Pick or clone a voice in
the Fish Audio dashboard, copy its ID, and set `FISH_VOICE_ID` in
`.env.local` — no code changes needed.

## Changing the HUD name / user chip

Edit the constants in `lib/config.ts` (`USER_NAME`, `ASSISTANT_NAME`, etc).

## How the voice pipeline works

`lib/useVoicePipeline.ts` runs a strict state machine:

```
IDLE → LISTENING → TRANSCRIBING → THINKING → SPEAKING → IDLE
              ↘ (error, any stage) → ERROR → IDLE
```

- **LISTENING** — `getUserMedia` + `MediaRecorder` record `audio/webm`, while
  an `AnalyserNode` on the same stream drives the HUD waveform/radar and a
  simple RMS-based voice-activity detector that auto-stops after ~1.5s of
  silence.
- **TRANSCRIBING** — the clip is POSTed to `/api/transcribe` (Groq Whisper).
- **THINKING** — the transcript is appended to the last 12 turns and POSTed
  to `/api/chat`, which streams the reply back as SSE; tokens render live in
  the terminal panel as they arrive.
- **SPEAKING** — sentences are spoken as soon as they're complete, not after
  the whole reply finishes streaming: `streamChat` detects each `. `/`! `/`? `
  boundary in the growing SSE buffer and pushes it into a per-turn speech
  queue immediately (`createSpeechQueue` in `lib/useVoicePipeline.ts`), which
  synthesizes and plays sentences back-to-back while later ones may still be
  streaming in. Each sentence is sanitized (markdown/emoji/code stripped,
  since it's read aloud) before `/api/speak` (Fish Audio); playback runs
  through a second `AnalyserNode` so the HUD pulses to JARVIS's own voice.
  Clicking the mic while JARVIS is speaking is a barge-in: playback stops
  immediately, the rest of the queued sentences are dropped, and recording
  starts.

### Tool calling (voice commands)

Every `/api/chat` request carries the tool schema in `lib/tools.ts`. The
client accumulates streamed `tool_calls` deltas, executes each one, and — for
`toggle_defense_system` — round-trips the result back to the model for an
in-persona confirmation before speaking it (no hardcoded "confirmed" text).
A tool call that doesn't happen never gets a spoken confirmation invented for
it.

- **`toggle_defense_system(system, state)`** — shield / power / signal /
  reactor. Runs through the exact same `store.setDefenseSystem` handler a
  physical tap on the DEFENSE SYSTEMS buttons uses, so voice and touch can
  never disagree. Turning the shield on switches the whole HUD from cyan to
  red (see "Alert mode" below); turning power off dims everything (see
  "Standby mode").
- **`web_search(query)`** — calls Tavily (`lib/tavily.ts`,
  `app/api/tools/search/route.ts`) server-side, since `TAVILY_API_KEY` can
  never reach the client.
- **`launch_missiles(target)`** — theatrical only: logs a dramatic sequence
  to RT-LOG and speaks a confirmation. No real system is touched; see the
  tool's description in `lib/tools.ts`.

Every tool call is logged to RT-LOG regardless of outcome (including
rejected/invalid ones), and gets a short synthesized click sound
(`lib/sfx.ts`, plain Web Audio oscillators — no audio assets to host).

## Alert mode

Engaging the shield sets `data-alert="true"` on `<main>`, which overrides
`--cyan`/`--cyan-dim`/`--cyan-rgb`/`--panel-border`/`--grid-line`/`--glow` in
`app/globals.css`. Every component reads those same custom properties (via
Tailwind's `cyan`/`cyan-dim`/`cyan-faint` utilities or inline styles), so the
whole HUD re-themes from cyan to red with no per-component changes.

## Standby mode

Turning the Power Grid defense button off sets `standby-dim` (a `filter:
brightness()/saturate()` with a smooth transition) on the main content and
the mobile mic bar — real dimming of every glow, border, and text under it,
not just an opacity toggle on one element. It's applied to those two
elements directly rather than a shared ancestor, since `filter` makes its
element the containing block for `position: fixed` descendants, which would
otherwise break the mic bar's viewport-fixed positioning on mobile.

## Boot sequence

On load, a scripted RT-LOG sequence types itself out (`app/page.tsx`) while
the nine panels fade in staggered (`Panel`'s `delay` prop) — this runs
immediately, no gesture needed. The spoken half — a synthesized rising tone
plus JARVIS's greeting — waits for the **Enable Audio** click, same as
everywhere else audio needs a user gesture to satisfy autoplay policy.

## Real vs. decorative data

Per the design brief, some HUD numbers are genuine telemetry and some are
atmosphere. Anything decorative is marked with a `// decorative` comment at
its source.

**Real:** the clock, CPU/memory (`os.loadavg`/`totalmem`/`freemem` via
`/api/metrics`, polled every 3s), session storage usage (bytes of
conversation held in the browser), network status (`navigator.onLine` +
round-trip latency to `/api/metrics`), every system log line, the terminal's
last command and reply, and every waveform/radar amplitude.

**Decorative, with slow believable drift, never a jump:** heart rate, body
temperature, neural link, armor status (power core / structural), and the
radar contacts' drift/ping timing. The defense-system toggles' on/off state
is real app state (see "Tool calling" above) even though the values they
represent (shield, reactor, etc.) are fictional.

**Every panel does something real when tapped**, not just the ones with
obviously real data: RT-MONITOR expands to show real host uptime/platform/
Node version; UP-LINK triggers an actual fresh ping against `/api/metrics`;
VITAL SIGNS expands to a real session min/max of the observed (decorative)
heart-rate stream; RT-LOG has a real Clear action; the terminal's reply can
be copied to the clipboard.

## Error handling

- Mic permission denied → a red log line, the mic pill reads `MIC BLOCKED`
  and flashes amber. No modal.
- Any upstream 4xx/5xx → one retry after an 800ms backoff, then a logged
  error and a spoken fallback line ("I'm having trouble reaching my
  systems, sir.").
- `429` → the status bar shows `DEGRADED (Ns)` counting down from the
  upstream's `retry-after`.
- No stack traces or key fragments are ever rendered into the DOM.

## Known gaps / stretch goals not implemented

- **Wake word** ("Hey JARVIS" via the Web Speech API) is the brief's
  explicitly optional stretch goal and isn't wired up.
- `npm audit` flags advisories against the `next@14` line (fixed only in
  Next 16, a major version bump beyond what this project's stack pins);
  given this is a local, single-user, no-auth app, that tradeoff was kept
  rather than jumping a major version unasked. Re-run `npm audit` before
  using this anywhere less trusted than `localhost`.
- Endpoints and model IDs for Groq and Fish Audio should be double-checked
  against their live docs (`console.groq.com/docs`, `docs.fish.audio`)
  before relying on this in production — both APIs are noted to change.
