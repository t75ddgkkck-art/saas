/**
 * Rich snippets JSON-LD pour la vitrine publique.
 *
 * Google prend en charge :
 *  - LocalBusiness (nom, adresse, tel, coordonnées géo)
 *  - AggregateRating + Review (étoiles dans les SERP)
 *  - OpeningHoursSpecification (horaires d'ouverture affichés directement)
 *  - Image (aperçu)
 *  - PriceRange (bandeau €/€€/€€€)
 *  - SameAs (liens réseaux sociaux vers le Knowledge Graph)
 *  - BreadcrumbList (chapelet Accueil > Ville > Business dans les SERP)
 */

// Mapping catégorie Vitrix → sous-type LocalBusiness Schema.org
// Améliore la classification dans le Knowledge Graph Google.
const CATEGORY_TO_SCHEMA: Record<string, string> = {
  plombier: "Plumber",
  electricien: "Electrician",
  couvreur: "RoofingContractor",
  peintre: "HousePainter",
  menuisier: "HomeAndConstructionBusiness",
  coiffeur: "HairSalon",
  esthetician: "BeautySalon",
  estheticien: "BeautySalon",
  garagiste: "AutoRepair",
  jardinier: "GardenStore",
  serrurier: "Locksmith",
  macon: "GeneralContractor",
  chauffagiste: "HVACBusiness",
  photographe: "ProfessionalService",
  coach: "ProfessionalService",
  restaurant: "Restaurant",
  autre: "LocalBusiness",
};

// Jours de la semaine (index 0-6 = Dimanche-Samedi) → schema.org
const SCHEMA_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

interface OpeningHour {
  dayOfWeek: number;
  startTime: string | null;
  endTime: string | null;
  isClosed: boolean;
}

interface SocialLink {
  platform: string;
  url: string;
}

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
    coverImage?: string | null;
    profileImage?: string | null;
    logo?: string | null;
    website?: string | null;
    slug: string;
  };
  reviews: { rating: number; comment: string | null; clientName: string; createdAt?: Date | string }[];
  avgRating: number;
  url: string;
  hours?: OpeningHour[];
  socials?: SocialLink[];
  priceRange?: string; // "€" | "€€" | "€€€"
}

function buildOpeningHours(hours?: OpeningHour[]) {
  if (!hours || hours.length === 0) return undefined;
  return hours
    .filter((h) => !h.isClosed && h.startTime && h.endTime)
    .map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: SCHEMA_DAYS[h.dayOfWeek],
      opens: h.startTime,
      closes: h.endTime,
    }));
}

function buildImageArray(business: StructuredDataProps["business"]): string[] | undefined {
  const imgs = [business.coverImage, business.profileImage, business.logo].filter(
    (v): v is string => Boolean(v)
  );
  return imgs.length > 0 ? imgs : undefined;
}

export function BusinessStructuredData({
  business,
  reviews,
  avgRating,
  url,
  hours,
  socials,
  priceRange,
}: StructuredDataProps) {
  const schemaType = CATEGORY_TO_SCHEMA[business.category] ?? "LocalBusiness";
  const appUrl = url.replace(/\/[^/]*$/, "") || url;

  const business_ld = {
    "@context": "https://schema.org",
    "@type": schemaType,
    "@id": `${url}#business`,
    name: business.name,
    description: business.description || undefined,
    url,
    telephone: business.phone || undefined,
    email: business.email || undefined,
    image: buildImageArray(business),
    priceRange: priceRange || "€€",
    address: business.address
      ? {
          "@type": "PostalAddress",
          streetAddress: business.address,
          addressLocality: business.city || undefined,
          postalCode: business.postalCode || undefined,
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
    openingHoursSpecification: buildOpeningHours(hours),
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
        worstRating: "1",
      },
      author: { "@type": "Person", name: r.clientName },
      reviewBody: r.comment || undefined,
      datePublished: r.createdAt
        ? (r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt)).toISOString().split("T")[0]
        : undefined,
    })),
    sameAs:
      socials && socials.length > 0
        ? socials.map((s) => s.url).filter(Boolean)
        : undefined,
  };

  // Breadcrumb : Accueil > Ville > Business (si ville renseignée)
  // Améliore l'affichage du chapelet dans les SERP Google.
  const breadcrumbs = [
    { name: "Accueil", item: appUrl || "https://www.vitrix.fr" },
    ...(business.city
      ? [
          {
            name: business.city,
            item: `${appUrl}/ville/${business.city
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/\s+/g, "-")}`,
          },
        ]
      : []),
    { name: business.name, item: url },
  ];

  const breadcrumb_ld = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbs.map((b, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: b.name,
      item: b.item,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(business_ld) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb_ld) }}
      />
    </>
  );
}
