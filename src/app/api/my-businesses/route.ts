import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, paymentRequired } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";
import { db } from "@/db";
import { businesses, workingHours, faqs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { slugify } from "@/lib/utils";
import { getCurrentUser, getCurrentUserBusinesses } from "@/lib/session";
// Lot 46 (F11) : quota + gate multi-vitrines.
// Le POST accepte SANS gate la 1ère vitrine (onboarding user, tous plans).
// À partir de la 2e vitrine → gate stricte "business.multi" Premium + check quota.
import { canUse, checkQuota } from "@/lib/entitlements";
import type { SubscriptionPlan } from "@/lib/permissions";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Lot 59 MIN2 : validation Zod stricte (avant : `request.json()` cru → types
 * arbitraires en DB, siret pouvait faire 10k chars → crash message SQL exposé).
 *
 * Longueurs alignées sur le schéma DB (src/db/schema.ts) :
 *  - name / category : varchar(100)
 *  - address / description : text (borné à 500/2000 côté form pour rester sain)
 *  - siret : 14 chiffres exactement (norme INSEE FR)
 *  - postalCode : 5 chiffres (norme FR)
 */
const CreateBusinessSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(100),
  category: z.string().trim().min(1, "Catégorie requise").max(100),
  description: z.string().trim().max(2000).optional().nullable().or(z.literal("")),
  address: z.string().trim().max(500).optional().nullable().or(z.literal("")),
  city: z.string().trim().max(100).optional().nullable().or(z.literal("")),
  postalCode: z
    .string()
    .trim()
    .max(10)
    .regex(/^\d{0,5}$/, "Code postal invalide (5 chiffres max)")
    .optional()
    .nullable()
    .or(z.literal("")),
  phone: z.string().trim().max(30).optional().nullable().or(z.literal("")),
  siret: z
    .string()
    .trim()
    .regex(/^(\d{14})?$/, "SIRET invalide (14 chiffres attendus)")
    .optional()
    .nullable()
    .or(z.literal("")),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ businesses: [] });

    const allBusinesses = await getCurrentUserBusinesses();

    return NextResponse.json({
      businesses: allBusinesses.map((b) => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        category: b.category,
        city: b.city,
        phone: b.phone,
        address: b.address,
        createdAt: b.createdAt,
      })),
    });
  } catch (err) {
    return handleApiError(err, { route: "/api/my-businesses" });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Lot 59 MIN2 : rate-limit + Zod strict (avant : `body = request.json()` cru
    // → types arbitraires, siret 10k chars → crash SQL avec message technique exposé).
    // 10 créations/heure est plus que suffisant (un pro crée max 1 vitrine par
    // jour typiquement, Premium = 3 vitrines au total).
    const rl = checkRateLimit(request, {
      key: "my-businesses-post",
      limit: 10,
      windowSec: 3600,
    });
    if (!rl.ok) return rl.response;

    const data = await validateBody(request, CreateBusinessSchema);

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const ownerId = user.id;

    // Lot 46 (F11) : gate + quota multi-vitrines.
    //
    // Règle : la PREMIÈRE vitrine est TOUJOURS autorisée (onboarding).
    // À partir de la 2e → nécessite le plan Premium (feature `business.multi`)
    // ET le quota `maxBusinesses` doit être respecté (Premium = 3 max).
    const existing = await getCurrentUserBusinesses();
    const plan = (user.subscription || "free") as SubscriptionPlan;

    if (existing.length >= 1) {
      // 2e vitrine ou +
      if (!canUse(plan, "business.multi")) {
        throw paymentRequired(
          "La gestion de plusieurs vitrines est réservée au plan Premium.",
          {
            feature: "business.multi",
            requiredPlan: "premium",
            currentPlan: plan,
          }
        );
      }
      const q = checkQuota(plan, "maxBusinesses", existing.length);
      if (!q.allowed) {
        return NextResponse.json(
          {
            error: `Vous avez atteint le maximum de ${q.limit} vitrines pour votre plan.`,
            limit: q.limit,
            current: existing.length,
          },
          { status: 403 }
        );
      }
    }

    // Toutes les valeurs sont maintenant typées + bornées par Zod (Lot 59 MIN2).
    // "" → null pour garder les colonnes optionnelles cohérentes.
    const slug = slugify(data.name);
    const [business] = await db
      .insert(businesses)
      .values({
        ownerId,
        slug: `${slug}-${Math.random().toString(36).substring(2, 6)}`,
        name: data.name,
        description: data.description || null,
        category: data.category,
        address: data.address || null,
        city: data.city || null,
        postalCode: data.postalCode || null,
        phone: data.phone || null,
        siret: data.siret || null,
      })
      .returning();

    // Default hours
    const defaultHours = [
      { dayOfWeek: 1, startTime: "09:00", endTime: "18:00", isClosed: false },
      { dayOfWeek: 2, startTime: "09:00", endTime: "18:00", isClosed: false },
      { dayOfWeek: 3, startTime: "09:00", endTime: "18:00", isClosed: false },
      { dayOfWeek: 4, startTime: "09:00", endTime: "18:00", isClosed: false },
      { dayOfWeek: 5, startTime: "09:00", endTime: "17:00", isClosed: false },
      { dayOfWeek: 6, startTime: "09:00", endTime: "12:00", isClosed: false },
      { dayOfWeek: 0, startTime: "00:00", endTime: "00:00", isClosed: true },
    ];
    await db
      .insert(workingHours)
      .values(defaultHours.map((h) => ({ ...h, businessId: business.id })));

    // Default FAQs
    const defaultFaqs = [
      {
        question: "Quels sont vos tarifs ?",
        answer: "Nous proposons des devis gratuits et personnalisés.",
        sortOrder: 1,
        isPublished: true,
      },
      {
        question: "Comment prendre rendez-vous ?",
        answer: "Depuis notre page en cliquant sur 'Prendre rendez-vous'.",
        sortOrder: 2,
        isPublished: true,
      },
    ];
    await db.insert(faqs).values(defaultFaqs.map((f) => ({ ...f, businessId: business.id })));

    return NextResponse.json({ success: true, business });
  } catch (err) {
    return handleApiError(err, { route: "/api/my-businesses" });
  }
}
