/**
 * GET /api/v1/clients?limit=50&cursor=<iso>
 * Liste paginée des clients CRM du business.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { and, desc, eq, isNull, lt } from "drizzle-orm";
import { requireApiKey } from "@/lib/public-api";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireApiKey(req);
  if (!gate.ok) return gate.response;

  try {
    const url = new URL(req.url);
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit")) || 25));
    const cursor = url.searchParams.get("cursor");

    const filters = [
      eq(clients.businessId, gate.auth.businessId),
      isNull(clients.deletedAt),
    ];
    if (cursor) filters.push(lt(clients.createdAt, new Date(cursor)));

    const rows = await db
      .select({
        id: clients.id,
        firstName: clients.firstName,
        lastName: clients.lastName,
        email: clients.email,
        phone: clients.phone,
        source: clients.source,
        appointmentsCount: clients.appointmentsCount,
        totalSpent: clients.totalSpent,
        createdAt: clients.createdAt,
      })
      .from(clients)
      .where(and(...filters))
      .orderBy(desc(clients.createdAt))
      .limit(limit);

    return NextResponse.json({
      clients: rows,
      nextCursor: rows.length === limit ? rows[rows.length - 1].createdAt.toISOString() : null,
    });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/v1/clients" });
  }
}
