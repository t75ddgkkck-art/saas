/**
 * Système d'avis Google — Lot 58 MAJ3 refonte.
 *
 * Approche v1 pragmatique : pas d'OAuth Google Business (workflow scope
 * `business.manage` = validation Google en semaines). L'user récupère
 * manuellement son Place ID sur https://developers.google.com/maps/documentation/places/web-service/place-id
 * et le colle dans ses settings → on utilise Places API pour importer les avis.
 *
 * 1. Après chaque RDV terminé → envoyer un lien pour laisser un avis (buildReviewLink)
 * 2. Récupérer automatiquement les avis Google via l'API Places (fetchGoogleReviews)
 * 3. Afficher les meilleurs avis sur la page publique (filterBestReviews)
 */
import { logger } from "@/lib/logger";

export interface GoogleReview {
  author_name: string;
  rating: number;
  text: string;
  time: number;
  profile_photo_url?: string;
}

/**
 * Construit le lien "Laisser un avis Google" pour un business donné.
 * Si placeId manquant, on tombe sur une recherche générique par nom (moins précis
 * mais fonctionnel — Google va proposer les fiches correspondantes).
 */
export function buildReviewLink(businessName: string, placeId: string | null): string {
  if (placeId && placeId.length > 0) {
    return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
  }
  // Fallback : recherche par nom (fonctionne mais ouvre une SERP, pas direct)
  return `https://www.google.com/search?q=${encodeURIComponent(businessName + " avis")}`;
}

/**
 * Version legacy conservée pour compat existant. Nouveau code : utilise buildReviewLink.
 * @deprecated Utiliser `buildReviewLink(businessName, business.googlePlaceId)`
 */
export async function requestGoogleReview(
  clientEmail: string,
  clientName: string,
  businessName: string,
  placeId: string | null = null
) {
  // Note : l'envoi email réel se fait via sendEmail() côté route.
  logger.info("google-review.requested", { clientEmail, businessName, hasPlaceId: !!placeId });

  return {
    success: true,
    reviewLink: buildReviewLink(businessName, placeId),
    message: `Un email a été envoyé à ${clientName} pour laisser un avis Google.`,
  };
}

/**
 * Récupère les avis Google via Places API.
 * Nécessite : GOOGLE_PLACES_API_KEY en env + placeId configuré côté business.
 * Retourne [] silencieux si config manquante (feature simplement inactive).
 */
export async function fetchGoogleReviews(placeId: string): Promise<GoogleReview[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey || !placeId) {
    logger.warn("google-reviews.missing_config", { hasKey: !!apiKey, hasPlaceId: !!placeId });
    return [];
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=reviews&key=${apiKey}`
    );

    const data = (await response.json()) as {
      status?: string;
      result?: { reviews?: GoogleReview[] };
    };

    if (data.status !== "OK") {
      logger.warn("google-reviews.api_error", { status: data.status });
      return [];
    }

    return data.result?.reviews || [];
  } catch (error) {
    logger.error("google-reviews.fetch_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

export function filterBestReviews(
  reviews: GoogleReview[],
  minRating = 4,
  limit = 5
): GoogleReview[] {
  return reviews
    .filter((r) => r.rating >= minRating)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit);
}
