interface StructuredDataProps {
  business: {
    name: string;
    description: string | null;
    category: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    postalCode: string | null;
    latitude: string | null;
    longitude: string | null;
  };
  reviews: { rating: number; comment: string | null; clientName: string }[];
  avgRating: number;
  url: string;
}

export function BusinessStructuredData({ business, reviews, avgRating, url }: StructuredDataProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: business.name,
    description: business.description || undefined,
    url,
    telephone: business.phone || undefined,
    email: business.email || undefined,
    address: business.address
      ? {
          "@type": "PostalAddress",
          streetAddress: business.address,
          addressLocality: business.city,
          postalCode: business.postalCode,
          addressCountry: "FR",
        }
      : undefined,
    geo:
      business.latitude && business.longitude
        ? {
            "@type": "GeoCoordinates",
            latitude: parseFloat(business.latitude),
            longitude: parseFloat(business.longitude),
          }
        : undefined,
    aggregateRating:
      reviews.length > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: avgRating.toFixed(1),
            reviewCount: reviews.length,
            bestRating: "5",
            worstRating: "1",
          }
        : undefined,
    review: reviews.slice(0, 5).map((r) => ({
      "@type": "Review",
      reviewRating: {
        "@type": "Rating",
        ratingValue: r.rating.toString(),
        bestRating: "5",
      },
      author: { "@type": "Person", name: r.clientName },
      reviewBody: r.comment || undefined,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
