/**
 * F4 (Lot 33) — GET /api/calendar/[secret]
 *
 * Renvoie tous les RDV d'un business au format iCalendar (RFC 5545).
 * URL abonnable dans Apple Calendar, Outlook, Google Calendar, Thunderbird.
 *
 * Sécurité : l'URL contient un secret hex 32 chars (`icsSecret` sur businesses).
 * Le pro peut le rotate depuis les paramètres (invalide toutes les abonnements
 * en cours). Aucune auth cookie/token — l'URL EST le secret.
 *
 * Retourne `.ics` avec les bons headers pour les clients CalDAV :
 *  - `Content-Type: text/calendar; charset=utf-8`
 *  - `Content-Disposition: attachment; filename="..."` (fallback download)
 *  - `Cache-Control: public, max-age=300` (5 min — évite d'hammer la DB si le
 *    client polle toutes les 15 min comme Apple)
 *
 * Filtre :
 *  - Soft-deleted exclus
 *  - Status "cancelled" → export mais marqué CANCELLED côté client (leur permet
 *    de mettre à jour un event déjà importé)
 *  - Limité aux RDV entre now-1an et now+1an (évite payload énorme)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, businesses, clients, unavailabilities } from "@/db/schema";
import { and, eq, gte, lte, isNull } from "drizzle-orm";
import { buildIcsCalendar, composeDateTime, type ICalEvent } from "@/lib/ical";
import { checkRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Rate-limit léger : les clients CalDAV polling toutes les 5-15 min
const RATE = { key: "ics", limit: 30, windowSec: 60 } as const;

export async function GET(request: NextRequest, ctx: { params: Promise<{ secret: string }> }) {
  const rl = checkRateLimit(request, RATE);
  if (!rl.ok) return rl.response;

  const { secret } = await ctx.params;
  // Enlève l'extension .ics si présente (URL "friendly" pour les users)
  const cleanSecret = secret.replace(/\.ics$/, "");

  if (!cleanSecret || cleanSecret.length < 16 || cleanSecret.length > 64) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    // 1. Résoudre le business par icsSecret
    const [business] = await db
      .select()
      .from(businesses)
      .where(and(eq(businesses.icsSecret, cleanSecret), isNull(businesses.deletedAt)))
      .limit(1);

    if (!business) {
      // Génère toujours 404 (jamais 401) pour ne pas fuiter l'existence d'un secret
      return new NextResponse("Not found", { status: 404 });
    }

    // 2. Fenêtre glissante ±1 an
    const now = new Date();
    const from = new Date(now.getTime() - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const to = new Date(now.getTime() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    // 3. RDV avec client (LEFT JOIN pour ne pas perdre les RDV sans client)
    const rdvRows = await db
      .select({
        id: appointments.id,
        title: appointments.title,
        description: appointments.description,
        date: appointments.date,
        startTime: appointments.startTime,
        endTime: appointments.endTime,
        status: appointments.status,
        updatedAt: appointments.updatedAt,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        clientPhone: clients.phone,
        clientEmail: clients.email,
      })
      .from(appointments)
      .leftJoin(clients, eq(appointments.clientId, clients.id))
      .where(
        and(
          eq(appointments.businessId, business.id),
          gte(appointments.date, from),
          lte(appointments.date, to),
          isNull(appointments.deletedAt)
        )
      )
      .limit(2000);

    // 4. Indisponibilités (même fenêtre)
    const unavailRows = await db
      .select()
      .from(unavailabilities)
      .where(
        and(
          eq(unavailabilities.businessId, business.id),
          gte(unavailabilities.date, from),
          lte(unavailabilities.date, to)
        )
      )
      .limit(1000);

    // 5. Domain email pour l'organizer / UID (fallback vitrix.fr)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr";
    const domain = new URL(appUrl).hostname;

    // 6. Construction des events
    const events: ICalEvent[] = [];

    for (const r of rdvRows) {
      const clientLabel = [r.clientFirstName, r.clientLastName].filter(Boolean).join(" ") || "";
      const summary = clientLabel ? `${r.title} — ${clientLabel}` : r.title;
      const descParts: string[] = [];
      if (r.description) descParts.push(r.description);
      if (r.clientPhone) descParts.push(`Tel: ${r.clientPhone}`);
      if (r.clientEmail) descParts.push(`Email: ${r.clientEmail}`);
      descParts.push(`Vitrix: ${appUrl}/dashboard/appointments`);

      events.push({
        uid: `appointment-${r.id}@${domain}`,
        start: composeDateTime(r.date, r.startTime),
        end: composeDateTime(r.date, r.endTime),
        summary,
        description: descParts.join("\n"),
        location: business.address
          ? `${business.address}${business.city ? ", " + business.city : ""}`
          : undefined,
        status:
          r.status === "confirmed"
            ? "CONFIRMED"
            : r.status === "cancelled"
              ? "CANCELLED"
              : "TENTATIVE",
        url: `${appUrl}/dashboard/appointments`,
        lastModified: r.updatedAt ?? undefined,
      });
    }

    for (const u of unavailRows) {
      // Un bloc sans heure = journée entière → 00:00 → 23:59
      const startTime = u.startTime ?? "00:00";
      const endTime = u.endTime ?? "23:59";
      events.push({
        uid: `unavail-${u.id}@${domain}`,
        start: composeDateTime(u.date, startTime),
        end: composeDateTime(u.date, endTime),
        summary: `⛔ ${u.title}`,
        description: u.notes ?? undefined,
        status: "CONFIRMED",
        lastModified: u.updatedAt ?? undefined,
      });
    }

    const ics = buildIcsCalendar(events, {
      calendarName: `${business.name} — Vitrix`,
      timezone: "Europe/Paris",
    });

    logger.info("ics.served", { businessId: business.id, eventCount: events.length });

    return new NextResponse(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `inline; filename="vitrix-${business.slug}.ics"`,
        "Cache-Control": "public, max-age=300",
        // Empêche les crawlers d'indexer
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (err) {
    logger.error("ics.failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return new NextResponse("Internal error", { status: 500 });
  }
}
