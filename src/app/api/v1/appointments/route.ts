/**
 * GET  /api/v1/appointments?limit=50&cursor=<iso>&status=confirmed
 *   → Liste paginée des RDV du business (cursor = created_at ISO)
 *
 * POST /api/v1/appointments  (scope=read_write)
 *   → Crée un RDV (client déjà connu OU on crée le client à la volée par phone)
 *
 * Toutes les réponses sont filtrées `deleted_at IS NULL`.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { appointments, clients } from "@/db/schema";
import { and, desc, eq, isNull, lt } from "drizzle-orm";
import { requireApiKey } from "@/lib/public-api";
import { handleApiError, badRequest } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";
import { dispatchWebhook } from "@/lib/webhooks-out";

export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  // Soit clientId direct, soit création à la volée par phone
  clientId: z.string().uuid().optional(),
  client: z
    .object({
      firstName: z.string().min(1).max(100),
      lastName: z.string().min(1).max(100),
      phone: z.string().min(4).max(20),
      email: z.string().email().max(255).optional(),
    })
    .optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format attendu YYYY-MM-DD"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Format attendu HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Format attendu HH:MM"),
});

export async function GET(req: NextRequest) {
  const gate = await requireApiKey(req);
  if (!gate.ok) return gate.response;

  try {
    const url = new URL(req.url);
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit")) || 25));
    const cursor = url.searchParams.get("cursor");
    const status = url.searchParams.get("status");

    const filters = [
      eq(appointments.businessId, gate.auth.businessId),
      isNull(appointments.deletedAt),
    ];
    if (cursor) filters.push(lt(appointments.createdAt, new Date(cursor)));
    if (status && ["pending", "confirmed", "cancelled", "completed"].includes(status)) {
      filters.push(eq(appointments.status, status as "pending" | "confirmed" | "cancelled" | "completed"));
    }

    const rows = await db
      .select({
        id: appointments.id,
        clientId: appointments.clientId,
        title: appointments.title,
        description: appointments.description,
        date: appointments.date,
        startTime: appointments.startTime,
        endTime: appointments.endTime,
        status: appointments.status,
        createdAt: appointments.createdAt,
        updatedAt: appointments.updatedAt,
      })
      .from(appointments)
      .where(and(...filters))
      .orderBy(desc(appointments.createdAt))
      .limit(limit);

    return NextResponse.json({
      appointments: rows,
      // Cursor pour la page suivante : dernier createdAt ISO
      nextCursor: rows.length === limit ? rows[rows.length - 1].createdAt.toISOString() : null,
    });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/v1/appointments" });
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireApiKey(req, /* requireWrite */ true);
  if (!gate.ok) return gate.response;

  try {
    const data = await validateBody(req, CreateSchema);

    // Résolution du client : soit id existant (et lui appartient), soit création
    let clientId = data.clientId ?? null;
    if (!clientId && data.client) {
      const [existing] = await db
        .select({ id: clients.id })
        .from(clients)
        .where(
          and(
            eq(clients.businessId, gate.auth.businessId),
            eq(clients.phone, data.client.phone),
            isNull(clients.deletedAt)
          )
        )
        .limit(1);

      if (existing) {
        clientId = existing.id;
      } else {
        const [created] = await db
          .insert(clients)
          .values({
            businessId: gate.auth.businessId,
            firstName: data.client.firstName,
            lastName: data.client.lastName,
            phone: data.client.phone,
            email: data.client.email ?? null,
            source: "referral",
          })
          .returning({ id: clients.id });
        clientId = created.id;
      }
    }
    if (!clientId) throw badRequest("clientId ou client requis");

    // Vérif ownership du clientId fourni (anti-IDOR)
    if (data.clientId) {
      const [owned] = await db
        .select({ id: clients.id })
        .from(clients)
        .where(
          and(
            eq(clients.id, data.clientId),
            eq(clients.businessId, gate.auth.businessId),
            isNull(clients.deletedAt)
          )
        )
        .limit(1);
      if (!owned) throw badRequest("clientId inconnu ou n'appartient pas à ce business");
    }

    const [created] = await db
      .insert(appointments)
      .values({
        businessId: gate.auth.businessId,
        clientId,
        title: data.title,
        description: data.description ?? null,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        status: "confirmed",
      })
      .returning();

    // Webhook sortant asynchrone
    dispatchWebhook("appointment.created", gate.auth.businessId, {
      id: created.id,
      title: created.title,
      date: created.date,
      startTime: created.startTime,
      endTime: created.endTime,
      status: created.status,
      clientId: created.clientId,
    });

    return NextResponse.json({ appointment: created }, { status: 201 });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/v1/appointments" });
  }
}
