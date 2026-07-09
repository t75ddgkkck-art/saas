import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users, businesses, workingHours, faqs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth";
import { verifySiret } from "@/lib/siret";
import { slugify } from "@/lib/utils";
import { createSessionToken } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { badRequest, conflict, handleApiError } from "@/lib/api-error";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const TOKEN_EXPIRY_SEC = 7 * 24 * 60 * 60;

const RegisterSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(255),
  password: z
    .string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères")
    .max(200),
  phone: z.string().trim().max(20).optional().nullable(),
  businessName: z.string().trim().min(1).max(200),
  siret: z.string().trim().regex(/^\d{14}$/, "SIRET doit contenir 14 chiffres"),
  category: z.string().trim().min(1).max(100),
  address: z.string().trim().max(500).optional().nullable(),
  city: z.string().trim().min(1).max(100),
  postalCode: z.string().trim().max(20).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
});

const DEFAULT_HOURS = [
  { dayOfWeek: 1, startTime: "09:00", endTime: "18:00", isClosed: false },
  { dayOfWeek: 2, startTime: "09:00", endTime: "18:00", isClosed: false },
  { dayOfWeek: 3, startTime: "09:00", endTime: "18:00", isClosed: false },
  { dayOfWeek: 4, startTime: "09:00", endTime: "18:00", isClosed: false },
  { dayOfWeek: 5, startTime: "09:00", endTime: "17:00", isClosed: false },
  { dayOfWeek: 6, startTime: "09:00", endTime: "12:00", isClosed: false },
  { dayOfWeek: 0, startTime: "00:00", endTime: "00:00", isClosed: true },
] as const;

export async function POST(request: NextRequest) {
  // 3 inscriptions/heure/IP : anti-spam raisonnable
  const rl = checkRateLimit(request, { key: "auth:register", limit: 3, windowSec: 3600 });
  if (!rl.ok) return rl.response;

  try {
    const json = await request.json().catch(() => null);
    const parsed = RegisterSchema.safeParse(json);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      throw badRequest(
        `${first?.path.join(".") ?? "champ"}: ${first?.message ?? "invalide"}`
      );
    }
    const data = parsed.data;

    // Vérif SIRET (INSEE ou Luhn fallback)
    const siretVerification = await verifySiret(data.siret);
    if (!siretVerification.valid) {
      throw badRequest(
        `SIRET invalide : ${siretVerification.error || "Ce numéro n'est pas reconnu."}`
      );
    }

    // Unicité SIRET + email (avant transaction : évite la charge inutile)
    const [dupSiret] = await db
      .select({ id: businesses.id })
      .from(businesses)
      .where(eq(businesses.siret, data.siret))
      .limit(1);
    if (dupSiret) throw conflict("Ce SIRET est déjà associé à un compte.");

    const [dupUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, data.email))
      .limit(1);
    if (dupUser) throw conflict("Un compte avec cet email existe déjà.");

    const passwordHash = await hashPassword(data.password);

    // Transaction : tout ou rien pour éviter un utilisateur orphelin
    const created = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email: data.email,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone || null,
          role: "professional",
          subscription: "free",
          emailVerified: false, // ⚠️  ne pas marquer vérifié sans double opt-in
        })
        .returning();

      const baseSlug = slugify(data.businessName);
      const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;

      const [business] = await tx
        .insert(businesses)
        .values({
          ownerId: user.id,
          slug,
          name: data.businessName,
          description: data.description || null,
          category: data.category,
          address: data.address || null,
          city: data.city,
          postalCode: data.postalCode || null,
          country: "France",
          phone: data.phone || null,
          email: data.email,
          siret: data.siret,
        })
        .returning();

      await tx.insert(workingHours).values(
        DEFAULT_HOURS.map((h) => ({ ...h, businessId: business.id }))
      );

      await tx.insert(faqs).values([
        {
          businessId: business.id,
          question: "Quels sont vos tarifs ?",
          answer:
            "Nous proposons des devis gratuits et personnalisés. Contactez-nous pour obtenir un devis adapté à vos besoins.",
          sortOrder: 1,
          isPublished: true,
        },
        {
          businessId: business.id,
          question: "Quelle est votre zone d'intervention ?",
          answer: `Nous intervenons sur ${data.city} et ses environs.`,
          sortOrder: 2,
          isPublished: true,
        },
        {
          businessId: business.id,
          question: "Comment prendre rendez-vous ?",
          answer:
            "Vous pouvez prendre rendez-vous directement depuis notre page en cliquant sur 'Prendre rendez-vous'.",
          sortOrder: 3,
          isPublished: true,
        },
      ]);

      return { user, business };
    });

    const token = createSessionToken(created.user.id);
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_SEC * 1000);
    const secure =
      request.headers.get("x-forwarded-proto")?.split(",")[0].trim() === "https" ||
      new URL(request.url).protocol === "https:";

    const response = NextResponse.json({
      success: true,
      user: {
        id: created.user.id,
        email: created.user.email,
        firstName: created.user.firstName,
        lastName: created.user.lastName,
        role: created.user.role,
        subscription: created.user.subscription,
      },
      business: {
        id: created.business.id,
        name: created.business.name,
        slug: created.business.slug,
      },
    });

    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      expires: expiresAt,
      path: "/",
    });

    logger.info("user.registered", {
      userId: created.user.id,
      businessId: created.business.id,
    });

    return response;
  } catch (err) {
    return handleApiError(err, { route: "/api/auth/register" });
  }
}
