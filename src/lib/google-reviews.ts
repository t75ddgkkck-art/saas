// Système d'avis Google
// 1. Après chaque RDV terminé → envoyer un lien pour laisser un avis
// 2. Récupérer automatiquement les avis Google via l'API Places (si configurée)
// 3. Afficher les meilleurs avis sur la page publique
import { logger } from "@/lib/logger";

interface GoogleReview {
  author_name: string;
  rating: number;
  text: string;
  time: number;
  profile_photo_url?: string;
}

export async function requestGoogleReview(
  clientEmail: string,
  clientName: string,
  businessName: string
) {
  // Note : l'envoi email réel se fait via sendEmail() côté route.
  // Cette fonction ne fait que construire le lien de review.
  logger.info("google-review.requested", { clientEmail, businessName });

  const reviewLink = `https://search.google.com/local/writereview?placeid=YOUR_PLACE_ID`;

  return {
    success: true,
    reviewLink,
    message: `Un email a été envoyé à ${clientName} pour laisser un avis Google.`,
  };
}

export async function fetchGoogleReviews(placeId: string): Promise<GoogleReview[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey || !placeId) {
    logger.warn("google-reviews.missing_config", { hasKey: !!apiKey, hasPlaceId: !!placeId });
    return [];
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews&key=${apiKey}`
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

export function filterBestReviews(reviews: GoogleReview[], minRating = 4, limit = 5): GoogleReview[] {
  return reviews
    .filter((r) => r.rating >= minRating)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit);
}
