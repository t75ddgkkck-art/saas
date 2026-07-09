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
import { eq, and, asc, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PublicPage } from "./PublicPage";

import type { Metadata } from "next";

// Rendu dynamique (dépendance DB)
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const result = await db.select().from(businesses).where(eq(businesses.slug, slug)).limit(1);
  const business = result[0];

  if (!business) return { title: "Page non trouvée | Vitrix" };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const reviewResult = await db.select().from(reviews)
    .where(and(eq(reviews.businessId, business.id), eq(reviews.isPublished, true)))
    .limit(10);
  const avgRating = reviewResult.length > 0
    ? reviewResult.reduce((sum, r) => sum + r.rating, 0) / reviewResult.length
    : 0;

  return {
    title: `${business.name} - ${business.category} à ${business.city || "France"}`,
    description: business.description || `${business.name} - ${business.category} professionnel à ${business.city || "France"}. Prenez rendez-vous en ligne et demandez un devis gratuit.`,
    openGraph: {
      title: `${business.name} - ${business.category}`,
      description: business.description || `Professionnel ${business.category} à ${business.city || "France"}`,
      type: "website",
      url: `${appUrl}/${business.slug}`,
      images: business.coverImage
        ? [{ url: business.coverImage, width: 1200, height: 630, alt: business.name }]
        : [{ url: `${appUrl}/og-default.jpg`, width: 1200, height: 630, alt: "Vitrix" }],
      siteName: "Vitrix",
      locale: "fr_FR",
    },
    twitter: {
      card: "summary_large_image",
      title: `${business.name} - ${business.category}`,
      description: business.description || `Professionnel ${business.category}`,
      images: business.coverImage ? [business.coverImage] : [],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },
    alternates: {
      canonical: `${appUrl}/${business.slug}`,
    },
  };
}

export default async function PublicBusinessPage({ params }: Props) {
  const { slug } = await params;

  const businessResult = await db.select().from(businesses).where(eq(businesses.slug, slug)).limit(1);

  const business = businessResult[0];
  if (!business) notFound();

  // Récupérer le plan du propriétaire (pour masquer devis/IA sur plan gratuit)
  const { users } = await import("@/db/schema");
  const ownerResult = await db.select({ subscription: users.subscription }).from(users).where(eq(users.id, business.ownerId)).limit(1);
  const ownerPlan = ownerResult[0]?.subscription || "free";

  const [hours, reviewList, faqList, gallery, socials, availableSlots, servicesList] = await Promise.all([
    db.select().from(workingHours).where(eq(workingHours.businessId, business.id)).orderBy(asc(workingHours.dayOfWeek)),
    db.select().from(reviews).where(and(eq(reviews.businessId, business.id), eq(reviews.isPublished, true))).orderBy(desc(reviews.createdAt)).limit(10),
    db.select().from(faqs).where(and(eq(faqs.businessId, business.id), eq(faqs.isPublished, true))).orderBy(asc(faqs.sortOrder)),
    db.select().from(galleryItems).where(eq(galleryItems.businessId, business.id)).orderBy(asc(galleryItems.sortOrder)).limit(20),
    db.select().from(socialLinks).where(eq(socialLinks.businessId, business.id)),
    db.select().from(availabilitySlots).where(and(eq(availabilitySlots.businessId, business.id), eq(availabilitySlots.isBooked, false), eq(availabilitySlots.isBlocked, false))).orderBy(asc(availabilitySlots.date), asc(availabilitySlots.startTime)).limit(50),
    db.select().from(services).where(eq(services.businessId, business.id)).orderBy(asc(services.sortOrder)),
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
