import { NextResponse } from "next/server";

// Cache 1h côté CDN — le manifest change rarement mais on veut pouvoir
// pousser une update rapidement en cas de rebrand.
export const revalidate = 3600;

export function GET() {
  const manifest = {
    name: "Vitrix — Visibilité & clients pour artisans",
    short_name: "Vitrix",
    description:
      "Gérez votre activité d'artisan depuis une seule page : vitrine SEO, réservation, devis, avis, paiements.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f172a",
    // F6 (Lot 34) : `any` au lieu de `portrait-primary` — la vue calendrier
    // semaine est bien plus lisible en landscape sur tablette et grand smartphone.
    orientation: "any",
    lang: "fr",
    categories: ["business", "productivity"],

    // Bonne pratique : séparer "any" (icône affichée telle quelle)
    // et "maskable" (icône qui remplit la safe zone Android).
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],

    shortcuts: [
      {
        name: "Tableau de bord",
        short_name: "Dashboard",
        url: "/dashboard",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Rendez-vous",
        short_name: "RDV",
        url: "/dashboard/appointments",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Devis",
        short_name: "Devis",
        url: "/dashboard/quotes",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
