/**
 * Gestion des webhook endpoints du user courant.
 *
 * GET  → liste endpoints
 * POST { url, events? } → crée un endpoint, retourne signingSecret 1× (à copier)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { webhookEndpoints } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getCurrentUser, getCurrentBusiness } from "@/lib/session";
import { handleApiError, unauthorized, badRequest } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";
import { ALL_WEBHOOK_EVENTS, generateWebhookSecret } from "@/lib/webhooks-out";

export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  url: z
    .string()
    .url("URL invalide")
    .max(500)
    .refine((u) => u.startsWith("https://"), "URL doit commencer par https://"),
  events: z.array(z.enum(ALL_WEBHOOK_EVENTS as [string, ...string[]])).default([]),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw unauthorized();

    const rows = await db
      .select({
        id: webhookEndpoints.id,
        url: webhookEndpoints.url,
        events: webhookEndpoints.events,
        failureCount: webhookEndpoints.failureCount,
        disabledAt: webhookEndpoints.disabledAt,
        createdAt: webhookEndpoints.createdAt,
      })
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.userId, user.id))
      .orderBy(desc(webhookEndpoints.createdAt));

    return NextResponse.json({ endpoints: rows, availableEvents: ALL_WEBHOOK_EVENTS });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/account/webhooks" });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw unauthorized();
    const business = await getCurrentBusiness();
    if (!business) throw badRequest("Vous devez avoir un business créé.");

    const data = await validateBody(req, CreateSchema);

    // Max 5 endpoints par user (pratiquement jamais atteint)
    const existing = await db
      .select({ id: webhookEndpoints.id })
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.userId, user.id));
    if (existing.length >= 5) {
      throw badRequest("Limite de 5 endpoints atteinte.");
    }

    const secret = generateWebhookSecret();

    const [created] = await db
      .insert(webhookEndpoints)
      .values({
        userId: user.id,
        businessId: business.id,
        url: data.url,
        events: data.events,
        signingSecret: secret,
      })
      .returning({ id: webhookEndpoints.id });

    // Secret montré 1× (comme les API keys)
    return NextResponse.json(
      {
        id: created.id,
        signingSecret: secret,
        warning:
          "Ce secret n'apparaîtra plus. Copiez-le pour vérifier les signatures HMAC X-Vitrix-Signature.",
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err, { route: "POST /api/account/webhooks" });
  }
}
