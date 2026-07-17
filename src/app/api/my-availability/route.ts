import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { workingHours, availabilitySlots, businesses } from "@/db/schema";
import { eq, and, gte } from "drizzle-orm";
import { getCurrentBusiness } from "@/lib/session";
import { handleApiError, unauthorized, badRequest } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const TIME_RE = /^\d{2}:\d{2}$/;

const HoursSchema = z.object({
  hours: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        startTime: z.string().regex(TIME_RE, "Format HH:MM attendu"),
        endTime: z.string().regex(TIME_RE, "Format HH:MM attendu"),
        isClosed: z.boolean(),
      })
    )
    .min(1)
    .max(7),
});

const GenerateSchema = z.object({
  daysAhead: z.number().int().min(1).max(365).default(30),
  slotDuration: z.number().int().min(5).max(480).default(60), // minutes
});

export async function GET(request: NextRequest) {
  // Lot 64 : 60 lectures/min — le dashboard peut poller pour refresh calendar
  const rl = checkRateLimit(request, { key: "my-availability-get", limit: 60, windowSec: 60 });
  if (!rl.ok) return rl.response;

  try {
    const business = await getCurrentBusiness();
    if (!business) return NextResponse.json({ hours: [], slots: [] });

    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get("fromDate");

    const [hours, slots] = await Promise.all([
      db
        .select()
        .from(workingHours)
        .where(eq(workingHours.businessId, business.id))
        .orderBy(workingHours.dayOfWeek),
      fromDate
        ? db
            .select()
            .from(availabilitySlots)
            .where(
              and(
                eq(availabilitySlots.businessId, business.id),
                gte(availabilitySlots.date, fromDate),
                eq(availabilitySlots.isBlocked, false)
              )
            )
            .orderBy(availabilitySlots.date, availabilitySlots.startTime)
        : db
            .select()
            .from(availabilitySlots)
            .where(
              and(
                eq(availabilitySlots.businessId, business.id),
                eq(availabilitySlots.isBlocked, false)
              )
            )
            .orderBy(availabilitySlots.date, availabilitySlots.startTime),
    ]);

    return NextResponse.json({ hours, slots });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/my-availability" });
  }
}

export async function PUT(request: NextRequest) {
  // Lot 64 : 30 updates horaires/h — un pro change ses horaires rarement
  const rl = checkRateLimit(request, { key: "my-availability-put", limit: 30, windowSec: 3600 });
  if (!rl.ok) return rl.response;

  try {
    const business = await getCurrentBusiness();
    if (!business) throw unauthorized();

    const { hours } = await validateBody(request, HoursSchema);

    await db.delete(workingHours).where(eq(workingHours.businessId, business.id));

    await db.insert(workingHours).values(
      hours.map((h) => ({
        businessId: business.id,
        dayOfWeek: h.dayOfWeek,
        startTime: h.isClosed ? null : h.startTime,
        endTime: h.isClosed ? null : h.endTime,
        isClosed: h.isClosed,
      }))
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, { route: "PUT /api/my-availability" });
  }
}

// POST : génère automatiquement des créneaux à partir des horaires
export async function POST(request: NextRequest) {
  // Lot 64 : 10 générations/h — opération lourde (peut créer 100s de slots)
  const rl = checkRateLimit(request, { key: "my-availability-gen", limit: 10, windowSec: 3600 });
  if (!rl.ok) return rl.response;

  try {
    const business = await getCurrentBusiness();
    if (!business) throw unauthorized();

    const { daysAhead, slotDuration } = await validateBody(request, GenerateSchema);

    const hours = await db
      .select()
      .from(workingHours)
      .where(eq(workingHours.businessId, business.id));
    if (hours.length === 0) {
      throw badRequest("Configurez d'abord vos horaires d'ouverture");
    }

    const today = new Date().toISOString().split("T")[0];
    await db
      .delete(availabilitySlots)
      .where(
        and(
          eq(availabilitySlots.businessId, business.id),
          gte(availabilitySlots.date, today),
          eq(availabilitySlots.isBooked, false)
        )
      );

    const slotsToInsert: Array<{
      businessId: string;
      date: string;
      startTime: string;
      endTime: string;
      isBooked: boolean;
      isBlocked: boolean;
    }> = [];
    const hoursMap = new Map(hours.map((h) => [h.dayOfWeek, h]));

    for (let i = 0; i < daysAhead; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];
      const dayOfWeek = date.getDay();

      const dayHours = hoursMap.get(dayOfWeek);
      if (!dayHours || dayHours.isClosed || !dayHours.startTime || !dayHours.endTime) continue;

      const [startH, startM] = dayHours.startTime.split(":").map(Number);
      const [endH, endM] = dayHours.endTime.split(":").map(Number);
      let currentMin = startH * 60 + startM;
      const endMin = endH * 60 + endM;

      while (currentMin + slotDuration <= endMin) {
        const h = Math.floor(currentMin / 60);
        const m = currentMin % 60;
        const startTime = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
        const endTime = `${Math.floor((currentMin + slotDuration) / 60)
          .toString()
          .padStart(2, "0")}:${((currentMin + slotDuration) % 60).toString().padStart(2, "0")}`;

        slotsToInsert.push({
          businessId: business.id,
          date: dateStr,
          startTime,
          endTime,
          isBooked: false,
          isBlocked: false,
        });
        currentMin += slotDuration;
      }
    }

    if (slotsToInsert.length > 0) {
      await db.insert(availabilitySlots).values(slotsToInsert);
    }

    return NextResponse.json({ success: true, slotsGenerated: slotsToInsert.length });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/my-availability" });
  }
}

// DELETE : réinitialise les statistiques de visites du business courant
export async function DELETE(request: NextRequest) {
  // Lot 64 : 5 resets/h — action rare et destructive (efface les stats)
  const rl = checkRateLimit(request, { key: "my-availability-reset", limit: 5, windowSec: 3600 });
  if (!rl.ok) return rl.response;

  try {
    const business = await getCurrentBusiness();
    if (!business) throw unauthorized();

    await db
      .update(businesses)
      .set({ visitsResetAt: new Date() })
      .where(eq(businesses.id, business.id));

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, { route: "DELETE /api/my-availability" });
  }
}
