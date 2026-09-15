import { assertAsciiHeaderValue, fetchWithRetry } from "./http";

// Groq's OpenAI-compatible API. Keys are read here only — this module must
// never be imported from a client component.
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

// Works out of the box with no GROQ_CHAT_MODEL env var set — discovery below
// still runs (Groq rotates and deprecates model IDs), but this is always the
// safety net, never "whatever came first in the account's model list".
// llama-3.3-70b-versatile and llama-3.1-8b-instant are Enterprise-only /
// gone as of 2026-09 — verified against a live account's /models list.
// These three are what's left that actually supports tool calling (i.e.
// "tools" in supported_features), which toggle_defense_system needs;
// everything else on a free account (allam-2-7b, groq/compound{,-mini})
// only has json_mode and would silently break voice commands.
const DEFAULT_CHAT_MODEL = "openai/gpt-oss-120b";
const CHAT_MODEL_PREFERENCE = [DEFAULT_CHAT_MODEL, "openai/gpt-oss-20b", "qwen/qwen3.8-27b"];

// Groq's /models endpoint lists every model the account can use, including
// STT (whisper), TTS (orpheus, and anything with "tts"/"audio" in the id),
// moderation (guard), and vision models — none of those work as a chat
// completion model, so discovery must filter them out before picking one.
const NON_CHAT_MODEL_HINTS = ["whisper", "tts", "orpheus", "audio", "guard", "vision"];

function isChatModel(id: string): boolean {
  const lower = id.toLowerCase();
  return !NON_CHAT_MODEL_HINTS.some((hint) => lower.includes(hint));
}

export class GroqApiError extends Error {
  status: number;
  retryAfter: number | null;
  constructor(status: number, retryAfterHeader: string | null, body: string) {
    super(`Groq API error ${status}: ${body.slice(0, 300)}`);
    this.name = "GroqApiError";
    this.status = status;
    this.retryAfter = retryAfterHeader ? Number(retryAfterHeader) : null;
  }
}

export interface ToolCallPayload {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

// "tool" role and tool_calls/tool_call_id support the toggle_defense_system
// round trip: an assistant message can carry tool_calls with null content,
// and each "tool" message reports one call's result back to the model.
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCallPayload[];
  tool_call_id?: string;
}

function requireApiKey(): string {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    throw new Error(
      "GROQ_API_KEY is not set. Add it to .env.local — see .env.example."
    );
  }
  return assertAsciiHeaderValue("GROQ_API_KEY", key);
}

let cachedChatModel: string | null = null;
let discoveryInFlight: Promise<string> | null = null;

export function invalidateChatModelCache(): void {
  cachedChatModel = null;
}

async function discoverChatModel(): Promise<string> {
  const configured = process.env.GROQ_CHAT_MODEL;
  if (configured) return configured;
  if (cachedChatModel) return cachedChatModel;
  if (discoveryInFlight) return discoveryInFlight;

  discoveryInFlight = (async () => {
    // Discovery is a nice-to-have, not a requirement — any failure here
    // (network error, empty/unusable model list, non-2xx response) falls
    // back to DEFAULT_CHAT_MODEL rather than blocking chat entirely.
    try {
      const res = await fetch(`${GROQ_BASE_URL}/models`, {
        headers: { Authorization: `Bearer ${requireApiKey()}` },
      });
      if (!res.ok) {
        throw new GroqApiError(res.status, res.headers.get("retry-after"), await res.text());
      }
      const data: { data?: Array<{ id: string }> } = await res.json();
      const ids = (data.data ?? []).map((m) => m.id).filter(isChatModel);
      const preferred = CHAT_MODEL_PREFERENCE.find((id) => ids.includes(id));
      const chosen = preferred ?? DEFAULT_CHAT_MODEL;
      cachedChatModel = chosen;
      // eslint-disable-next-line no-console
      console.log(`[groq] selected chat model: ${chosen}`);
      return chosen;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        `[groq] model discovery failed, falling back to ${DEFAULT_CHAT_MODEL}:`,
        err
      );
      cachedChatModel = DEFAULT_CHAT_MODEL;
      return DEFAULT_CHAT_MODEL;
    }
  })();

  try {
    return await discoveryInFlight;
  } finally {
    discoveryInFlight = null;
  }
}

async function isModelUnavailableError(res: Response): Promise<boolean> {
  if (res.status !== 400 && res.status !== 404) return false;
  const body = await res.clone().json().catch(() => null);
  const code = body?.error?.code;
  return code === "model_not_found" || code === "model_decommissioned";
}

/**
 * Streams a chat completion from Groq. Returns the raw fetch Response so the
 * route handler can pipe its SSE body straight through to the client. If
 * `tools` is given, Groq's streamed deltas will include `tool_calls`
 * fragments the client accumulates itself — see useVoicePipeline.ts.
 */
export async function streamChatCompletion(
  messages: ChatMessage[],
  tools?: unknown
): Promise<Response> {
  const key = requireApiKey();
  let model = await discoverChatModel();

  const request = (m: string) =>
    fetchWithRetry(
      `${GROQ_BASE_URL}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: m,
          messages,
          stream: true,
          temperature: 0.7,
          max_tokens: 800,
          ...(tools ? { tools, tool_choice: "auto" } : {}),
        }),
      },
      0 // never retry after a stream may have partially started
    );

  let res = await request(model);

  if (!res.ok && (await isModelUnavailableError(res))) {
    invalidateChatModelCache();
    model = await discoverChatModel();
    res = await request(model);
  }

  if (!res.ok) {
    throw new GroqApiError(res.status, res.headers.get("retry-after"), await res.text());
  }

  return res;
}

export async function transcribeAudio(file: Blob, filename: string): Promise<string> {
  const key = requireApiKey();
  const model = process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo";

  const form = new FormData();
  form.append("file", file, filename);
  form.append("model", model);
  form.append("response_format", "json");

  const res = await fetchWithRetry(`${GROQ_BASE_URL}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });

  if (!res.ok) {
    throw new GroqApiError(res.status, res.headers.get("retry-after"), await res.text());
  }

  const data: { text?: string } = await res.json();
  return data.text ?? "";
}
