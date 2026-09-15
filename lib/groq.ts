import { fetchWithRetry } from "./http";

// Groq's OpenAI-compatible API. Keys are read here only — this module must
// never be imported from a client component.
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

// Preference order used when GROQ_CHAT_MODEL isn't set in env. Groq rotates
// and deprecates model IDs, so we discover what the account actually has
// rather than hardcoding one.
const CHAT_MODEL_PREFERENCE = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];

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

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function requireApiKey(): string {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    throw new Error(
      "GROQ_API_KEY is not set. Add it to .env.local — see .env.example."
    );
  }
  return key;
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
    const res = await fetch(`${GROQ_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${requireApiKey()}` },
    });
    if (!res.ok) {
      throw new GroqApiError(res.status, res.headers.get("retry-after"), await res.text());
    }
    const data: { data?: Array<{ id: string }> } = await res.json();
    const ids = (data.data ?? []).map((m) => m.id);
    const preferred = CHAT_MODEL_PREFERENCE.find((id) => ids.includes(id));
    const fallback = ids.find(
      (id) => !id.includes("whisper") && !id.includes("guard") && !id.includes("tts")
    );
    const chosen = preferred ?? fallback ?? ids[0];
    if (!chosen) {
      throw new Error("Groq returned no usable chat models for this account.");
    }
    cachedChatModel = chosen;
    // eslint-disable-next-line no-console
    console.log(`[groq] selected chat model: ${chosen}`);
    return chosen;
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
 * route handler can pipe its SSE body straight through to the client.
 */
export async function streamChatCompletion(messages: ChatMessage[]): Promise<Response> {
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
