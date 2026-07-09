/**
 * Helpers SEO — normalisation des metas pour rester dans les limites Google/Bing.
 *
 * Limites recommandées :
 *  - <title>      : 50-60 caractères (au-delà tronqué dans SERP)
 *  - description  : 120-155 caractères
 *  - og:image     : 1200×630 (ratio 1.91:1)
 */

const MAX_TITLE = 60;
const MAX_DESC = 155;

/** Tronque à `max` chars sur une frontière de mot (pas au milieu d'un mot). */
export function clampText(input: string, max: number): string {
  const s = input.replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

export function clampTitle(title: string): string {
  return clampText(title, MAX_TITLE);
}

export function clampDescription(desc: string): string {
  return clampText(desc, MAX_DESC);
}

/**
 * Labels lisibles humains pour les catégories (utilisés dans <title> et description).
 * On préfère "Coiffeur à Paris" plutôt que "coiffeur à Paris" dans les SERP.
 */
export const CATEGORY_LABELS: Record<string, string> = {
  plombier: "Plombier",
  electricien: "Électricien",
  couvreur: "Couvreur",
  peintre: "Peintre en bâtiment",
  menuisier: "Menuisier",
  coiffeur: "Coiffeur",
  esthetician: "Esthéticienne",
  estheticien: "Esthéticien(ne)",
  garagiste: "Garagiste",
  jardinier: "Jardinier paysagiste",
  serrurier: "Serrurier",
  macon: "Maçon",
  chauffagiste: "Chauffagiste",
  photographe: "Photographe",
  coach: "Coach professionnel",
  restaurant: "Restaurant",
  autre: "Professionnel",
};

/**
 * Descriptions accrocheuses par catégorie (fallback si le pro n'a rien mis).
 * Beaucoup mieux qu'une phrase générique répétée sur toutes les vitrines.
 */
export const CATEGORY_HOOKS: Record<string, string> = {
  plombier: "Dépannage 24h/24, installation sanitaire, rénovation salle de bain. Devis gratuit.",
  electricien: "Installation, mise aux normes, dépannage électrique. Certifié Qualifelec.",
  couvreur: "Réfection de toiture, zinguerie, isolation. Devis gratuit.",
  peintre: "Peinture intérieure et extérieure, papier peint, enduits décoratifs.",
  menuisier: "Fabrication sur mesure, pose de menuiseries bois, alu, PVC.",
  coiffeur: "Coupe, coloration, mise en beauté. Rendez-vous en ligne.",
  esthetician: "Soins visage, épilation, manucure. Bien-être et beauté sur mesure.",
  garagiste: "Entretien, révision, réparation toutes marques. Devis transparent.",
  jardinier: "Entretien, création de jardins, élagage. Passionnés du végétal.",
  serrurier: "Ouverture de porte 24h/24, blindage, changement de serrure.",
  macon: "Gros œuvre, agrandissement, rénovation. Artisan qualifié.",
  chauffagiste: "Installation et entretien chaudière, PAC, climatisation. RGE.",
  photographe: "Portraits, mariage, événementiel, entreprise. Retouches incluses.",
  restaurant: "Cuisine généreuse, produits frais, réservation en ligne.",
  autre: "Professionnel qualifié. Prenez rendez-vous ou demandez un devis gratuit.",
};

/**
 * Construit une meta description propre pour une vitrine.
 * - Utilise la description du pro si elle a un minimum de sens
 * - Sinon compose "Nom — catégorie à ville. Accroche métier."
 * - Clampe à 155 chars
 */
export function buildBusinessDescription(input: {
  name: string;
  description: string | null | undefined;
  category: string;
  city: string | null | undefined;
  avgRating?: number;
  reviewsCount?: number;
}): string {
  const catLabel = CATEGORY_LABELS[input.category] || input.category;
  const hook = CATEGORY_HOOKS[input.category] || CATEGORY_HOOKS.autre;
  const location = input.city ? ` à ${input.city}` : " en France";

  // Description du pro si elle a du contenu utile (min 40 chars, pas juste le nom)
  const proDesc = (input.description || "").trim();
  const usePro =
    proDesc.length >= 40 && !proDesc.toLowerCase().includes(input.name.toLowerCase().slice(0, 8));

  const rating =
    input.avgRating && input.reviewsCount && input.reviewsCount > 0
      ? ` ⭐ ${input.avgRating.toFixed(1)}/5 (${input.reviewsCount} avis).`
      : "";

  const base = usePro
    ? `${input.name} — ${catLabel}${location}. ${proDesc}${rating}`
    : `${input.name} — ${catLabel}${location}. ${hook}${rating}`;

  return clampDescription(base);
}

/**
 * Construit un <title> propre pour une vitrine.
 * Format optimal SERP : "Nom — Catégorie à Ville | Vitrix"
 */
export function buildBusinessTitle(input: {
  name: string;
  category: string;
  city: string | null | undefined;
}): string {
  const catLabel = CATEGORY_LABELS[input.category] || input.category;
  const location = input.city ? ` à ${input.city}` : "";
  return clampTitle(`${input.name} — ${catLabel}${location}`);
}
