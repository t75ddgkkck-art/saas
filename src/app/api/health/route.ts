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
    detail: enabled ? "Sentry actif" : "SENTRY_DSN non défini (fallback logs uniquement)",
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

// Lot 39 : checks additionnels pour toutes les intégrations optionnelles.
// Chacune renvoie ok=true si CONFIGURÉE, ok=false sinon (jamais critical).
// Le but est de fournir à un uptime-checker externe (Better Stack, Uptime Kuma)
// un JSON exhaustif du statut de chaque intégration.

function checkTurnstile(): Check {
  const hasKey = Boolean(process.env.TURNSTILE_SECRET_KEY);
  const hasSite = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  return {
    name: "turnstile",
    ok: hasKey && hasSite,
    critical: false,
    detail: hasKey && hasSite ? "captcha actif" : "captcha désactivé (login sans protection)",
  };
}

function checkVapid(): Check {
  const has =
    Boolean(process.env.VAPID_PUBLIC_KEY) &&
    Boolean(process.env.VAPID_PRIVATE_KEY) &&
    Boolean(process.env.VAPID_SUBJECT);
  return {
    name: "vapid_push",
    ok: has,
    critical: false,
    detail: has ? "push OS actives" : "VAPID keys manquantes (push OS silencieusement désactivées)",
  };
}

function checkGoogle(): Check {
  const has = Boolean(process.env.GOOGLE_CLIENT_ID) && Boolean(process.env.GOOGLE_CLIENT_SECRET);
  return {
    name: "google_oauth",
    ok: has,
    critical: false,
    detail: has
      ? "Google Calendar + Business Profile disponibles"
      : "GOOGLE_CLIENT_ID/SECRET manquants (sync Google désactivée)",
  };
}

function checkSupabaseStorage(): Check {
  const has =
    Boolean(process.env.SUPABASE_URL) &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) &&
    Boolean(process.env.SUPABASE_STORAGE_BUCKET);
  return {
    name: "supabase_storage",
    ok: has,
    critical: false,
    detail: has ? "uploads OK" : "Supabase Storage non configuré (uploads en erreur)",
  };
}

function checkTwilio(): Check {
  const has =
    Boolean(process.env.TWILIO_ACCOUNT_SID) &&
    Boolean(process.env.TWILIO_AUTH_TOKEN) &&
    Boolean(process.env.TWILIO_PHONE_NUMBER);
  return {
    name: "twilio_sms",
    ok: has,
    critical: false,
    detail: has ? "SMS + WhatsApp actifs" : "Twilio non configuré (rappels SMS/WA désactivés)",
  };
}

function checkCronSecret(): Check {
  const secret = process.env.CRON_SECRET;
  const ok = Boolean(secret) && secret!.length >= 16;
  return {
    name: "cron_secret",
    ok,
    critical: true, // les crons échouent tous en 401 sinon
    detail: ok
      ? undefined
      : "CRON_SECRET manquant ou trop court (< 16 chars) → tous les crons Vercel retournent 401",
  };
}

function checkAppUrl(): Check {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  const ok = Boolean(url) && /^https?:\/\/[^\s/]+$/.test(url ?? "");
  return {
    name: "app_url",
    ok,
    critical: true,
    detail: ok ? undefined : "NEXT_PUBLIC_APP_URL manquant ou invalide (emails et OAuth cassés)",
  };
}

export async function GET() {
  // Lot 39 : 12 checks exhaustifs. Seul la DB est vraiment I/O.
  // Le reste = simple présence env var (pas d'API call → pas de coût ni rate limit).
  const dbCheck = await checkDb();
  const checks: Check[] = [
    dbCheck,
    checkAppUrl(),
    checkCronSecret(),
    checkStripe(),
    checkResend(),
    checkOpenAI(),
    checkVapid(),
    checkTurnstile(),
    checkGoogle(),
    checkSupabaseStorage(),
    checkTwilio(),
    checkMonitoring(),
    checkAlerts(),
  ];

  const criticalDown = checks.filter((c) => c.critical && !c.ok);
  const ok = criticalDown.length === 0;

  // Compteurs synthétiques (utile pour dashboards uptime : "N intégrations actives")
  const activeCount = checks.filter((c) => c.ok).length;
  const totalCount = checks.length;
  const criticalCount = checks.filter((c) => c.critical).length;

  return NextResponse.json(
    {
      ok,
      summary: {
        active: activeCount,
        total: totalCount,
        critical_ok: checks.filter((c) => c.critical && c.ok).length,
        critical_total: criticalCount,
      },
      checks,
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev",
      env: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
      timestamp: new Date().toISOString(),
    },
    {
      status: ok ? 200 : 503,
      headers: {
        // Cache très court côté CDN (uptime-checkers polling toutes les 30-60s)
        "Cache-Control": "public, max-age=10, s-maxage=10",
      },
    }
  );
}
