interface UpstreamApiError {
  status: number;
  retryAfter: number | null;
  message: string;
}

function isUpstreamApiError(err: unknown): err is UpstreamApiError {
  return (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    typeof (err as { status: unknown }).status === "number"
  );
}

// Shared shape for turning a GroqApiError / FishApiError (or anything else)
// into the JSON error response our route handlers send to the client.
export function apiErrorResponse(err: unknown): Response {
  if (isUpstreamApiError(err)) {
    const headers: HeadersInit = {};
    if (err.retryAfter) headers["retry-after"] = String(err.retryAfter);
    return Response.json({ error: err.message }, { status: err.status, headers });
  }
  // eslint-disable-next-line no-console
  console.error(err);
  const message = err instanceof Error ? err.message : "Internal error";
  return Response.json({ error: message }, { status: 500 });
}

// Guards a value we're about to put into an outbound HTTP header (an API
// key, a model id from env). fetch's Headers only accepts ByteString
// (Latin1, 0-255), so a stray non-ASCII character — e.g. an env var pasted
// from a dashboard's masked "●●●●1234" display instead of the real key —
// throws a cryptic native TypeError ("Cannot convert argument to a
// ByteString...") deep inside fetch. Failing loudly here instead, with the
// variable name and a plausible cause, is far easier to diagnose.
export function assertAsciiHeaderValue(name: string, value: string): string {
  if (!/^[\x20-\x7e]*$/.test(value)) {
    const badChar = [...value].find((c) => !/[\x20-\x7e]/.test(c));
    const codePoint = badChar ? badChar.codePointAt(0) : undefined;
    throw new Error(
      `${name} contains a non-ASCII character${
        codePoint ? ` (U+${codePoint.toString(16).toUpperCase().padStart(4, "0")})` : ""
      } and can't be sent as an HTTP header. Check you copied the real value — ` +
        `a masked/redacted display (e.g. "●●●●1234") is a common cause.`
    );
  }
  return value;
}

// Small retry helper for outbound calls to Groq / Fish Audio.
// Retries once on network failure or a non-2xx response, per the spec's
// "one automatic retry with 800ms backoff" rule.
export async function fetchWithRetry(
  input: string,
  init: RequestInit,
  retries = 1,
  backoffMs = 800
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(input, init);
      if (res.ok || attempt === retries) return res;
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    } catch (err) {
      lastError = err;
      if (attempt === retries) throw err;
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
  throw lastError;
}
