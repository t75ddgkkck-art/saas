import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { getCurrentBusiness } from "@/lib/session";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const business = await getCurrentBusiness();
    if (!business) return NextResponse.json(null);
    return NextResponse.json(business);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Gestion du slug personnalisé (URL propre)
    let newSlug = business.slug;
    if (body.slug && body.slug !== business.slug) {
      const cleanSlug = slugify(body.slug);
      if (cleanSlug.length < 3) {
        return NextResponse.json({ error: "L'URL doit contenir au moins 3 caractères" }, { status: 400 });
      }
      // Vérifier l'unicité
      const existing = await db.select().from(businesses)
        .where(and(eq(businesses.slug, cleanSlug), ne(businesses.id, business.id)))
        .limit(1);
      if (existing.length > 0) {
        return NextResponse.json({ error: "Cette URL est déjà prise. Choisissez-en une autre." }, { status: 409 });
      }
      newSlug = cleanSlug;
    }

    await db.update(businesses).set({
      slug: newSlug,
      name: body.name ?? business.name,
      description: body.description ?? business.description,
      category: body.category ?? business.category,
      logo: body.logo ?? business.logo,
      profileImage: body.profileImage ?? business.profileImage,
      coverImage: body.coverImage ?? business.coverImage,
      phone: body.phone ?? business.phone,
      whatsapp: body.whatsapp ?? business.whatsapp,
      email: body.email ?? business.email,
      website: body.website ?? business.website,
      address: body.address ?? business.address,
      city: body.city ?? business.city,
      postalCode: body.postalCode ?? business.postalCode,
      serviceArea: body.serviceArea ?? business.serviceArea,
      emergencyPhone: body.emergencyPhone ?? business.emergencyPhone,
      showEmergency: body.showEmergency ?? business.showEmergency,
      // Personnalisation
      primaryColor: body.primaryColor ?? business.primaryColor,
      hideBranding: body.hideBranding ?? business.hideBranding,
      language: body.language ?? business.language,
      template: body.template ?? business.template,
      showQrOnPage: body.showQrOnPage ?? business.showQrOnPage,
      customDomain: body.customDomain ?? business.customDomain,
      publicChatEnabled: body.publicChatEnabled ?? business.publicChatEnabled,
      autoReviewRequest: body.autoReviewRequest ?? business.autoReviewRequest,
      showReviewsOnPage: body.showReviewsOnPage ?? business.showReviewsOnPage,
      highlightsEnabled: body.highlightsEnabled ?? business.highlightsEnabled,
      highlightsData: body.highlightsData ?? business.highlightsData,
      iban: body.iban ?? business.iban,
      bic: body.bic ?? business.bic,
      menuData: body.menuData ?? business.menuData,
      // Paiements
      enableStripe: body.enableStripe ?? business.enableStripe,
      acceptCash: body.acceptCash ?? business.acceptCash,
      acceptApplePay: body.acceptApplePay ?? business.acceptApplePay,
      // Fidélité
      loyaltyEnabled: body.loyaltyEnabled ?? business.loyaltyEnabled,
      loyaltyPointsPerEuro: body.loyaltyPointsPerEuro ?? business.loyaltyPointsPerEuro,
      loyaltyReward: body.loyaltyReward ?? business.loyaltyReward,
      updatedAt: new Date(),
    }).where(eq(businesses.id, business.id));

    return NextResponse.json({ success: true, slug: newSlug });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
