import { NextRequest } from "next/server";
import { apiErrorResponse } from "@/lib/http";
import { transcribeAudio } from "@/lib/groq";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");

  if (!file || !(file instanceof Blob)) {
    return Response.json({ error: "Missing audio file" }, { status: 400 });
  }

  try {
    const text = await transcribeAudio(file, "clip.webm");
    return Response.json({ text });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
