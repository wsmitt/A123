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
