import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { scheduleExceptions } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { getCurrentBusiness } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  try {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ exceptions: [] });
    }

    let exceptions;

    if (startDate && endDate) {
      exceptions = await db
        .select()
        .from(scheduleExceptions)
        .where(
          and(
            eq(scheduleExceptions.businessId, business.id),
            gte(scheduleExceptions.date, startDate),
            lte(scheduleExceptions.date, endDate)
          )
        );
    } else {
      exceptions = await db
        .select()
        .from(scheduleExceptions)
        .where(eq(scheduleExceptions.businessId, business.id));
    }

    return NextResponse.json({ exceptions });
  } catch (error: any) {
    console.error("GET exceptions error:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { date, type, isClosed, customStartTime, customEndTime, reason } = body;

    if (!date || !type) {
      return NextResponse.json({ error: "Date et type requis" }, { status: 400 });
    }

    // Vérifier si une exception existe déjà pour cette date
    const existing = await db
      .select()
      .from(scheduleExceptions)
      .where(
        and(
          eq(scheduleExceptions.businessId, business.id),
          eq(scheduleExceptions.date, date)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Mettre à jour
      await db
        .update(scheduleExceptions)
        .set({
          type,
          isClosed: isClosed !== false,
          customStartTime: customStartTime || null,
          customEndTime: customEndTime || null,
          reason: reason || null,
        })
        .where(eq(scheduleExceptions.id, existing[0].id));
    } else {
      // Créer
      await db.insert(scheduleExceptions).values({
        businessId: business.id,
        date,
        type,
        isClosed: isClosed !== false,
        customStartTime: customStartTime || null,
        customEndTime: customEndTime || null,
        reason: reason || null,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("POST exception error:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const exceptionId = searchParams.get("id");

    if (!exceptionId) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }

    await db
      .delete(scheduleExceptions)
      .where(
        and(
          eq(scheduleExceptions.id, exceptionId),
          eq(scheduleExceptions.businessId, business.id)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE exception error:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}
