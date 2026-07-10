import { headers } from "next/headers";
import { detectLangFromAcceptLanguage, DEFAULT_LANG, type Lang } from "@/lib/i18n";

/**
 * Détermine la langue à utiliser côté serveur (RSC / route handlers).
 *
 * Priorité :
 *   1. `preferredLang` explicite (ex: la langue configurée sur la vitrine)
 *   2. Header `Accept-Language` du navigateur
 *   3. Défaut "fr"
 *
 * À utiliser dans les Server Components et les routes d'emails.
 */
export async function getLangFromRequest(preferredLang?: string | null): Promise<Lang> {
  if (preferredLang) {
    const l = preferredLang.toLowerCase().split("-")[0];
    if (l === "fr" || l === "en" || l === "es" || l === "de") return l;
  }
  try {
    const h = await headers();
    return detectLangFromAcceptLanguage(h.get("accept-language"));
  } catch {
    return DEFAULT_LANG;
  }
}
