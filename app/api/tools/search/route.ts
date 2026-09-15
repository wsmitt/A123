import { NextRequest } from "next/server";
import { apiErrorResponse } from "@/lib/http";
import { searchWeb } from "@/lib/tavily";

export const runtime = "nodejs";

interface SearchRequestBody {
  query?: string;
}

export async function POST(req: NextRequest) {
  const body: SearchRequestBody = await req.json().catch(() => ({}));
  const query = body.query?.trim();

  if (!query) {
    return Response.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    const result = await searchWeb(query);
    return Response.json(result);
  } catch (err) {
    return apiErrorResponse(err);
  }
}
