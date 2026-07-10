/**
 * GET /api/admin/users?q=<search>&page=1&limit=50
 * Liste paginée des users, avec recherche par email/nom.
 * Accès admin uniquement.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { and, desc, ilike, or, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() || "";
    // Clamp page/limit — évite qu'un admin curieux fasse un LIMIT 100000
    const page = Math.max(1, Math.min(1000, Number(url.searchParams.get("page")) || 1));
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit")) || 50));
    const offset = (page - 1) * limit;

    // Filtre recherche : email OU firstName OU lastName (ILIKE, insensible à la casse)
    const whereClause = q
      ? and(
          or(
            ilike(users.email, `%${q}%`),
            ilike(users.firstName, `%${q}%`),
            ilike(users.lastName, `%${q}%`)
          )
        )
      : undefined;

    const [rows, countRow] = await Promise.all([
      db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          subscription: users.subscription,
          subscriptionStatus: users.subscriptionStatus,
          subscriptionExpiresAt: users.subscriptionExpiresAt,
          emailVerified: users.emailVerified,
          bannedAt: users.bannedAt,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(whereClause)
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset),
      db.execute<{ total: string }>(sql`
        SELECT COUNT(*)::text AS total FROM users
        ${q ? sql`WHERE email ILIKE ${"%" + q + "%"} OR first_name ILIKE ${"%" + q + "%"} OR last_name ILIKE ${"%" + q + "%"}` : sql``}
      `),
    ]);

    const total = Number(countRow.rows[0]?.total ?? 0);

    return NextResponse.json({
      users: rows,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/admin/users" });
  }
}
