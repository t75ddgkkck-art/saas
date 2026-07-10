/**
 * Gestion des clés API du user courant.
 *
 * GET  → liste (sans le hash ni la clé claire)
 * POST { name, scope } → crée une nouvelle clé, retourne la RAW KEY une seule fois
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { getCurrentUser, getCurrentBusiness } from "@/lib/session";
import { handleApiError, unauthorized, badRequest } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";
import { generateApiKey } from "@/lib/api-keys";

export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  scope: z.enum(["read", "read_write"]).default("read"),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw unauthorized();

    const rows = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        scope: apiKeys.scope,
        lastUsedAt: apiKeys.lastUsedAt,
        lastUsedIp: apiKeys.lastUsedIp,
        revokedAt: apiKeys.revokedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, user.id))
      .orderBy(desc(apiKeys.createdAt));

    return NextResponse.json({ keys: rows });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/account/api-keys" });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw unauthorized();
    const business = await getCurrentBusiness();
    if (!business) throw badRequest("Vous devez avoir un business créé.");

    const data = await validateBody(req, CreateSchema);

    // Limite raisonnable : 10 clés actives max par user
    const active = await db
      .select({ id: apiKeys.id })
      .from(apiKeys)
      .where(and(eq(apiKeys.userId, user.id), eq(apiKeys.revokedAt, apiKeys.revokedAt)));
    if (active.length >= 10) {
      throw badRequest("Limite de 10 clés atteinte. Révoquez-en avant d'en créer une nouvelle.");
    }

    const { rawKey, keyPrefix, keyHash } = generateApiKey("live");

    await db.insert(apiKeys).values({
      userId: user.id,
      businessId: business.id,
      name: data.name,
      scope: data.scope,
      keyPrefix,
      keyHash,
    });

    // La rawKey n'est renvoyée QU'UNE FOIS ici (jamais stockée en clair).
    return NextResponse.json(
      {
        key: rawKey,
        keyPrefix,
        warning: "Cette clé n'apparaîtra plus jamais. Copiez-la maintenant dans un endroit sûr.",
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err, { route: "POST /api/account/api-keys" });
  }
}
