/**
 * F6 (Lot 35) — <WeatherWidget> — carte compacte météo du jour.
 *
 * Utilise `navigator.geolocation` pour obtenir la position (avec fallback
 * Paris si refusé). Fetch /api/weather (proxy Open-Meteo, cache 1h).
 *
 * Utile pour métiers extérieurs : plombier, jardinier, couvreur, agriculteur.
 * Se masque silencieusement si l'API est down (503).
 */

"use client";

import { useEffect, useState } from "react";
import { Wind, Droplets } from "lucide-react";

interface WeatherData {
  current: { tempC: number; windKmh: number; precipMm: number; emoji: string; label: string };
  today: { tempMinC: number; tempMaxC: number; precipMm: number; emoji: string; label: string };
}

interface WeatherWidgetProps {
  /** Coordonnées explicites (sinon on demande la géoloc). */
  lat?: number;
  lon?: number;
  /** Nom du lieu à afficher (ex : ville du business). */
  locationLabel?: string;
}

export function WeatherWidget({ lat, lon, locationLabel }: WeatherWidgetProps) {
  const [data, setData] = useState<WeatherData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let coords =
      lat !== undefined && lat !== null && lon !== undefined && lon !== null
        ? { lat, lon }
        : null;
    async function load(latVal: number, lonVal: number) {
      try {
        const res = await fetch(`/api/weather?lat=${latVal}&lon=${lonVal}`);
        if (!res.ok) {
          setFailed(true);
          return;
        }
        setData(await res.json());
      } catch {
        setFailed(true);
      }
    }
    if (coords) {
      void load(coords.lat, coords.lon);
      return;
    }
    // Fallback : demande géoloc navigator (avec timeout 3s)
    if (typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          void load(coords.lat, coords.lon);
        },
        () => {
          // Refus ou timeout → Paris par défaut
          void load(48.85, 2.35);
        },
        { timeout: 3000, maximumAge: 60 * 60 * 1000 }
      );
    } else {
      void load(48.85, 2.35);
    }
  }, [lat, lon]);

  // Si l'API échoue, on masque silencieusement (widget non essentiel)
  if (failed) return null;
  if (!data) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3 animate-pulse h-20" />
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="text-3xl" aria-hidden>
            {data.current.emoji}
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">
              {data.current.tempC}°C
            </p>
            <p className="text-xs text-slate-500">{data.current.label}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">
            {locationLabel && `${locationLabel} · `}Aujourd&apos;hui
          </p>
          <p className="text-xs text-slate-700 dark:text-slate-300">
            {data.today.tempMinC}° — {data.today.tempMaxC}°
          </p>
          <div className="mt-1 flex items-center justify-end gap-2 text-[10px] text-slate-500">
            <span className="inline-flex items-center gap-0.5">
              <Wind className="h-3 w-3" aria-hidden /> {data.current.windKmh} km/h
            </span>
            {data.today.precipMm > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <Droplets className="h-3 w-3" aria-hidden /> {data.today.precipMm} mm
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
