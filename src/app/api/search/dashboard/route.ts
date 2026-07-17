/**
 * Lot 55 — GET /api/search/dashboard?q=<query>
 *
 * Recherche AUTHENTIFIÉE dans les données privées du pro courant.
 * Distinct de `/api/search` (publique businesses + blog).
 *
 * Sources :
 *  - Clients (nom, prénom, email, téléphone)
 *  - Rendez-vous (titre, description) + join client
 *  - Devis (numéro, titre) + join client
 *  - Factures (numéro) + join client
 *
 * Sécurité :
 *  - Auth via getCurrentBusiness (anti-IDOR : filtre businessId)
 *  - Rate limit strict (30 requests/min/user — plus tolérant que search publique
 *    car un power user peut taper vite)
 *  - Soft delete filtré (isNull deletedAt) partout
 *  - Cap 5 résultats par groupe (max 20 total)
 *
 * Pattern : 4 requêtes parallèles Promise.all → 1 seule round-trip logique.
 */

import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, appointments, quotes, invoices } from "@/db/schema";
import { getCurrentBusiness } from "@/lib/session";
import { handleApiError, unauthorized } from "@/lib/api-error";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const RATE = { key: "search-dashboard", limit: 30, windowSec: 60 } as const;

interface SearchResult {
  type: "client" | "appointment" | "quote" | "invoice";
  title: string;
  subtitle: string;
  href: string;
  /** Timestamp pour tri par récence quand pertinent */
  updatedAt?: string;
}

export async function GET(req: NextRequest) {
  const rl = checkRateLimit(req, RATE);
  if (!rl.ok) return rl.response;

  try {
    const biz = await getCurrentBusiness();
    if (!biz) throw unauthorized();

    const url = new URL(req.url);
    const raw = (url.searchParams.get("q") || "").trim();
    if (raw.length < 2) {
      return NextResponse.json({ results: [] });
    }
    // Cap 100 chars pour éviter les ILIKE monstrueux
    const q = raw.slice(0, 100);
    const pattern = `%${q}%`;

    // 4 requêtes en parallèle — Postgres/driver mutualisent bien
    const [clientRows, apptRows, quoteRows, invoiceRows] = await Promise.all([
      // Clients : recherche nom + email + téléphone
      db
        .select({
          id: clients.id,
          firstName: clients.firstName,
          lastName: clients.lastName,
          email: clients.email,
          phone: clients.phone,
          updatedAt: clients.updatedAt,
        })
        .from(clients)
        .where(
          and(
            eq(clients.businessId, biz.id),
            isNull(clients.deletedAt),
            or(
              ilike(sql`${clients.firstName} || ' ' || ${clients.lastName}`, pattern),
              ilike(clients.email, pattern),
              ilike(clients.phone, pattern)
            )
          )
        )
        .orderBy(desc(clients.updatedAt))
        .limit(5),

      // Rendez-vous : recherche titre + description + join client (via clientId → nom)
      db
        .select({
          id: appointments.id,
          title: appointments.title,
          description: appointments.description,
          date: appointments.date,
          startTime: appointments.startTime,
          status: appointments.status,
        })
        .from(appointments)
        .where(
          and(
            eq(appointments.businessId, biz.id),
            isNull(appointments.deletedAt),
            or(
              ilike(appointments.title, pattern),
              ilike(appointments.description, pattern)
            )
          )
        )
        .orderBy(desc(appointments.date))
        .limit(5),

      // Devis : numéro + titre
      db
        .select({
          id: quotes.id,
          quoteNumber: quotes.quoteNumber,
          title: quotes.title,
          total: quotes.total,
          status: quotes.status,
          updatedAt: quotes.updatedAt,
        })
        .from(quotes)
        .where(
          and(
            eq(quotes.businessId, biz.id),
            isNull(quotes.deletedAt),
            or(ilike(quotes.quoteNumber, pattern), ilike(quotes.title, pattern))
          )
        )
        .orderBy(desc(quotes.updatedAt))
        .limit(5),

      // Factures : numéro
      db
        .select({
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          total: invoices.total,
          status: invoices.status,
          issueDate: invoices.issueDate,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.businessId, biz.id),
            isNull(invoices.deletedAt),
            ilike(invoices.invoiceNumber, pattern)
          )
        )
        .orderBy(desc(invoices.createdAt))
        .limit(5),
    ]);

    // Formatage unifié pour la Command Palette
    const results: SearchResult[] = [
      ...clientRows.map((c): SearchResult => ({
        type: "client",
        title: [c.firstName, c.lastName].filter(Boolean).join(" ") || "Client",
        subtitle: [c.email, c.phone].filter(Boolean).join(" · ") || "Sans coordonnées",
        href: `/dashboard/clients/${c.id}`,
        updatedAt: c.updatedAt?.toISOString(),
      })),
      ...apptRows.map((a): SearchResult => ({
        type: "appointment",
        title: a.title,
        subtitle: `${a.date} · ${a.startTime} · ${a.status}`,
        href: `/dashboard/appointments`, // On ne linke pas vers un id précis (pas de page detail RDV)
        updatedAt: undefined,
      })),
      ...quoteRows.map((q): SearchResult => ({
        type: "quote",
        title: `${q.quoteNumber} · ${q.title}`,
        subtitle: `${Number(q.total ?? 0).toFixed(2)} € · ${q.status}`,
        href: `/dashboard/quotes/${q.id}`,
        updatedAt: q.updatedAt?.toISOString(),
      })),
      ...invoiceRows.map((i): SearchResult => ({
        type: "invoice",
        title: i.invoiceNumber,
        subtitle: `${Number(i.total).toFixed(2)} € · ${i.status} · ${i.issueDate}`,
        href: `/dashboard/invoices`, // Pas de page detail facture (juste liste)
      })),
    ];

    return NextResponse.json({ results });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/search/dashboard" });
  }
}
