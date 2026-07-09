import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const manifest = {
    name: "Vitrix - Visibilité & clients pour artisans",
    short_name: "Vitrix",
    description: "Gérez votre activité d'artisan depuis une seule page",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f172a",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
    categories: ["business", "productivity"],
    shortcuts: [
      {
        name: "Tableau de bord",
        short_name: "Dashboard",
        url: "/dashboard",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Rendez-vous",
        short_name: "RDV",
        url: "/dashboard/appointments",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Devis",
        short_name: "Devis",
        url: "/dashboard/quotes",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };

  return new NextResponse(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
