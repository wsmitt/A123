import { NextRequest } from "next/server";
import { apiErrorResponse } from "@/lib/http";
import { getWeather } from "@/lib/weather";

export const runtime = "nodejs";

interface WeatherRequestBody {
  location?: string;
}

export async function POST(req: NextRequest) {
  const body: WeatherRequestBody = await req.json().catch(() => ({}));
  const location = body.location?.trim();

  if (!location) {
    return Response.json({ error: "Missing location" }, { status: 400 });
  }

  try {
    const result = await getWeather(location);
    return Response.json(result);
  } catch (err) {
    return apiErrorResponse(err);
  }
}
