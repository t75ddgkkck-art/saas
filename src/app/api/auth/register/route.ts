import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, businesses, workingHours, faqs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth";
import { verifySiret } from "@/lib/siret";
import { slugify } from "@/lib/utils";
import { createSessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

const TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      firstName,
      lastName,
      email,
      password,
      phone,
      businessName,
      siret,
      category,
      address,
      city,
      postalCode,
    } = body;

    // Validation
    const requiredFields = ["firstName", "lastName", "email", "password", "businessName", "siret", "category", "city"];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json({ error: `Le champ "${field}" est requis` }, { status: 400 });
      }
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Le mot de passe doit contenir au moins 8 caractères" }, { status: 400 });
    }

    // Verify SIRET
    const siretVerification = await verifySiret(siret);
    if (!siretVerification.valid) {
      return NextResponse.json(
        { error: `SIRET invalide : ${siretVerification.error || "Ce numéro n'est pas reconnu."}` },
        { status: 400 }
      );
    }

    // Check if SIRET already used
    const existingBusiness = await db.select().from(businesses).where(eq(businesses.siret, siret)).limit(1);
    if (existingBusiness.length > 0) {
      return NextResponse.json({ error: "Ce SIRET est déjà associé à un compte." }, { status: 409 });
    }

    // Check if email exists
    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existingUser.length > 0) {
      return NextResponse.json({ error: "Un compte avec cet email existe déjà." }, { status: 409 });
    }

    // Create user
    const passwordHash = await hashPassword(password);
    const [user] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        firstName,
        lastName,
        phone: phone || null,
        role: "professional",
        subscription: "free",
        emailVerified: true,
      })
      .returning();

    // Create business
    const slug = slugify(businessName);
    const [business] = await db
      .insert(businesses)
      .values({
        ownerId: user.id,
        slug: `${slug}-${Math.random().toString(36).substring(2, 6)}`,
        name: businessName,
        description: body.description || null,
        category,
        address: address || null,
        city,
        postalCode: postalCode || null,
        country: "France",
        phone: phone || null,
        email,
        siret,
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
    await db.insert(workingHours).values(defaultHours.map((h) => ({ ...h, businessId: business.id })));

    // Default FAQs
    const defaultFaqs = [
      { question: "Quels sont vos tarifs ?", answer: "Nous proposons des devis gratuits et personnalisés. Contactez-nous pour obtenir un devis adapté à vos besoins.", sortOrder: 1, isPublished: true },
      { question: "Quelle est votre zone d'intervention ?", answer: `Nous intervenons sur ${city} et ses environs.`, sortOrder: 2, isPublished: true },
      { question: "Comment prendre rendez-vous ?", answer: "Vous pouvez prendre rendez-vous directement depuis notre page en cliquant sur 'Prendre rendez-vous'.", sortOrder: 3, isPublished: true },
    ];
    await db.insert(faqs).values(defaultFaqs.map((f) => ({ ...f, businessId: business.id })));

    // Generate token
    const token = createSessionToken(user.id);
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY * 1000);

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        subscription: user.subscription,
      },
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
      },
    });

    // Set cookies
    const secure = (request.headers.get("x-forwarded-proto")?.split(",")[0].trim() === "https") || new URL(request.url).protocol === "https:";

    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      expires: expiresAt,
      path: "/",
    });

    response.cookies.set("auth_user", JSON.stringify({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      subscription: user.subscription,
    }), {
      httpOnly: false,
      secure,
      sameSite: "lax",
      expires: expiresAt,
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Register error:", error);
    return NextResponse.json({ error: error.message || "Erreur lors de l'inscription" }, { status: 500 });
  }
}
