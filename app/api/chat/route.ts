import { NextRequest } from "next/server";
import { apiErrorResponse } from "@/lib/http";
import { streamChatCompletion, type ChatMessage } from "@/lib/groq";
import { JARVIS_SYSTEM_PROMPT } from "@/lib/persona";

export const runtime = "nodejs";

interface ChatRequestBody {
  messages?: ChatMessage[];
}

export async function POST(req: NextRequest) {
  const body: ChatRequestBody = await req.json().catch(() => ({}));
  const turns = Array.isArray(body.messages) ? body.messages : [];

  // Only the last 12 turns are kept for context; the system prompt is never
  // truncated and is always applied server-side so it can't be overridden
  // by the client.
  const messages: ChatMessage[] = [
    { role: "system", content: JARVIS_SYSTEM_PROMPT },
    ...turns.slice(-12),
  ];

  try {
    const upstream = await streamChatCompletion(messages);
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
