// Service Marque Blanche
// Permet à l'artisan de personnaliser :
// - Logo
// - Couleurs principales
// - Domaine personnalisé (ex: monsite.fr au lieu de artisanpro.fr/p/slug)

export interface WhiteLabelConfig {
  businessId: string;
  customDomain?: string; // ex: "monsite.fr"
  logoUrl?: string;
  primaryColor: string; // ex: "#e11d48"
  secondaryColor: string; // ex: "#ffffff"
  hideVitrixBranding: boolean; // true = pas de "Propulsé par Vitrix"
}

export function getBusinessDomain(business: any, config?: WhiteLabelConfig): string {
  if (config?.customDomain) {
    return `https://${config.customDomain}`;
  }
  return `${process.env.NEXT_PUBLIC_APP_URL || "https://artisanpro.fr"}/${business.slug}`;
}

export function shouldShowBranding(config?: WhiteLabelConfig): boolean {
  return !config?.hideVitrixBranding;
}

export function getBusinessColors(config?: WhiteLabelConfig) {
  return {
    primary: config?.primaryColor || "#0f172a",
    secondary: config?.secondaryColor || "#ffffff",
  };
}

// Middleware pour gérer les domaines personnalisés (à ajouter dans next.config ou middleware)
// Si un artisan a monsite.fr configuré, il pointe vers /p/slug
export function resolveCustomDomain(hostname: string): { isCustom: boolean; businessSlug?: string } {
  // En production, cette fonction ferait une requête DB pour trouver le business
  // correspondant au domaine personnalisé
  // Pour l'instant, on retourne false (pas de domaine custom)
  return { isCustom: false };
}
