export const dynamic = "force-static";
export const revalidate = 86400; // 1 jour

/**
 * robots.txt — indique aux crawlers ce qui est indexable.
 *
 * Choix pris :
 *  - /register est AUTORISÉ : c'est une landing conversion, il faut l'indexer
 *  - /login est bloqué (peu d'intérêt SEO, distrait des vraies pages)
 *  - /dashboard/, /api/ bloqués (données privées / non pertinentes)
 *  - Sitemap-index pointé (pas un sitemap monolithique)
 *  - AI crawlers autorisés (GPTBot, Google-Extended) par défaut. Mettre
 *    Disallow: / dans les blocs dédiés si vous préférez opt-out.
 */
export function GET() {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr").replace(/\/$/, "");

  const body = `# Vitrix — Visibilité & clients pour artisans
# Contact : support@vitrix.fr

User-agent: *
Allow: /

# Zones privées ou non pertinentes pour l'indexation
Disallow: /dashboard/
Disallow: /api/
Disallow: /login
Disallow: /*?preview=1
Disallow: /*?checkout=*

# Autoriser explicitement les endpoints utiles pour Googlebot
Allow: /api/health

# Crawl-delay raisonnable (uniquement respecté par Bing/Yandex)
Crawl-delay: 1

# Sitemap index (pas de sitemap monolithique)
Sitemap: ${appUrl}/sitemap.xml
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
