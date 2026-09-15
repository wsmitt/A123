import { NextRequest } from "next/server";
import { apiErrorResponse } from "@/lib/http";
import { streamChatCompletion, type ChatMessage } from "@/lib/groq";
import { JARVIS_SYSTEM_PROMPT } from "@/lib/persona";
import { CHAT_TOOLS } from "@/lib/tools";

export const runtime = "nodejs";

interface ChatRequestBody {
  messages?: ChatMessage[];
}

export async function POST(req: NextRequest) {
  const body: ChatRequestBody = await req.json().catch(() => ({}));
  const turns = Array.isArray(body.messages) ? body.messages : [];

  // The system prompt is never truncated and is always applied server-side
  // so it can't be overridden by the client. Unlike before tool calling, we
  // don't blindly cap history to the last 12 messages here: the client
  // already keeps persisted conversation turns to 12 (see store.ts), and a
  // single request can also carry a short, freshly-built assistant
  // tool_calls message plus its "tool" result message(s) for the
  // toggle_defense_system round trip — slicing those off by position could
  // orphan a "tool" message from the assistant call it answers, which the
  // API rejects outright.
  const messages: ChatMessage[] = [{ role: "system", content: JARVIS_SYSTEM_PROMPT }, ...turns];

  try {
    const upstream = await streamChatCompletion(messages, CHAT_TOOLS);
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
