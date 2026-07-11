/**
 * F6 (Lot 35) — GET /api/weather?lat=&lon=
 *
 * Proxy vers Open-Meteo (API météo GRATUITE, sans clé, sans compte).
 * Utilisé par le widget météo de la Today view — utile pour les métiers
 * en extérieur (plombier, jardinier, couvreur).
 *
 * Documentation : https://open-meteo.com/en/docs
 *
 * Cache 1h côté serveur (météo change lentement, réduit charge Open-Meteo).
 * Rate-limit : 60/min/IP (usage normal 1 call par ouverture Today view).
 *
 * Coordonnées :
 *  - Query params lat + lon (défaut Paris)
 *  - Si absent, on ne devine pas — le client est responsable de fournir la
 *    géoloc (via `businesses.city` géocodé ou navigator.geolocation)
 */

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const RATE = { key: "weather", limit: 60, windowSec: 60 } as const;
const CACHE_TTL_SEC = 60 * 60; // 1 heure

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
    wind_speed_10m?: number;
    precipitation?: number;
  };
  daily?: {
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    weather_code?: number[];
    precipitation_sum?: number[];
  };
}

/**
 * Traduit un code WMO Weather en emoji + label court FR.
 * Cf https://open-meteo.com/en/docs (§WMO Weather interpretation codes)
 */
function wmoToLabel(code: number): { emoji: string; label: string } {
  if (code === 0) return { emoji: "☀️", label: "Ensoleillé" };
  if (code <= 2) return { emoji: "🌤️", label: "Peu nuageux" };
  if (code === 3) return { emoji: "☁️", label: "Nuageux" };
  if (code >= 45 && code <= 48) return { emoji: "🌫️", label: "Brouillard" };
  if (code >= 51 && code <= 57) return { emoji: "🌦️", label: "Bruine" };
  if (code >= 61 && code <= 67) return { emoji: "🌧️", label: "Pluie" };
  if (code >= 71 && code <= 77) return { emoji: "🌨️", label: "Neige" };
  if (code >= 80 && code <= 82) return { emoji: "🌧️", label: "Averses" };
  if (code >= 85 && code <= 86) return { emoji: "🌨️", label: "Averses neige" };
  if (code >= 95) return { emoji: "⛈️", label: "Orage" };
  return { emoji: "🌤️", label: "Variable" };
}

export async function GET(req: NextRequest) {
  const rl = checkRateLimit(req, RATE);
  if (!rl.ok) return rl.response;

  const url = new URL(req.url);
  const lat = parseFloat(url.searchParams.get("lat") ?? "48.85"); // Paris fallback
  const lon = parseFloat(url.searchParams.get("lon") ?? "2.35");

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: "Coordonnées invalides" }, { status: 400 });
  }

  try {
    // API Open-Meteo — current + daily du jour
    const apiUrl = new URL("https://api.open-meteo.com/v1/forecast");
    apiUrl.searchParams.set("latitude", lat.toString());
    apiUrl.searchParams.set("longitude", lon.toString());
    apiUrl.searchParams.set("current", "temperature_2m,weather_code,wind_speed_10m,precipitation");
    apiUrl.searchParams.set(
      "daily",
      "temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum"
    );
    apiUrl.searchParams.set("timezone", "auto");
    apiUrl.searchParams.set("forecast_days", "1");

    // Timeout 5s (Open-Meteo est fiable mais on ne veut pas bloquer la Today view)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(apiUrl.toString(), {
      signal: controller.signal,
      // Cache Next côté serveur (partagé entre tous les users à la même position)
      next: { revalidate: CACHE_TTL_SEC },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      logger.warn("weather.open_meteo.error", { status: res.status });
      return NextResponse.json({ error: "Service météo indisponible" }, { status: 503 });
    }

    const data = (await res.json()) as OpenMeteoResponse;
    const currentCode = data.current?.weather_code ?? 0;
    const dailyCode = data.daily?.weather_code?.[0] ?? 0;

    return NextResponse.json(
      {
        current: {
          tempC: Math.round(data.current?.temperature_2m ?? 0),
          windKmh: Math.round(data.current?.wind_speed_10m ?? 0),
          precipMm: data.current?.precipitation ?? 0,
          ...wmoToLabel(currentCode),
        },
        today: {
          tempMinC: Math.round(data.daily?.temperature_2m_min?.[0] ?? 0),
          tempMaxC: Math.round(data.daily?.temperature_2m_max?.[0] ?? 0),
          precipMm: data.daily?.precipitation_sum?.[0] ?? 0,
          ...wmoToLabel(dailyCode),
        },
      },
      {
        headers: {
          // Cache CDN 1h : mêmes coords = même réponse
          "Cache-Control": `public, max-age=${CACHE_TTL_SEC}, s-maxage=${CACHE_TTL_SEC}`,
        },
      }
    );
  } catch (err) {
    // Timeout ou erreur réseau → 503, la Today view masquera juste le widget
    logger.warn("weather.fetch_failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Service météo indisponible" }, { status: 503 });
  }
}
