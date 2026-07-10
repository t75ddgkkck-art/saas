/**
 * GET /api/clients/export
 * Export CSV de tous les clients du business courant (Lot 24).
 *
 * Format compatible Excel (BOM UTF-8 + séparateur virgule).
 * Colonnes : firstName, lastName, email, phone, address, source,
 * appointmentsCount, quotesCount, noShowsCount, totalSpent, createdAt.
 *
 * Rate limit 5/h (export = action ponctuelle, pas de spam).
 * Auth : plan Pro+ (mêmes règles que le CRM).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import { getCurrentBusiness } from "@/lib/session";
import { requirePermission } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { handleApiError, unauthorized } from "@/lib/api-error";
import { serializeCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const rl = checkRateLimit(req, {
    key: "clients:export",
    limit: 5,
    windowSec: 3600,
  });
  if (!rl.ok) return rl.response;

  const perm = await requirePermission("canAddClients");
  if (perm.error) return perm.error;

  try {
    const business = await getCurrentBusiness();
    if (!business) throw unauthorized();

    const rows = await db
      .select({
        firstName: clients.firstName,
        lastName: clients.lastName,
        email: clients.email,
        phone: clients.phone,
        address: clients.address,
        source: clients.source,
        appointmentsCount: clients.appointmentsCount,
        quotesCount: clients.quotesCount,
        noShowsCount: clients.noShowsCount,
        totalSpent: clients.totalSpent,
        createdAt: clients.createdAt,
      })
      .from(clients)
      .where(and(eq(clients.businessId, business.id), isNull(clients.deletedAt)))
      .orderBy(asc(clients.lastName), asc(clients.firstName));

    // Format ISO date pour createdAt (JJ/MM/AAAA côté Excel → mieux)
    const shaped = rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString().slice(0, 10),
    }));

    const csv = serializeCsv(
      shaped,
      [
        "firstName",
        "lastName",
        "email",
        "phone",
        "address",
        "source",
        "appointmentsCount",
        "quotesCount",
        "noShowsCount",
        "totalSpent",
        "createdAt",
      ],
      { bom: true }
    );

    const filename = `clients-vitrix-${new Date().toISOString().slice(0, 10)}.csv`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/clients/export" });
  }
}
