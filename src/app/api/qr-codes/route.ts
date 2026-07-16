/**
 * Lot 47 (F12) — GET + POST /api/qr-codes
 *
 * GET  : liste des QR codes du business courant, avec `scansCount` agrégé
 *        depuis `page_visits.source` (join côté SQL, pas de N+1)
 *
 * POST : crée un nouveau QR code.
 *        - Gate quota via `maxQrCodes` (Free 1 / Pro 3 / Premium 20)
 *        - Slugify source côté serveur (défensif, même si le client l'a déjà fait)
 *        - Unicité source par business — 409 conflict si doublon
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { qrCodes, pageVisits, businesses } from "@/db/schema";
import { getCurrentBusiness } from "@/lib/session";
import { handleApiError, unauthorized, conflict } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkQuota } from "@/lib/entitlements";
import type { SubscriptionPlan } from "@/lib/permissions";
import { slugifySource, validateSource } from "@/lib/qr-tracking";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const LIST_RATE = { key: "qr-codes-list", limit: 60, windowSec: 60 } as const;
const CREATE_RATE = { key: "qr-codes-create", limit: 10, windowSec: 300 } as const;

// -----------------------------------------------------------------------------
// GET — liste des QR + scans agrégés
// -----------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const rl = checkRateLimit(req, LIST_RATE);
  if (!rl.ok) return rl.response;

  try {
    const biz = await getCurrentBusiness();
    if (!biz) throw unauthorized();

    // 1) Charge les QR du business (soft delete filter)
    const rows = await db
      .select()
      .from(qrCodes)
      .where(and(eq(qrCodes.businessId, biz.id), isNull(qrCodes.deletedAt)))
      .orderBy(desc(qrCodes.createdAt));

    if (rows.length === 0) {
      return NextResponse.json({ ok: true, qrCodes: [] });
    }

    // 2) Agrège les scans depuis page_visits.source
    //    On fait UN seul SELECT groupé sur les sources connues (efficient).
    const sourceValues = rows.map((r) => r.source);
    const scansAgg = await db
      .select({
        source: pageVisits.source,
        scans: count(pageVisits.id).as("scans"),
      })
      .from(pageVisits)
      .where(
        and(
          eq(pageVisits.businessId, biz.id),
          sql`${pageVisits.source} = ANY(${sourceValues})`
        )
      )
      .groupBy(pageVisits.source);

    const scansMap = new Map(scansAgg.map((s) => [s.source, Number(s.scans)]));

    return NextResponse.json({
      ok: true,
      qrCodes: rows.map((r) => ({
        id: r.id,
        label: r.label,
        source: r.source,
        utmCampaign: r.utmCampaign,
        utmMedium: r.utmMedium,
        utmContent: r.utmContent,
        scansCount: scansMap.get(r.source) ?? 0,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/qr-codes" });
  }
}

// -----------------------------------------------------------------------------
// POST — création d'un nouveau QR code
// -----------------------------------------------------------------------------

const CreateSchema = z.object({
  label: z.string().trim().min(1, "Libellé requis").max(100),
  /** Source raw — sera re-slugify côté serveur pour sécurité */
  source: z.string().trim().min(1, "Source requise").max(100),
  utmCampaign: z.string().trim().max(100).optional(),
  utmContent: z.string().trim().max(100).optional(),
});

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, CREATE_RATE);
  if (!rl.ok) return rl.response;

  try {
    const biz = await getCurrentBusiness();
    if (!biz) throw unauthorized();

    const data = await validateBody(req, CreateSchema);

    // Validation + slugify (défensif — le client peut envoyer n'importe quoi)
    const validationError = validateSource(data.source);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
    const slug = slugifySource(data.source);

    // Vérif quota — on charge l'owner pour connaître son plan
    const [owner] = await db
      .select({ subscription: businesses.ownerId })
      .from(businesses)
      .where(eq(businesses.id, biz.id))
      .limit(1);
    // biz.ownerId est disponible directement via getCurrentBusiness()
    // (on relit pour être sûr en cas de multi-tenant edge case)

    // Compte QR existants pour ce business (hors soft-deleted)
    const [{ n }] = await db
      .select({ n: count() })
      .from(qrCodes)
      .where(and(eq(qrCodes.businessId, biz.id), isNull(qrCodes.deletedAt)));

    // Récupère le plan du owner via la table users
    const ownerId = biz.ownerId;
    const { users } = await import("@/db/schema");
    const [u] = await db
      .select({ subscription: users.subscription })
      .from(users)
      .where(eq(users.id, ownerId))
      .limit(1);
    const plan = (u?.subscription || "free") as SubscriptionPlan;

    const q = checkQuota(plan, "maxQrCodes", Number(n));
    if (!q.allowed) {
      return NextResponse.json(
        {
          error: `Vous avez atteint le maximum de ${q.limit} QR code${q.limit > 1 ? "s" : ""} pour votre plan.`,
          limit: q.limit,
          current: Number(n),
          upgradeTo: plan === "free" ? "pro" : "premium",
        },
        { status: 403 }
      );
    }

    // Insert avec check unicité source
    try {
      const [created] = await db
        .insert(qrCodes)
        .values({
          businessId: biz.id,
          label: data.label,
          source: slug,
          utmCampaign: data.utmCampaign || null,
          utmContent: data.utmContent || null,
        })
        .returning();

      logger.info("qr-code.created", {
        businessId: biz.id,
        qrId: created.id,
        source: slug,
      });

      return NextResponse.json(
        {
          ok: true,
          qrCode: {
            id: created.id,
            label: created.label,
            source: created.source,
            utmCampaign: created.utmCampaign,
            utmMedium: created.utmMedium,
            utmContent: created.utmContent,
            scansCount: 0,
            createdAt: created.createdAt,
          },
        },
        { status: 201 }
      );
    } catch (dbErr) {
      // Contrainte unique violée → doublon de source
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      if (msg.includes("qr_codes_business_source_uidx") || msg.includes("duplicate key")) {
        throw conflict(`Un QR code avec la source "${slug}" existe déjà`);
      }
      throw dbErr;
    }
  } catch (err) {
    return handleApiError(err, { route: "POST /api/qr-codes" });
  }
}
