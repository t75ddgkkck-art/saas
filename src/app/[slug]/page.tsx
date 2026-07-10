import { db } from "@/db";
import {
  businesses,
  workingHours,
  reviews,
  faqs,
  galleryItems,
  socialLinks,
  availabilitySlots,
  services,
} from "@/db/schema";
import { eq, and, asc, desc, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PublicPage } from "./PublicPage";

import type { Metadata } from "next";
import { buildBusinessTitle, buildBusinessDescription } from "@/lib/seo";

/**
 * Rendu ISR : la page est générée puis mise en cache 5 minutes.
 * → Grosse économie DB (hits multiples = 1 seul rendu / 5 min / slug)
 * → LCP quasi-CDN pour les visiteurs
 * Les slots de RDV / prix / avis étant relativement stables, 300s = bon compromis.
 * Une invalidation ciblée peut être ajoutée via revalidatePath() côté /api/my-business PUT.
 */
export const revalidate = 300;

// Pré-génère les vitrines les plus consultées au build.
// Fallback "blocking" = les autres seront générées à la 1ʳᵉ visite puis mises en cache.
export const dynamicParams = true;

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  try {
    // On pré-génère les 50 vitrines les plus récemment mises à jour.
    // Les autres seront rendues à la volée puis mises en cache (ISR fallback).
    const rows = await db
      .select({ slug: businesses.slug })
      .from(businesses)
      // Lot 14.3 : ne pas prégénérer les vitrines soft-deleted
      .where(isNull(businesses.deletedAt))
      .orderBy(desc(businesses.updatedAt))
      .limit(50);
    return rows.map((r) => ({ slug: r.slug }));
  } catch {
    // Build sans DB (preview Vercel avant migration) : liste vide, tout en fallback.
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  // Lot 14.3 : `and(eq(slug), isNull(deletedAt))` → vitrine supprimée = 404
  const result = await db
    .select()
    .from(businesses)
    .where(and(eq(businesses.slug, slug), isNull(businesses.deletedAt)))
    .limit(1);
  const business = result[0];

  if (!business) {
    return { title: "Page non trouvée", robots: { index: false, follow: false } };
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr").replace(/\/$/, "");
  const canonical = `${appUrl}/${business.slug}`;

  // Note moyenne (utilisée dans la description pour améliorer le CTR)
  const reviewResult = await db
    .select({ rating: reviews.rating })
    .from(reviews)
    .where(and(eq(reviews.businessId, business.id), eq(reviews.isPublished, true)))
    .limit(200);
  const avgRating =
    reviewResult.length > 0
      ? reviewResult.reduce((s, r) => s + r.rating, 0) / reviewResult.length
      : undefined;

  const title = buildBusinessTitle({
    name: business.name,
    category: business.category,
    city: business.city,
  });

  const description = buildBusinessDescription({
    name: business.name,
    description: business.description,
    category: business.category,
    city: business.city,
    avgRating,
    reviewsCount: reviewResult.length,
  });

  // Bien : og:image utilise notre route dynamique `opengraph-image.tsx`
  // qui génère un PNG personnalisé (nom + note + ville) pour Facebook/LinkedIn.
  const ogImageUrl = `${canonical}/opengraph-image`;

  // hreflang : la vitrine peut être en fr/en/es/de selon `business.language`.
  // On déclare fr par défaut + x-default = URL canonique.
  // Note : on n'a pas de vraies traductions par URL séparée pour l'instant,
  // donc hreflang pointe partout vers la même URL — c'est correct pour Google.
  const languages: Record<string, string> = { "x-default": canonical, fr: canonical };
  if (business.language && ["en", "es", "de"].includes(business.language)) {
    languages[business.language] = canonical;
  }

  return {
    title,
    description,
    keywords: [
      business.category,
      business.city || "France",
      `${business.category} ${business.city || ""}`.trim(),
      "artisan",
      "prendre rendez-vous",
      "devis gratuit",
    ],
    alternates: {
      canonical,
      languages,
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: canonical,
      siteName: "Vitrix",
      locale:
        business.language === "en"
          ? "en_US"
          : business.language === "es"
            ? "es_ES"
            : business.language === "de"
              ? "de_DE"
              : "fr_FR",
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: business.name }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

export default async function PublicBusinessPage({ params }: Props) {
  const { slug } = await params;

  // Lot 14.3 : vitrine soft-deleted → 404 public
  const businessResult = await db
    .select()
    .from(businesses)
    .where(and(eq(businesses.slug, slug), isNull(businesses.deletedAt)))
    .limit(1);

  const business = businessResult[0];
  if (!business) notFound();

  // Récupérer le plan du propriétaire (pour masquer devis/IA sur plan gratuit)
  const { users } = await import("@/db/schema");
  const ownerResult = await db
    .select({ subscription: users.subscription })
    .from(users)
    .where(eq(users.id, business.ownerId))
    .limit(1);
  const ownerPlan = ownerResult[0]?.subscription || "free";

  const [hours, reviewList, faqList, gallery, socials, availableSlots, servicesList] =
    await Promise.all([
      db
        .select()
        .from(workingHours)
        .where(eq(workingHours.businessId, business.id))
        .orderBy(asc(workingHours.dayOfWeek)),
      db
        .select()
        .from(reviews)
        .where(and(eq(reviews.businessId, business.id), eq(reviews.isPublished, true)))
        .orderBy(desc(reviews.createdAt))
        .limit(10),
      db
        .select()
        .from(faqs)
        .where(and(eq(faqs.businessId, business.id), eq(faqs.isPublished, true)))
        .orderBy(asc(faqs.sortOrder)),
      db
        .select()
        .from(galleryItems)
        .where(eq(galleryItems.businessId, business.id))
        .orderBy(asc(galleryItems.sortOrder))
        .limit(20),
      db.select().from(socialLinks).where(eq(socialLinks.businessId, business.id)),
      db
        .select()
        .from(availabilitySlots)
        .where(
          and(
            eq(availabilitySlots.businessId, business.id),
            eq(availabilitySlots.isBooked, false),
            eq(availabilitySlots.isBlocked, false)
          )
        )
        .orderBy(asc(availabilitySlots.date), asc(availabilitySlots.startTime))
        .limit(50),
      db
        .select()
        .from(services)
        .where(eq(services.businessId, business.id))
        .orderBy(asc(services.sortOrder)),
    ]);

  return (
    <PublicPage
      business={business}
      hours={hours}
      reviews={reviewList}
      faqs={faqList}
      gallery={gallery}
      socials={socials}
      slots={availableSlots}
      ownerPlan={ownerPlan}
      initialServices={servicesList}
    />
  );
}
