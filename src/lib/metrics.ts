/**
 * Metrics business - pour piloter la boîte, pas seulement voir "l'app tourne".
 *
 * Requêtes SQL agrégées, résultats en cache 60s par process pour ne pas
 * marteler la DB si le dashboard admin est ouvert dans plusieurs onglets.
 *
 * Toutes les fonctions retournent des valeurs safe même si la table
 * n'existe pas encore (try/catch → 0), pour ne pas casser le premier boot.
 */

import { db } from "@/db";
import { sql } from "drizzle-orm";
import { logger } from "@/lib/logger";

const CACHE_TTL_MS = 60_000;

interface CacheEntry<T> {
  at: number;
  value: T;
}
const cache = new Map<string, CacheEntry<unknown>>();

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key) as CacheEntry<T> | undefined;
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.value;
  const value = await fn();
  cache.set(key, { at: now, value });
  return value;
}

/** Wrapper de sécurité : si la requête throw (table absente, DB down), retourne fallback.
 *  On ne type que ce dont on a besoin (rows) — évite d'importer QueryResult de pg. */
async function safe<T>(
  fn: () => Promise<{ rows: T[] }>,
  fallback: { rows: T[] },
  label: string
): Promise<{ rows: T[] }> {
  try {
    return await fn();
  } catch (err) {
    logger.warn(`[metrics] ${label} failed`, {
      err: err instanceof Error ? err.message : String(err),
    });
    return fallback;
  }
}

export interface BusinessMetrics {
  users: {
    total: number;
    newLast7d: number;
    newLast30d: number;
    verified: number;
  };
  subscriptions: {
    free: number;
    pro: number;
    premium: number;
    trialing: number;
    pastDue: number;
    canceledLast30d: number;
    mrrEurCents: number;
  };
  appointments: {
    total: number;
    last7d: number;
    last30d: number;
    upcoming: number;
  };
  businesses: {
    total: number;
    activeLast30d: number;
  };
  ai: {
    totalCallsLast30d: number;
    /** Coût cumulé en USD sur 30 jours (source : ai_usage.estimated_cost_usd). */
    totalCostUsd: number;
  };
  computedAt: string;
}

/**
 * Calcule toutes les metrics en 1 appel. Cache 60s.
 * On fait des requêtes SQL brutes pour éviter d'inventer un typage Drizzle
 * qui ne servirait qu'ici (ces agrégats ne sont pas réutilisés ailleurs).
 */
export async function getBusinessMetrics(): Promise<BusinessMetrics> {
  return cached("business-metrics", async () => {
    const [
      usersRow,
      subsRow,
      apptsRow,
      bizRow,
      aiRow,
      canceledRow,
    ] = await Promise.all([
      safe(
        () => db.execute<{
          total: string;
          new_7d: string;
          new_30d: string;
          verified: string;
        }>(sql`
          SELECT
            COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::text AS new_7d,
            COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::text AS new_30d,
            COUNT(*) FILTER (WHERE email_verified = true)::text AS verified
          FROM users
        `),
        { rows: [{ total: "0", new_7d: "0", new_30d: "0", verified: "0" }] },
        "users"
      ),
      safe(
        () => db.execute<{
          free: string;
          pro: string;
          premium: string;
          trialing: string;
          past_due: string;
        }>(sql`
          SELECT
            COUNT(*) FILTER (WHERE subscription = 'free')::text AS free,
            COUNT(*) FILTER (WHERE subscription = 'pro')::text AS pro,
            COUNT(*) FILTER (WHERE subscription = 'premium')::text AS premium,
            COUNT(*) FILTER (WHERE subscription_status = 'trialing')::text AS trialing,
            COUNT(*) FILTER (WHERE subscription_status = 'past_due')::text AS past_due
          FROM users
        `),
        {
          rows: [
            { free: "0", pro: "0", premium: "0", trialing: "0", past_due: "0" },
          ],
        },
        "subscriptions"
      ),
      safe(
        () => db.execute<{
          total: string;
          last_7d: string;
          last_30d: string;
          upcoming: string;
        }>(sql`
          SELECT
            COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::text AS last_7d,
            COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::text AS last_30d,
            COUNT(*) FILTER (WHERE (date || ' ' || start_time)::timestamp >= NOW() AND status NOT IN ('cancelled','no_show'))::text AS upcoming
          FROM appointments
        `),
        {
          rows: [{ total: "0", last_7d: "0", last_30d: "0", upcoming: "0" }],
        },
        "appointments"
      ),
      safe(
        () => db.execute<{ total: string; active_30d: string }>(sql`
          SELECT
            COUNT(*)::text AS total,
            COUNT(DISTINCT b.id) FILTER (WHERE a.created_at >= NOW() - INTERVAL '30 days')::text AS active_30d
          FROM businesses b
          LEFT JOIN appointments a ON a.business_id = b.id
        `),
        { rows: [{ total: "0", active_30d: "0" }] },
        "businesses"
      ),
      safe(
        () => db.execute<{ calls: string; cost_usd: string }>(sql`
          SELECT
            COUNT(*)::text AS calls,
            COALESCE(SUM(estimated_cost_usd), 0)::text AS cost_usd
          FROM ai_usage
          WHERE created_at >= NOW() - INTERVAL '30 days'
        `),
        { rows: [{ calls: "0", cost_usd: "0" }] },
        "ai"
      ),
      safe(
        () => db.execute<{ canceled: string }>(sql`
          SELECT COUNT(*)::text AS canceled
          FROM users
          WHERE subscription_status = 'canceled'
            AND updated_at >= NOW() - INTERVAL '30 days'
        `),
        { rows: [{ canceled: "0" }] },
        "canceled"
      ),
    ]);

    const u = usersRow.rows[0];
    const s = subsRow.rows[0];
    const a = apptsRow.rows[0];
    const b = bizRow.rows[0];
    const ai = aiRow.rows[0];
    const c = canceledRow.rows[0];

    // MRR estimé (source unique : plans.ts). Import dynamique pour éviter
    // les dépendances circulaires côté build.
    const { PLANS } = await import("@/lib/plans");
    // Prix en euros dans PLANS → on convertit en cents pour le stockage/agrégation
    const proCents = Math.round((PLANS.pro?.monthlyPrice ?? 0) * 100);
    const premiumCents = Math.round((PLANS.premium?.monthlyPrice ?? 0) * 100);
    const mrrEurCents =
      Number(s.pro) * proCents + Number(s.premium) * premiumCents;

    return {
      users: {
        total: Number(u.total),
        newLast7d: Number(u.new_7d),
        newLast30d: Number(u.new_30d),
        verified: Number(u.verified),
      },
      subscriptions: {
        free: Number(s.free),
        pro: Number(s.pro),
        premium: Number(s.premium),
        trialing: Number(s.trialing),
        pastDue: Number(s.past_due),
        canceledLast30d: Number(c.canceled),
        mrrEurCents,
      },
      appointments: {
        total: Number(a.total),
        last7d: Number(a.last_7d),
        last30d: Number(a.last_30d),
        upcoming: Number(a.upcoming),
      },
      businesses: {
        total: Number(b.total),
        activeLast30d: Number(b.active_30d),
      },
      ai: {
        totalCallsLast30d: Number(ai.calls),
        totalCostUsd: Number(ai.cost_usd),
      },
      computedAt: new Date().toISOString(),
    };
  });
}

/**
 * Taux de conversion register → premier abonnement payant sur 30j.
 * Retourne un ratio [0..1].
 */
export async function getConversionRate30d(): Promise<{ ratio: number; registered: number; paid: number }> {
  return cached("conversion-30d", async () => {
    const row = await safe(
      () => db.execute<{ registered: string; paid: string }>(sql`
        SELECT
          COUNT(*)::text AS registered,
          COUNT(*) FILTER (WHERE subscription IN ('pro','premium'))::text AS paid
        FROM users
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `),
      { rows: [{ registered: "0", paid: "0" }] },
      "conversion"
    );
    const registered = Number(row.rows[0].registered);
    const paid = Number(row.rows[0].paid);
    return {
      ratio: registered > 0 ? paid / registered : 0,
      registered,
      paid,
    };
  });
}

export function __resetMetricsCache(): void {
  cache.clear();
}

// Export cost utility pour affichage
export function formatEurCents(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
  });
}
