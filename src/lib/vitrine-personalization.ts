/**
 * Lot 37 — Personnalisation vitrine v2.
 *
 * Trois briques :
 *  1. Palette de FONTS curated (10 fonts stables, choix user, self-hosted déjà)
 *  2. Presets COULEURS par métier (plombier bleu, coiffeur rose, avocat bordeaux…)
 *  3. Ordre des SECTIONS vitrine (drag & drop UI, persisté en jsonb)
 *
 * Objectif : concurrence Simplébo/Solocal qui ont des configs plus riches.
 * Modèle : garder des choix limités et de qualité (opinionated) plutôt
 * qu'une infinité qui produit du mauvais goût.
 */

// -----------------------------------------------------------------------------
// Fonts curated
// -----------------------------------------------------------------------------

export interface FontOption {
  id: string;
  label: string;
  /** Stack CSS complète — fallback système inclus */
  stack: string;
  /** Catégorie pour grouper dans l'UI */
  category: "sans-serif" | "serif" | "display" | "monospace";
  /** Description courte pour aide UX */
  description: string;
}

/**
 * 10 fonts curated. Toutes disponibles gratuitement, majoritairement Google Fonts.
 * L'app ne self-host que Inter (via next/font) — les autres sont référencées
 * via leur stack CSS + fallback système généreux (100% des devices ont un
 * fallback lisible). Aucun runtime fetch Google Fonts.
 *
 * Si un jour on veut vraiment loader les fonts custom, ajouter dans layout.tsx
 * via `next/font/google` avec preload conditionnel.
 */
export const FONT_OPTIONS: FontOption[] = [
  {
    id: "inter",
    label: "Inter (défaut)",
    stack: 'var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    category: "sans-serif",
    description: "Moderne, lisible partout. Le choix sûr.",
  },
  {
    id: "system-sans",
    label: "Système",
    stack:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    category: "sans-serif",
    description: "La police native de chaque device. 0 KB à charger.",
  },
  {
    id: "georgia",
    label: "Georgia",
    stack: 'Georgia, "Times New Roman", Times, serif',
    category: "serif",
    description: "Classique, sérieux. Idéal avocat/notaire/comptable.",
  },
  {
    id: "playfair",
    label: "Playfair",
    stack: '"Playfair Display", Georgia, serif',
    category: "display",
    description: "Élégant. Hotels, restaurants gastronomiques, luxe.",
  },
  {
    id: "poppins",
    label: "Poppins",
    stack: '"Poppins", -apple-system, sans-serif',
    category: "sans-serif",
    description: "Rond, amical. Coiffeurs, esthéticiennes, coachs.",
  },
  {
    id: "montserrat",
    label: "Montserrat",
    stack: '"Montserrat", -apple-system, sans-serif',
    category: "sans-serif",
    description: "Géométrique, dynamique. Sport, mode, jeune.",
  },
  {
    id: "raleway",
    label: "Raleway",
    stack: '"Raleway", -apple-system, sans-serif',
    category: "sans-serif",
    description: "Fine, épurée. Design, architecture, photo.",
  },
  {
    id: "merriweather",
    label: "Merriweather",
    stack: '"Merriweather", Georgia, serif',
    category: "serif",
    description: "Lisibilité écran. Blog long, articles techniques.",
  },
  {
    id: "lora",
    label: "Lora",
    stack: '"Lora", Georgia, serif',
    category: "serif",
    description: "Chaleureux. Traiteurs, artisans du bien-être.",
  },
  {
    id: "roboto-mono",
    label: "Roboto Mono",
    stack: '"Roboto Mono", "SF Mono", Menlo, monospace',
    category: "monospace",
    description: "Technique. Dev freelance, IT consulting.",
  },
];

export function getFontById(id: string | null | undefined): FontOption {
  return FONT_OPTIONS.find((f) => f.id === id) ?? FONT_OPTIONS[0];
}

// -----------------------------------------------------------------------------
// Presets couleurs par métier
// -----------------------------------------------------------------------------

export interface ColorPreset {
  id: string;
  label: string;
  category: string;
  primary: string;
  secondary: string;
  accent: string;
  /** Emoji visuel pour la sélection */
  emoji: string;
}

export const COLOR_PRESETS: ColorPreset[] = [
  // Confiance / technique
  {
    id: "plumber-blue",
    label: "Plombier / Chauffagiste",
    category: "batiment",
    emoji: "🔧",
    primary: "#1e40af",
    secondary: "#0f172a",
    accent: "#3b82f6",
  },
  {
    id: "electrician-yellow",
    label: "Électricien",
    category: "batiment",
    emoji: "⚡",
    primary: "#eab308",
    secondary: "#0f172a",
    accent: "#f59e0b",
  },
  {
    id: "mason-brown",
    label: "Maçon / Terrassier",
    category: "batiment",
    emoji: "🧱",
    primary: "#78716c",
    secondary: "#292524",
    accent: "#a8a29e",
  },
  {
    id: "painter-emerald",
    label: "Peintre / Décorateur",
    category: "batiment",
    emoji: "🎨",
    primary: "#059669",
    secondary: "#064e3b",
    accent: "#34d399",
  },
  // Bien-être / beauté
  {
    id: "hairdresser-pink",
    label: "Coiffeur / Barbier",
    category: "beaute",
    emoji: "💇",
    primary: "#db2777",
    secondary: "#831843",
    accent: "#f472b6",
  },
  {
    id: "esthetician-rose",
    label: "Esthéticienne / Spa",
    category: "beaute",
    emoji: "💆",
    primary: "#e11d48",
    secondary: "#881337",
    accent: "#fda4af",
  },
  {
    id: "massage-teal",
    label: "Masseur / Bien-être",
    category: "beaute",
    emoji: "🧘",
    primary: "#0d9488",
    secondary: "#134e4a",
    accent: "#5eead4",
  },
  // Restauration
  {
    id: "restaurant-red",
    label: "Restaurant / Traiteur",
    category: "restauration",
    emoji: "🍽️",
    primary: "#dc2626",
    secondary: "#7f1d1d",
    accent: "#f97316",
  },
  {
    id: "bakery-amber",
    label: "Boulangerie / Pâtisserie",
    category: "restauration",
    emoji: "🥖",
    primary: "#d97706",
    secondary: "#78350f",
    accent: "#fcd34d",
  },
  // Services intellectuels
  {
    id: "lawyer-burgundy",
    label: "Avocat / Notaire",
    category: "juridique",
    emoji: "⚖️",
    primary: "#7f1d1d",
    secondary: "#450a0a",
    accent: "#b91c1c",
  },
  {
    id: "accountant-navy",
    label: "Comptable / Conseil",
    category: "juridique",
    emoji: "📊",
    primary: "#1e3a8a",
    secondary: "#172554",
    accent: "#60a5fa",
  },
  // Sport / coaching
  {
    id: "coach-orange",
    label: "Coach sportif",
    category: "sport",
    emoji: "🏋️",
    primary: "#ea580c",
    secondary: "#7c2d12",
    accent: "#fdba74",
  },
  {
    id: "yoga-purple",
    label: "Yoga / Méditation",
    category: "sport",
    emoji: "🧘‍♀️",
    primary: "#7c3aed",
    secondary: "#4c1d95",
    accent: "#c4b5fd",
  },
  // Photo / créatif
  {
    id: "photographer-mono",
    label: "Photographe",
    category: "creatif",
    emoji: "📸",
    primary: "#0f172a",
    secondary: "#020617",
    accent: "#f8fafc",
  },
  {
    id: "designer-violet",
    label: "Designer / Créatif",
    category: "creatif",
    emoji: "🎨",
    primary: "#8b5cf6",
    secondary: "#4c1d95",
    accent: "#f472b6",
  },
  // Universel
  {
    id: "custom",
    label: "Personnalisé",
    category: "autre",
    emoji: "🎨",
    primary: "#0f172a",
    secondary: "#334155",
    accent: "#3b82f6",
  },
];

/**
 * Retourne le preset recommandé pour une catégorie de business.
 * Utilisé au register pour pré-remplir automatiquement le thème.
 * Mapping loose : cherche par mot-clé dans le label du preset.
 */
export function suggestPresetForCategory(businessCategory: string | null | undefined): ColorPreset {
  if (!businessCategory) return COLOR_PRESETS[0];
  const cat = businessCategory.toLowerCase();
  const map: Record<string, string> = {
    plombier: "plumber-blue",
    plomberie: "plumber-blue",
    chauffagiste: "plumber-blue",
    électricien: "electrician-yellow",
    electricien: "electrician-yellow",
    maçon: "mason-brown",
    macon: "mason-brown",
    peintre: "painter-emerald",
    coiffeur: "hairdresser-pink",
    coiffure: "hairdresser-pink",
    barbier: "hairdresser-pink",
    esthétique: "esthetician-rose",
    esthetique: "esthetician-rose",
    "institut de beauté": "esthetician-rose",
    massage: "massage-teal",
    kiné: "massage-teal",
    kine: "massage-teal",
    restaurant: "restaurant-red",
    traiteur: "restaurant-red",
    boulangerie: "bakery-amber",
    pâtisserie: "bakery-amber",
    patisserie: "bakery-amber",
    avocat: "lawyer-burgundy",
    notaire: "lawyer-burgundy",
    comptable: "accountant-navy",
    coach: "coach-orange",
    yoga: "yoga-purple",
    photographe: "photographer-mono",
    designer: "designer-violet",
  };
  for (const [keyword, presetId] of Object.entries(map)) {
    if (cat.includes(keyword)) {
      return COLOR_PRESETS.find((p) => p.id === presetId) ?? COLOR_PRESETS[0];
    }
  }
  return COLOR_PRESETS[COLOR_PRESETS.length - 1]; // "Personnalisé" par défaut
}

// -----------------------------------------------------------------------------
// Sections vitrine — ordre configurable
// -----------------------------------------------------------------------------

export type VitrineSectionId =
  "hero" | "services" | "gallery" | "menu" | "reviews" | "faq" | "contact" | "map";

export interface VitrineSection {
  id: VitrineSectionId;
  label: string;
  description: string;
  /** True si section obligatoire (ne peut pas être masquée). */
  required?: boolean;
}

export const VITRINE_SECTIONS: VitrineSection[] = [
  {
    id: "hero",
    label: "En-tête",
    description: "Nom, description, photo de couverture",
    required: true,
  },
  { id: "services", label: "Services & tarifs", description: "Vos prestations" },
  { id: "gallery", label: "Galerie", description: "Photos et vidéos de vos réalisations" },
  { id: "menu", label: "Menu", description: "Uniquement pour les restaurants" },
  { id: "reviews", label: "Avis clients", description: "Témoignages et notes" },
  { id: "faq", label: "FAQ", description: "Questions fréquentes" },
  { id: "map", label: "Zone d'intervention", description: "Carte + adresse" },
  { id: "contact", label: "Contact", description: "Téléphone, email, formulaire", required: true },
];

export const DEFAULT_SECTION_ORDER: VitrineSectionId[] = [
  "hero",
  "services",
  "gallery",
  "reviews",
  "faq",
  "map",
  "contact",
];

/**
 * Normalise un ordre custom : ajoute les sections manquantes à la fin,
 * retire les IDs inconnus (protection contre les DB manuellement corrompues).
 */
export function normalizeSectionOrder(custom: string[] | null | undefined): VitrineSectionId[] {
  const validIds = new Set(VITRINE_SECTIONS.map((s) => s.id));
  const known = (custom ?? []).filter((id): id is VitrineSectionId =>
    validIds.has(id as VitrineSectionId)
  );
  const missing = DEFAULT_SECTION_ORDER.filter((id) => !known.includes(id));
  return [...known, ...missing];
}

// -----------------------------------------------------------------------------
// Custom CSS sanitizer (Premium)
// -----------------------------------------------------------------------------

/**
 * Sanitize le CSS custom pour éviter les vecteurs d'attaque :
 *  - Bloque `@import` (chargement CSS externe = risque privacy/CSP)
 *  - Bloque `url(...)` externes (idem)
 *  - Bloque `expression(...)` (IE legacy XSS)
 *  - Bloque `javascript:` (data URI + JS)
 *  - Bloque `<script>` (paranoïa)
 *  - Cap 20 KB
 *
 * Retourne le CSS nettoyé ou une string vide si dépassement de taille.
 * Le CSS n'est PAS parsé (on ne peut pas garantir la validité), juste filtré
 * sur les patterns dangereux.
 */
const MAX_CSS_BYTES = 20 * 1024;

export function sanitizeCustomCss(css: string | null | undefined): string {
  if (!css) return "";
  if (css.length > MAX_CSS_BYTES) return "";
  return css
    .replace(/@import[^;]+;/gi, "")
    .replace(/url\s*\(\s*['"]?\s*(?:https?:|data:|javascript:)[^)]*\)/gi, "")
    .replace(/expression\s*\(/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/<\s*script/gi, "")
    .replace(/<\s*\/\s*script/gi, "");
}
