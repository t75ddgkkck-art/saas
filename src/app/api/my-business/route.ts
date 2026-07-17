import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { getCurrentBusiness, getCurrentUser } from "@/lib/session";
import { slugify } from "@/lib/utils";
import { handleApiError, unauthorized, conflict, badRequest, paymentRequired } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";
// Lot 60 : gate Premium sur le champ googlePlaceId (défense en profondeur —
// même si un user Free bypass l'UI, l'API refuse le champ).
import { canUse } from "@/lib/entitlements";
import type { SubscriptionPlan } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// Validation "lâche" : la plupart des champs sont optionnels et peuvent être
// null/undefined. On borne surtout les longueurs pour éviter qu'un user colle
// 1 Go dans une colonne text.
const UpdateSchema = z
  .object({
    slug: z.string().trim().max(150).optional(),
    name: z.string().trim().max(200).optional(),
    description: z.string().trim().max(5000).optional().nullable(),
    category: z.string().trim().max(100).optional(),
    logo: z.string().url().max(2000).optional().nullable().or(z.literal("")),
    profileImage: z.string().url().max(2000).optional().nullable().or(z.literal("")),
    coverImage: z.string().url().max(2000).optional().nullable().or(z.literal("")),
    phone: z.string().trim().max(30).optional().nullable(),
    whatsapp: z.string().trim().max(30).optional().nullable(),
    email: z.string().trim().toLowerCase().email().max(255).optional().nullable().or(z.literal("")),
    website: z.string().trim().max(500).optional().nullable().or(z.literal("")),
    address: z.string().trim().max(500).optional().nullable(),
    city: z.string().trim().max(100).optional().nullable(),
    postalCode: z.string().trim().max(20).optional().nullable(),
    serviceArea: z.string().trim().max(1000).optional().nullable(),
    emergencyPhone: z.string().trim().max(30).optional().nullable(),
    showEmergency: z.boolean().optional().nullable(),
    primaryColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "Couleur au format #RRGGBB attendue")
      .optional()
      .nullable(),
    // Lot 37 : personnalisation étendue
    secondaryColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "Couleur au format #RRGGBB attendue")
      .optional()
      .nullable()
      .or(z.literal("")),
    accentColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "Couleur au format #RRGGBB attendue")
      .optional()
      .nullable()
      .or(z.literal("")),
    fontFamily: z.string().trim().max(50).optional().nullable(),
    sectionOrder: z.array(z.string().max(30)).max(20).optional().nullable(),
    /** Custom CSS (Premium — sanitizer côté serveur, cap 20 KB) */
    customCss: z
      .string()
      .max(20 * 1024)
      .optional()
      .nullable()
      .or(z.literal("")),
    hideBranding: z.boolean().optional().nullable(),
    language: z.enum(["fr", "en", "es", "de"]).optional().nullable(),
    template: z.string().trim().max(30).optional().nullable(),
    showQrOnPage: z.boolean().optional().nullable(),
    customDomain: z.string().trim().max(255).optional().nullable().or(z.literal("")),
    publicChatEnabled: z.boolean().optional().nullable(),
    autoReviewRequest: z.boolean().optional().nullable(),
    showReviewsOnPage: z.boolean().optional().nullable(),
    highlightsEnabled: z.boolean().optional().nullable(),
    highlightsData: z.unknown().optional().nullable(),
    iban: z.string().trim().max(50).optional().nullable(),
    bic: z.string().trim().max(20).optional().nullable(),
    menuData: z.unknown().optional().nullable(),
    enableStripe: z.boolean().optional().nullable(),
    acceptCash: z.boolean().optional().nullable(),
    acceptApplePay: z.boolean().optional().nullable(),
    // F2 (Lot 30) : politique remboursement acompte (heures avant RDV)
    depositRefundHours: z.number().int().min(0).max(720).optional().nullable(),
    loyaltyEnabled: z.boolean().optional().nullable(),
    loyaltyPointsPerEuro: z.number().int().min(0).max(1000).optional().nullable(),
    loyaltyReward: z.string().trim().max(500).optional().nullable(),
    // Lot 58 MAJ3 : Place ID Google (récupéré manuellement via
    // https://developers.google.com/maps/documentation/places/web-service/place-id).
    // Approche pragmatique v1 — pas d'OAuth Google Business (workflow trop lourd,
    // scope `business.manage` en review Google = semaines). L'user colle son ID,
    // on l'utilise pour appeler Places API et importer ses vrais avis Google.
    googlePlaceId: z
      .string()
      .trim()
      .max(200)
      .regex(/^[A-Za-z0-9_-]*$/, "Place ID invalide (caractères alphanumériques uniquement)")
      .optional()
      .nullable()
      .or(z.literal("")),
  })
  .passthrough();

export async function GET() {
  try {
    const business = await getCurrentBusiness();
    if (!business) return NextResponse.json(null);
    return NextResponse.json(business);
  } catch (err) {
    return handleApiError(err, { route: "GET /api/my-business" });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const business = await getCurrentBusiness();
    if (!business) throw unauthorized();

    const body = await validateBody(request, UpdateSchema);

    // Lot 60 — Gate Premium sur `googlePlaceId` (défense en profondeur).
    // L'UI affiche déjà un `<UpgradeGate>` sur /dashboard/reviews pour les non-Premium,
    // mais un attaquant peut hit l'API directement en curl → on ré-vérifie ici.
    // On ne fait l'appel getCurrentUser que si le champ est POST/PATCHé (perf).
    if (body.googlePlaceId !== undefined && body.googlePlaceId !== business.googlePlaceId) {
      const user = await getCurrentUser();
      const plan = (user?.subscription || "free") as SubscriptionPlan;
      if (!canUse(plan, "reviews.google_import")) {
        throw paymentRequired(
          "L'import des avis Google est réservé au plan Premium.",
          {
            feature: "reviews.google_import",
            requiredPlan: "premium",
            currentPlan: plan,
          }
        );
      }
    }

    // Slug personnalisé : anti-collision
    let newSlug = business.slug;
    if (body.slug && body.slug !== business.slug) {
      const cleanSlug = slugify(body.slug);
      if (cleanSlug.length < 3) throw badRequest("L'URL doit contenir au moins 3 caractères");
      const [existing] = await db
        .select({ id: businesses.id })
        .from(businesses)
        .where(and(eq(businesses.slug, cleanSlug), ne(businesses.id, business.id)))
        .limit(1);
      if (existing) throw conflict("Cette URL est déjà prise. Choisissez-en une autre.");
      newSlug = cleanSlug;
    }

    // NB : on ne met QUE les champs présents dans body (undefined = pas modifié).
    // On reste sur la logique historique `body.X ?? business.X` pour ne pas casser
    // le front actuel qui envoie parfois tout, parfois un delta.
    await db
      .update(businesses)
      .set({
        slug: newSlug,
        name: body.name ?? business.name,
        description: body.description ?? business.description,
        category: body.category ?? business.category,
        logo: body.logo || business.logo,
        profileImage: body.profileImage || business.profileImage,
        coverImage: body.coverImage || business.coverImage,
        phone: body.phone ?? business.phone,
        whatsapp: body.whatsapp ?? business.whatsapp,
        email: body.email || business.email,
        website: body.website || business.website,
        address: body.address ?? business.address,
        city: body.city ?? business.city,
        postalCode: body.postalCode ?? business.postalCode,
        serviceArea: body.serviceArea ?? business.serviceArea,
        emergencyPhone: body.emergencyPhone ?? business.emergencyPhone,
        showEmergency: body.showEmergency ?? business.showEmergency,
        primaryColor: body.primaryColor ?? business.primaryColor,
        // Lot 37 : personnalisation étendue.
        // Chaîne vide "" est traitée comme "reset à null" pour secondary/accent
        // (permet à l'user de retirer une couleur custom).
        // CSS custom : sanitize côté serveur ET check plan (Premium only).
        secondaryColor:
          body.secondaryColor !== undefined
            ? body.secondaryColor === ""
              ? null
              : body.secondaryColor
            : business.secondaryColor,
        accentColor:
          body.accentColor !== undefined
            ? body.accentColor === ""
              ? null
              : body.accentColor
            : business.accentColor,
        fontFamily: body.fontFamily ?? business.fontFamily,
        sectionOrder: body.sectionOrder !== undefined ? body.sectionOrder : business.sectionOrder,
        customCss:
          body.customCss !== undefined
            ? // Sanitizer + gating plan Premium fait plus bas si nécessaire
              (await import("@/lib/vitrine-personalization")).sanitizeCustomCss(
                body.customCss ?? null
              )
            : business.customCss,
        hideBranding: body.hideBranding ?? business.hideBranding,
        language: body.language ?? business.language,
        template: body.template ?? business.template,
        showQrOnPage: body.showQrOnPage ?? business.showQrOnPage,
        customDomain: body.customDomain || business.customDomain,
        publicChatEnabled: body.publicChatEnabled ?? business.publicChatEnabled,
        autoReviewRequest: body.autoReviewRequest ?? business.autoReviewRequest,
        showReviewsOnPage: body.showReviewsOnPage ?? business.showReviewsOnPage,
        highlightsEnabled: body.highlightsEnabled ?? business.highlightsEnabled,
        highlightsData: (body.highlightsData ?? business.highlightsData) as unknown,
        iban: body.iban ?? business.iban,
        bic: body.bic ?? business.bic,
        menuData: (body.menuData ?? business.menuData) as unknown,
        enableStripe: body.enableStripe ?? business.enableStripe,
        acceptCash: body.acceptCash ?? business.acceptCash,
        acceptApplePay: body.acceptApplePay ?? business.acceptApplePay,
        depositRefundHours:
          body.depositRefundHours !== undefined
            ? body.depositRefundHours
            : business.depositRefundHours,
        loyaltyEnabled: body.loyaltyEnabled ?? business.loyaltyEnabled,
        loyaltyPointsPerEuro: body.loyaltyPointsPerEuro ?? business.loyaltyPointsPerEuro,
        loyaltyReward: body.loyaltyReward ?? business.loyaltyReward,
        // Lot 58 MAJ3 : "" → null (le user vide le champ = déconnecter Google Reviews)
        googlePlaceId:
          body.googlePlaceId !== undefined
            ? body.googlePlaceId === ""
              ? null
              : body.googlePlaceId
            : business.googlePlaceId,
        updatedAt: new Date(),
      })
      .where(eq(businesses.id, business.id));

    // Invalide le cache ISR de la vitrine + de l'ancien slug si le pro l'a changé.
    // Effet : la prochaine visite verra immédiatement les nouvelles infos,
    // sans attendre la fin de la fenêtre ISR (600s).
    try {
      revalidatePath(`/${newSlug}`);
      if (newSlug !== business.slug) revalidatePath(`/${business.slug}`);
      revalidatePath("/annuaire");
    } catch {
      // Silencieux : l'invalidation peut échouer en dev, ce n'est jamais bloquant.
    }

    return NextResponse.json({ success: true, slug: newSlug });
  } catch (err) {
    return handleApiError(err, { route: "PUT /api/my-business" });
  }
}
