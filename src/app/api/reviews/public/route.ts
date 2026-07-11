import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { reviews, businesses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";
import { handleApiError, notFound } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";
// F6 (Lot 34, B25) : notif au pro à la réception d'un avis
import { notifyAsync } from "@/lib/notify";

export const dynamic = "force-dynamic";

// 3 avis / heure / IP = anti-spam raisonnable pour du vrai contenu.
const RATE = { key: "reviews:public", limit: 3, windowSec: 3600 } as const;

const Schema = z.object({
  businessSlug: z.string().trim().min(1).max(150),
  clientName: z.string().trim().min(1).max(120),
  clientEmail: z.string().trim().toLowerCase().email("Email invalide"),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(3000).optional(),
});

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, RATE);
  if (!rl.ok) return rl.response;

  try {
    const data = await validateBody(request, Schema);

    const [business] = await db
      .select({ id: businesses.id, ownerId: businesses.ownerId, name: businesses.name })
      .from(businesses)
      .where(eq(businesses.slug, data.businessSlug))
      .limit(1);
    if (!business) throw notFound("Professionnel introuvable");

    const [inserted] = await db
      .insert(reviews)
      .values({
        businessId: business.id,
        clientName: data.clientName,
        clientEmail: data.clientEmail,
        rating: data.rating,
        comment: data.comment?.trim() || null,
        source: "platform",
        isPublished: true,
      })
      .returning({ id: reviews.id });

    // F6 (Lot 34, B25) : notif au pro qu'il a reçu un avis (⭐ = émoji étoile)
    // Priority high sur les avis 1-2 étoiles (urgence répondre)
    const stars = "⭐".repeat(data.rating);
    notifyAsync({
      userId: business.ownerId,
      businessId: business.id,
      type: "review.received",
      title: `Nouvel avis ${stars}`,
      message: `${data.clientName} a laissé un avis ${data.rating}/5${data.comment ? ` : « ${data.comment.slice(0, 100)}${data.comment.length > 100 ? "…" : ""} »` : "."}`,
      data: { reviewId: inserted.id, rating: data.rating },
      priority: data.rating <= 2 ? "high" : "normal",
      url: "/dashboard/reviews",
      tag: `review-${inserted.id}`,
    });

    return NextResponse.json({ success: true, message: "Avis publié avec succès" });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/reviews/public" });
  }
}
