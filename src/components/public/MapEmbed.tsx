"use client";

/**
 * Carte OpenStreetMap embed (Lot 23).
 *
 * Pourquoi pas Google Maps ?
 *  - RGPD-friendly (pas de tracking, pas de consent banner)
 *  - Gratuit, sans clé API
 *  - Suffit pour "voir où c'est"
 *
 * L'iframe précédente utilisait un `pb=` Google en dur → affichait toujours
 * la MÊME coordonnée (68°51'N ≈ Islande). Bug latent depuis toujours.
 *
 * Le bouton "Itinéraire" ouvre par contre Google Maps (routing universel
 * mobile natif Android/iOS + interop desktop). L'user peut cliquer sans
 * charger la tuile Google au chargement de la vitrine (aucun tracking passif).
 */

import { useMemo } from "react";
import { Navigation } from "lucide-react";

interface Props {
  latitude: number;
  longitude: number;
  address?: string | null;
  city?: string | null;
  /** Zoom OSM 1 (monde) - 19 (rue). Défaut 15 (quartier). */
  zoom?: number;
  height?: number;
}

export function MapEmbed({ latitude, longitude, address, city, zoom = 15, height = 260 }: Props) {
  // Bounding box ~500m autour du point (delta 0.005° ≈ 555m à l'équateur, un peu moins à Paris)
  const delta = 0.005;
  const bbox = useMemo(
    () =>
      [
        (longitude - delta).toFixed(6),
        (latitude - delta).toFixed(6),
        (longitude + delta).toFixed(6),
        (latitude + delta).toFixed(6),
      ].join(","),
    [latitude, longitude]
  );

  // URL de l'iframe OSM avec marker central. Le paramètre `layer=mapnik` = tuile classique.
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude.toFixed(6)},${longitude.toFixed(6)}`;

  // Lien "voir en plus grand" vers openstreetmap.org avec le zoom demandé
  const fullMapUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=${zoom}/${latitude}/${longitude}`;

  // Itinéraire : Google Maps directions vers l'adresse (mobile détecte et ouvre l'app native)
  // Encodage safe. On préfère l'adresse texte à latlng car plus lisible dans l'app itinéraire.
  const directionsQuery = [address, city].filter(Boolean).join(", ") || `${latitude},${longitude}`;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(directionsQuery)}`;

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
        <iframe
          src={src}
          width="100%"
          height={height}
          style={{ border: 0 }}
          loading="lazy"
          title={`Carte OpenStreetMap — ${city || "Localisation"}`}
        />
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
        >
          <Navigation className="h-4 w-4" aria-hidden="true" />
          Itinéraire
        </a>
        <a
          href={fullMapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Voir sur OSM
        </a>
      </div>
    </div>
  );
}
