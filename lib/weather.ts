import { fetchWithRetry } from "./http";

// Open-Meteo: free, no API key required for either the geocoder or the
// forecast endpoint — one less credential for a user to go set up.
const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

export class WeatherApiError extends Error {
  status: number;
  retryAfter: number | null = null;
  constructor(status: number, message: string) {
    super(message);
    this.name = "WeatherApiError";
    this.status = status;
  }
}

// WMO weather interpretation codes (open-meteo.com/en/docs), condensed to
// what a spoken forecast actually needs.
const WEATHER_CODES: Record<number, string> = {
  0: "clear sky",
  1: "mainly clear",
  2: "partly cloudy",
  3: "overcast",
  45: "fog",
  48: "depositing rime fog",
  51: "light drizzle",
  53: "moderate drizzle",
  55: "dense drizzle",
  61: "slight rain",
  63: "moderate rain",
  65: "heavy rain",
  71: "slight snow",
  73: "moderate snow",
  75: "heavy snow",
  80: "slight rain showers",
  81: "moderate rain showers",
  82: "violent rain showers",
  95: "thunderstorm",
  96: "thunderstorm with slight hail",
  99: "thunderstorm with heavy hail",
};

export interface WeatherReport {
  location: string;
  temperatureC: number;
  windSpeedKmh: number;
  condition: string;
}

/** Geocodes a free-text place name, then fetches its current conditions. */
export async function getWeather(location: string): Promise<WeatherReport> {
  const geoRes = await fetchWithRetry(
    `${GEOCODING_URL}?name=${encodeURIComponent(location)}&count=1&language=en&format=json`,
    { method: "GET" }
  );
  if (!geoRes.ok) {
    throw new WeatherApiError(geoRes.status, "Location lookup failed");
  }
  const geoData: {
    results?: Array<{ latitude: number; longitude: number; name: string; country?: string; admin1?: string }>;
  } = await geoRes.json();
  const place = geoData.results?.[0];
  if (!place) {
    throw new WeatherApiError(404, `Couldn't find a location matching "${location}"`);
  }

  const forecastRes = await fetchWithRetry(
    `${FORECAST_URL}?latitude=${place.latitude}&longitude=${place.longitude}` +
      `&current=temperature_2m,weather_code,wind_speed_10m&temperature_unit=celsius&wind_speed_unit=kmh`,
    { method: "GET" }
  );
  if (!forecastRes.ok) {
    throw new WeatherApiError(forecastRes.status, "Forecast lookup failed");
  }
  const forecastData: {
    current?: { temperature_2m: number; weather_code: number; wind_speed_10m: number };
  } = await forecastRes.json();
  const current = forecastData.current;
  if (!current) {
    throw new WeatherApiError(502, "No current weather data returned");
  }

  return {
    location: [place.name, place.admin1, place.country].filter(Boolean).join(", "),
    temperatureC: Math.round(current.temperature_2m),
    windSpeedKmh: Math.round(current.wind_speed_10m),
    condition: WEATHER_CODES[current.weather_code] ?? "unrecognized conditions",
  };
}
