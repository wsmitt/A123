import { NextRequest } from "next/server";
import { apiErrorResponse } from "@/lib/http";
import { synthesizeSpeech } from "@/lib/fish";

export const runtime = "nodejs";

interface SpeakRequestBody {
  text?: string;
}

export async function POST(req: NextRequest) {
  const body: SpeakRequestBody = await req.json().catch(() => ({}));
  const text = body.text?.trim();

  if (!text) {
    return Response.json({ error: "Missing text" }, { status: 400 });
  }

  try {
    const upstream = await synthesizeSpeech(text);
    return new Response(upstream.body, {
      status: 200,
      headers: { "Content-Type": "audio/mpeg" },
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
