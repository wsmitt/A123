import { fetchWithRetry } from "./http";

const FISH_TTS_URL = "https://api.fish.audio/v1/tts";

export class FishApiError extends Error {
  status: number;
  retryAfter: number | null;
  constructor(status: number, retryAfterHeader: string | null, body: string) {
    super(`Fish Audio API error ${status}: ${body.slice(0, 300)}`);
    this.name = "FishApiError";
    this.status = status;
    this.retryAfter = retryAfterHeader ? Number(retryAfterHeader) : null;
  }
}

function requireApiKey(): string {
  const key = process.env.FISH_AUDIO_API_KEY;
  if (!key) {
    throw new Error(
      "FISH_AUDIO_API_KEY is not set. Add it to .env.local — see .env.example."
    );
  }
  return key;
}

function requireVoiceId(): string {
  const id = process.env.FISH_VOICE_ID;
  if (!id) {
    throw new Error("FISH_VOICE_ID is not set. Add it to .env.local — see .env.example.");
  }
  return id;
}

/**
 * Synthesizes speech for `text` and returns the raw fetch Response so its
 * audio/mpeg body can be streamed straight back to the client without
 * buffering the whole clip in memory.
 */
export async function synthesizeSpeech(text: string): Promise<Response> {
  const key = requireApiKey();
  const voiceId = requireVoiceId();
  const model = process.env.FISH_TTS_MODEL || "s2.1-pro-free";

  const res = await fetchWithRetry(FISH_TTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      model,
    },
    body: JSON.stringify({
      text,
      reference_id: voiceId,
      format: "mp3",
      mp3_bitrate: 128,
      sample_rate: 44100,
      latency: "normal",
      chunk_length: 200,
      normalize: true,
      prosody: { speed: 1.0, volume: 0 },
    }),
  });

  if (!res.ok) {
    throw new FishApiError(res.status, res.headers.get("retry-after"), await res.text());
  }

  return res;
}
