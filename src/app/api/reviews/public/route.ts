import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { reviews, businesses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isValidEmail } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessSlug, clientName, clientEmail, rating, comment } = body;

    if (!businessSlug) {
      return NextResponse.json({ error: "businessSlug requis" }, { status: 400 });
    }
    if (!clientName || clientName.trim().length === 0) {
      return NextResponse.json({ error: "Nom requis" }, { status: 400 });
    }
    if (!clientEmail || !isValidEmail(clientEmail)) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400 });
    }
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "La note doit être entre 1 et 5" },
        { status: 400 }
      );
    }

    const biz = await db
      .select()
      .from(businesses)
      .where(eq(businesses.slug, businessSlug))
      .limit(1);

    if (!biz.length) {
      return NextResponse.json({ error: "Professionnel introuvable" }, { status: 404 });
    }

    await db.insert(reviews).values({
      businessId: biz[0].id,
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim().toLowerCase(),
      rating: Math.round(rating),
      comment: comment?.trim() || null,
      source: "platform",
      isPublished: true,
    });

    return NextResponse.json({
      success: true,
      message: "Avis publié avec succès",
    });
  } catch (error: any) {
    console.error("POST review error:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}
