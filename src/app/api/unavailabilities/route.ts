/**
 * F4 (Lot 33) — CRUD blocs d'indisponibilité.
 *
 * GET   → liste des indispos du business dans une fenêtre (?from=&to=)
 * POST  → crée un bloc (journée entière si startTime/endTime omis)
 *
 * Auth : requireTeamPermission("appointments.create") — assistant peut créer
 * un bloc "déjeuner" mais un viewer ne peut pas.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { unavailabilities } from "@/db/schema";
import { and, eq, gte, lte, asc } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateBody } from "@/lib/api-helpers";
import { handleApiError, badRequest } from "@/lib/api-error";
import { requireTeamPermission } from "@/lib/team-context";

export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD"),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "HH:MM")
    .nullable()
    .optional(),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "HH:MM")
    .nullable()
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Couleur hex #RRGGBB")
    .nullable()
    .optional(),
  notes: z.string().max(1000).nullable().optional(),
  /** Si présent, ne bloque QUE ce membre. Sinon toute l'équipe. */
  userId: z.string().uuid().nullable().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireTeamPermission("appointments.view");
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const filters = [eq(unavailabilities.businessId, ctx.business.id)];
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
      filters.push(gte(unavailabilities.date, from));
    }
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      filters.push(lte(unavailabilities.date, to));
    }

    const rows = await db
      .select()
      .from(unavailabilities)
      .where(and(...filters))
      .orderBy(asc(unavailabilities.date), asc(unavailabilities.startTime));

    return NextResponse.json({ unavailabilities: rows });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/unavailabilities" });
  }
}

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, { key: "unavail:create", limit: 60, windowSec: 3600 });
  if (!rl.ok) return rl.response;

  try {
    const ctx = await requireTeamPermission("appointments.create");
    const data = await validateBody(req, CreateSchema);

    // Cohérence : si startTime, endTime doit être > startTime
    if (data.startTime && data.endTime && data.endTime <= data.startTime) {
      throw badRequest("L'heure de fin doit être après l'heure de début");
    }

    const [created] = await db
      .insert(unavailabilities)
      .values({
        businessId: ctx.business.id,
        userId: data.userId ?? null,
        title: data.title,
        date: data.date,
        startTime: data.startTime ?? null,
        endTime: data.endTime ?? null,
        color: data.color ?? null,
        notes: data.notes ?? null,
      })
      .returning();

    return NextResponse.json({ unavailability: created }, { status: 201 });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/unavailabilities" });
  }
}
