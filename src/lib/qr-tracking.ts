/**
 * Lot 47 (F12) — Helpers URL trackée pour QR codes.
 *
 * Chaque QR code généré pointe vers l'URL de la vitrine AVEC :
 *  - `?src=<source>` → géré par `detectSource()` (visitor-hash.ts) → stocké
 *    dans `page_visits.source` par le tracker analytics existant
 *  - `?utm_source=qr` (fixe) → cohérence Google Analytics / Matomo si utilisé
 *  - `?utm_medium=<utmMedium>` (défaut: qr)
 *  - `?utm_campaign=<utmCampaign>` (optionnel — ex: "printemps-2026")
 *  - `?utm_content=<utmContent>` (optionnel — ex: "flyer-a5-recto")
 *
 * Ce module N'ACCÈDE PAS à la DB — logique pure, testable unitairement.
 */

/**
 * Slugifie une source pour la rendre URL-safe et cohérente avec le pattern
 * strict de `detectSource()` (accepte [a-z0-9-]+ uniquement).
 *
 * Ex: "Carte de visite" → "carte-de-visite"
 *     "Flyer avril 2026 ! " → "flyer-avril-2026"
 */
export function slugifySource(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    // Retire les accents
    .replace(/[\u0300-\u036f]/g, "")
    // Espaces / underscores → tirets
    .replace(/[\s_]+/g, "-")
    // Retire tout ce qui n'est pas alphanum ou tiret
    .replace(/[^a-z0-9-]/g, "")
    // Collapse tirets multiples
    .replace(/-+/g, "-")
    // Trim tirets début/fin
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export interface QrCodeConfig {
  source: string;
  utmCampaign?: string | null;
  utmMedium?: string | null;
  utmContent?: string | null;
}

/**
 * Construit l'URL trackée finale pour un QR code.
 *
 * @param baseUrl URL de la vitrine (ex: "https://vitrix.fr/dupont-plomberie")
 * @param config  Config du QR code (source obligatoire + UTM optionnels)
 * @returns URL complète prête à être encodée en QR
 */
export function buildTrackedUrl(baseUrl: string, config: QrCodeConfig): string {
  // On accepte un slug simple ("dupont-plomberie") ou une URL absolue.
  // Si pas de protocol, on force https:// pour la cohérence.
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    // Fallback : construit depuis APP_URL + slug
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr").replace(
      /\/+$/,
      ""
    );
    url = new URL(`${appUrl}/${baseUrl.replace(/^\/+/, "")}`);
  }

  // src = paramètre principal utilisé par detectSource() (visitor-hash.ts)
  url.searchParams.set("src", config.source);
  // UTM standards Google Analytics — utm_source fixe "qr" pour distinguer
  url.searchParams.set("utm_source", "qr");
  url.searchParams.set("utm_medium", config.utmMedium || "qr");
  if (config.utmCampaign) url.searchParams.set("utm_campaign", config.utmCampaign);
  if (config.utmContent) url.searchParams.set("utm_content", config.utmContent);

  return url.toString();
}

/**
 * Valide qu'une source est acceptable (non vide, format strict).
 * Retourne le message d'erreur ou null si OK.
 */
export function validateSource(source: string): string | null {
  const slug = slugifySource(source);
  if (slug.length === 0) {
    return "La source doit contenir au moins un caractère alphanumérique";
  }
  if (slug.length > 50) {
    return "La source ne peut dépasser 50 caractères";
  }
  return null;
}
