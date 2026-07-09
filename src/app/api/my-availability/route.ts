import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { workingHours, availabilitySlots } from "@/db/schema";
import { eq, and, gte } from "drizzle-orm";
import { getCurrentBusiness } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET: Récupérer les horaires et créneaux
export async function GET(request: NextRequest) {
  try {
    const business = await getCurrentBusiness();
    if (!business) return NextResponse.json({ hours: [], slots: [] });

    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get("fromDate");

    const [hours, slots] = await Promise.all([
      db.select().from(workingHours).where(eq(workingHours.businessId, business.id)).orderBy(workingHours.dayOfWeek),
      fromDate 
        ? db.select().from(availabilitySlots).where(and(eq(availabilitySlots.businessId, business.id), gte(availabilitySlots.date, fromDate), eq(availabilitySlots.isBlocked, false))).orderBy(availabilitySlots.date, availabilitySlots.startTime)
        : db.select().from(availabilitySlots).where(and(eq(availabilitySlots.businessId, business.id), eq(availabilitySlots.isBlocked, false))).orderBy(availabilitySlots.date, availabilitySlots.startTime),
    ]);

    return NextResponse.json({ hours, slots });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: Sauvegarder les horaires de travail
export async function PUT(request: NextRequest) {
  try {
    const business = await getCurrentBusiness();
    if (!business) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const body = await request.json();
    const { hours } = body as { hours: Array<{ dayOfWeek: number; startTime: string; endTime: string; isClosed: boolean }> };

    // Supprimer les anciens horaires
    await db.delete(workingHours).where(eq(workingHours.businessId, business.id));

    // Insérer les nouveaux
    if (hours && hours.length > 0) {
      await db.insert(workingHours).values(
        hours.map(h => ({
          businessId: business.id,
          dayOfWeek: h.dayOfWeek,
          startTime: h.isClosed ? null : h.startTime,
          endTime: h.isClosed ? null : h.endTime,
          isClosed: h.isClosed,
        }))
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Générer des créneaux automatiquement à partir des horaires
export async function POST(request: NextRequest) {
  try {
    const business = await getCurrentBusiness();
    if (!business) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const body = await request.json();
    const { daysAhead = 30, slotDuration = 60 } = body; // jours à l'avance, durée en minutes

    // Récupérer les horaires
    const hours = await db.select().from(workingHours).where(eq(workingHours.businessId, business.id));
    if (hours.length === 0) {
      return NextResponse.json({ error: "Configurez d'abord vos horaires d'ouverture" }, { status: 400 });
    }

    // Supprimer les futurs créneaux non réservés
    const today = new Date().toISOString().split("T")[0];
    await db.delete(availabilitySlots).where(and(eq(availabilitySlots.businessId, business.id), gte(availabilitySlots.date, today), eq(availabilitySlots.isBooked, false)));

    // Générer les créneaux pour les prochains jours
    const slotsToInsert: any[] = [];
    const hoursMap = new Map(hours.map(h => [h.dayOfWeek, h]));

    for (let i = 0; i < daysAhead; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];
      const dayOfWeek = date.getDay(); // 0=Dimanche

      const dayHours = hoursMap.get(dayOfWeek);
      if (!dayHours || dayHours.isClosed) continue;

      // Générer les créneaux
      const [startH, startM] = dayHours.startTime!.split(":").map(Number);
      const [endH, endM] = dayHours.endTime!.split(":").map(Number);
      let currentTime = startH * 60 + startM;
      const endTime = endH * 60 + endM;

      while (currentTime + slotDuration <= endTime) {
        const h = Math.floor(currentTime / 60);
        const m = currentTime % 60;
        const startTime = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
        const endSlotTime = `${Math.floor((currentTime + slotDuration) / 60).toString().padStart(2, "0")}:${((currentTime + slotDuration) % 60).toString().padStart(2, "0")}`;
        
        slotsToInsert.push({
          businessId: business.id,
          date: dateStr,
          startTime,
          endTime: endSlotTime,
          isBooked: false,
          isBlocked: false,
        });
        currentTime += slotDuration;
      }
    }

    if (slotsToInsert.length > 0) {
      await db.insert(availabilitySlots).values(slotsToInsert);
    }

    return NextResponse.json({ success: true, slotsGenerated: slotsToInsert.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Réinitialiser les statistiques de visites
export async function DELETE(request: NextRequest) {
  try {
    const business = await getCurrentBusiness();
    if (!business) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const { db } = await import("@/db");
    const { businesses } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");

    await db.update(businesses).set({ visitsResetAt: new Date() }).where(eq(businesses.id, business.id));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
