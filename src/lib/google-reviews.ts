// Système d'avis Google
// 1. Après chaque RDV terminé → envoyer un lien pour laisser un avis
// 2. Récupérer automatiquement les avis Google via l'API Places (si configurée)
// 3. Afficher les meilleurs avis sur la page publique

interface GoogleReview {
  author_name: string;
  rating: number;
  text: string;
  time: number;
  profile_photo_url?: string;
}

export async function requestGoogleReview(clientEmail: string, clientName: string, businessName: string) {
  // En production, on enverrait un email avec un lien vers Google Maps
  // Pour l'instant, simulation
  console.log(`[Google Review] Demande d'avis envoyée à ${clientEmail} pour ${businessName}`);

  // Exemple de lien généré (à personnaliser avec l'ID Google du business)
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
    console.log("[Google Reviews] Clé API ou Place ID manquant");
    return [];
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews&key=${apiKey}`
    );

    const data = await response.json();

    if (data.status !== "OK") {
      console.error("[Google Reviews] Erreur API:", data.status);
      return [];
    }

    return data.result.reviews || [];
  } catch (error) {
    console.error("[Google Reviews] Erreur:", error);
    return [];
  }
}

export function filterBestReviews(reviews: GoogleReview[], minRating = 4, limit = 5): GoogleReview[] {
  return reviews
    .filter((r) => r.rating >= minRating)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit);
}
