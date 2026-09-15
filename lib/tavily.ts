import { fetchWithRetry } from "./http";

// Tavily's REST contract puts the key in the JSON body, not a header — see
// docs.tavily.com. Keys are read here only, server-side.
const TAVILY_SEARCH_URL = "https://api.tavily.com/search";

export class TavilyApiError extends Error {
  status: number;
  retryAfter: number | null;
  constructor(status: number, retryAfterHeader: string | null, body: string) {
    super(`Tavily API error ${status}: ${body.slice(0, 300)}`);
    this.name = "TavilyApiError";
    this.status = status;
    this.retryAfter = retryAfterHeader ? Number(retryAfterHeader) : null;
  }
}

function requireApiKey(): string {
  const key = process.env.TAVILY_API_KEY;
  if (!key) {
    throw new Error("TAVILY_API_KEY is not set. Add it to .env.local — see .env.example.");
  }
  return key;
}

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
}

export interface TavilySearchResponse {
  answer: string | null;
  results: TavilySearchResult[];
}

/** Searches the live web via Tavily so JARVIS can answer anything current. */
export async function searchWeb(query: string): Promise<TavilySearchResponse> {
  const apiKey = requireApiKey();

  const res = await fetchWithRetry(TAVILY_SEARCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      include_answer: true,
      max_results: 5,
    }),
  });

  if (!res.ok) {
    throw new TavilyApiError(res.status, res.headers.get("retry-after"), await res.text());
  }

  const data: {
    answer?: string;
    results?: Array<{ title?: string; url?: string; content?: string }>;
  } = await res.json();

  const results: TavilySearchResult[] = (data.results ?? []).slice(0, 5).map((r) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    content: (r.content ?? "").slice(0, 500),
  }));

  return { answer: typeof data.answer === "string" ? data.answer : null, results };
}
