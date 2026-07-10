/**
 * Healthcheck étendu (Lot 13 monitoring).
 *
 * Vérifie :
 *  - DB : `SELECT 1` avec latence
 *  - Stripe : présence de la clé (pas d'appel API pour éviter les frais / rate limits)
 *  - Resend : présence de la clé + domaine configuré
 *  - Monitoring : Sentry actif ou non
 *  - Alerts : webhook configuré ou non
 *
 * Réponse :
 *  - 200 si tous les checks CRITIQUES passent (DB)
 *  - 503 sinon
 *
 * Format compatible uptime-kuma / better-uptime : `{ ok, checks: [...] }`.
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { isMonitoringEnabled } from "@/lib/monitoring";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Check {
  name: string;
  ok: boolean;
  critical: boolean;
  latencyMs?: number;
  detail?: string;
}

async function checkDb(): Promise<Check> {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return { name: "db", ok: true, critical: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      name: "db",
      ok: false,
      critical: true,
      latencyMs: Date.now() - start,
      detail: err instanceof Error ? err.message : "erreur inconnue",
    };
  }
}

function checkStripe(): Check {
  const hasKey = Boolean(process.env.STRIPE_SECRET_KEY);
  const hasWebhook = Boolean(process.env.STRIPE_WEBHOOK_SECRET);
  return {
    name: "stripe",
    ok: hasKey && hasWebhook,
    critical: false,
    detail: !hasKey
      ? "STRIPE_SECRET_KEY manquant"
      : !hasWebhook
        ? "STRIPE_WEBHOOK_SECRET manquant"
        : undefined,
  };
}

function checkResend(): Check {
  const hasKey = Boolean(process.env.RESEND_API_KEY);
  const hasFrom = Boolean(process.env.RESEND_FROM_EMAIL);
  return {
    name: "resend",
    ok: hasKey && hasFrom,
    critical: false,
    detail: !hasKey
      ? "RESEND_API_KEY manquant"
      : !hasFrom
        ? "RESEND_FROM_EMAIL manquant"
        : undefined,
  };
}

function checkMonitoring(): Check {
  const enabled = isMonitoringEnabled();
  return {
    name: "monitoring",
    ok: enabled,
    critical: false,
    detail: enabled
      ? "Sentry actif"
      : "SENTRY_DSN non défini (fallback logs uniquement)",
  };
}

function checkAlerts(): Check {
  const has = Boolean(process.env.ALERT_WEBHOOK_URL);
  return {
    name: "alerts",
    ok: has,
    critical: false,
    detail: has
      ? "webhook alerting configuré"
      : "ALERT_WEBHOOK_URL non défini (pas d'alerte externe)",
  };
}

function checkOpenAI(): Check {
  const has = Boolean(process.env.OPENAI_API_KEY);
  return {
    name: "openai",
    ok: has,
    critical: false,
    detail: has ? undefined : "OPENAI_API_KEY manquant (features IA désactivées)",
  };
}

export async function GET() {
  // On lance les checks en parallèle, seule la DB est vraiment I/O
  const [dbCheck, stripeCheck, resendCheck, openaiCheck, monitoringCheck, alertsCheck] =
    await Promise.all([
      checkDb(),
      Promise.resolve(checkStripe()),
      Promise.resolve(checkResend()),
      Promise.resolve(checkOpenAI()),
      Promise.resolve(checkMonitoring()),
      Promise.resolve(checkAlerts()),
    ]);

  const checks = [dbCheck, stripeCheck, resendCheck, openaiCheck, monitoringCheck, alertsCheck];
  const criticalDown = checks.filter((c) => c.critical && !c.ok);
  const ok = criticalDown.length === 0;

  return NextResponse.json(
    {
      ok,
      checks,
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev",
      env: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  );
}
