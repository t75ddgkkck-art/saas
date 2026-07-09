export const dynamic = "force-static";
export const revalidate = 86400; // 1 jour

interface UrlEntry {
  path: string;
  changefreq?: "daily" | "weekly" | "monthly" | "yearly";
  priority?: number;
}

// Pages fixes du site (indépendantes de la DB).
// Ne pas ajouter /login, /dashboard, /api ici (déjà bloqués par robots.txt).
const STATIC: UrlEntry[] = [
  { path: "/", changefreq: "daily", priority: 1.0 },
  { path: "/register", changefreq: "monthly", priority: 0.9 },
  { path: "/annuaire", changefreq: "daily", priority: 0.9 },
  { path: "/blog", changefreq: "weekly", priority: 0.7 },
  { path: "/a-propos", changefreq: "yearly", priority: 0.5 },
  { path: "/faq", changefreq: "monthly", priority: 0.6 },
  { path: "/cgu", changefreq: "yearly", priority: 0.3 },
  { path: "/confidentialite", changefreq: "yearly", priority: 0.3 },
];

export function GET() {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr").replace(/\/$/, "");
  const now = new Date().toISOString();

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${STATIC.map(
  (u) => `  <url>
    <loc>${appUrl}${u.path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${u.changefreq ?? "monthly"}</changefreq>
    <priority>${u.priority?.toFixed(1) ?? "0.5"}</priority>
  </url>`
).join("\n")}
</urlset>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
