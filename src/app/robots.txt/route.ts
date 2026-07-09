export const dynamic = "force-dynamic";

export function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr";
  const robots = `# Vitrix - Visibilité & clients pour artisans
User-agent: *
Allow: /

# Zones privées
Disallow: /dashboard/
Disallow: /api/
Disallow: /login
Disallow: /register

# Sitemap
Sitemap: ${appUrl}/sitemap.xml`;

  return new Response(robots, {
    headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=3600" },
  });
}
