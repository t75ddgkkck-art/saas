import { NextRequest, NextResponse } from "next/server";
import { handleApiError, paymentRequired } from "@/lib/api-error";
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

export const dynamic = "force-dynamic";

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
    const body = await request.json();

    if (!body.name || !body.category) {
      return NextResponse.json({ error: "Nom et catégorie requis" }, { status: 400 });
    }

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

    const slug = slugify(body.name);
    const [business] = await db
      .insert(businesses)
      .values({
        ownerId,
        slug: `${slug}-${Math.random().toString(36).substring(2, 6)}`,
        name: body.name,
        description: body.description || null,
        category: body.category,
        address: body.address || null,
        city: body.city || null,
        postalCode: body.postalCode || null,
        phone: body.phone || null,
        siret: body.siret || null,
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
