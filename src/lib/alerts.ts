/**
 * Système d'alerting via webhook générique (Slack / Discord / MS Teams / Mattermost / custom).
 *
 * Config env :
 * - `ALERT_WEBHOOK_URL` : URL du webhook (incoming webhook Slack, ou Discord/…)
 * - `ALERT_WEBHOOK_TYPE` : "slack" (défaut) | "discord" | "generic"
 * - `ALERT_MIN_LEVEL` : "warning" | "error" | "critical" (défaut "error")
 *
 * Anti-spam : throttle par clé (title + route) → 1 alerte / 5 min max.
 *
 * Design non-bloquant :
 * - `fetch` en fire-and-forget avec timeout 3s
 * - Aucun throw ne remonte
 * - Fonctionne côté Node runtime uniquement (webhook = I/O)
 */

import { logger } from "@/lib/logger";

type Level = "info" | "warning" | "error" | "critical";

const LEVEL_ORDER: Record<Level, number> = {
  info: 10,
  warning: 20,
  error: 30,
  critical: 40,
};

const COLOR = {
  info: 0x3b82f6, // blue-500
  warning: 0xf59e0b, // amber-500
  error: 0xef4444, // red-500
  critical: 0xdc2626, // red-600
} as const;

const EMOJI = {
  info: "ℹ️",
  warning: "⚠️",
  error: "🚨",
  critical: "🔥",
} as const;

// Throttle simple en mémoire (par instance). Suffit pour dédupliquer les
// bursts sur un même serverless invoc. Pour du multi-instance, il faudrait
// un Redis, mais Sentry a déjà son propre dedupe côté récepteur.
const THROTTLE_WINDOW_MS = 5 * 60 * 1000;
const throttleMap = new Map<string, number>();

function shouldThrottle(key: string): boolean {
  const now = Date.now();
  const last = throttleMap.get(key);
  if (last && now - last < THROTTLE_WINDOW_MS) return true;
  throttleMap.set(key, now);
  // GC opportuniste : purge tout ce qui a > 1h
  if (throttleMap.size > 500) {
    const cutoff = now - THROTTLE_WINDOW_MS * 12;
    for (const [k, v] of throttleMap.entries()) {
      if (v < cutoff) throttleMap.delete(k);
    }
  }
  return false;
}

export interface AlertOptions {
  title: string;
  level?: Level;
  route?: string;
  userId?: string;
  message?: string;
  extra?: Record<string, unknown>;
}

/**
 * Envoie une alerte vers le webhook configuré. Non-bloquant.
 * Retourne `true` si l'envoi a été tenté, `false` sinon (pas de config, throttlé, niveau trop bas).
 */
export async function sendAlert(opts: AlertOptions): Promise<boolean> {
  const level = opts.level ?? "error";
  const minLevel = (process.env.ALERT_MIN_LEVEL as Level) || "error";
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return false;

  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return false;

  // Clé d'anti-spam : niveau + titre + route (mais pas userId → évite N alertes
  // pour la même erreur touchant N users différents)
  const throttleKey = `${level}::${opts.title}::${opts.route ?? ""}`;
  if (shouldThrottle(throttleKey)) return false;

  const type = (process.env.ALERT_WEBHOOK_TYPE || "slack").toLowerCase();
  const payload = buildPayload(type, opts, level);

  try {
    // fetch avec timeout hard 3s (jamais bloquer une requête API sur un
    // webhook externe qui rame)
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).catch((err) => {
      logger.warn("[alerts] webhook fetch failed", { err: String(err) });
      return null;
    });
    clearTimeout(t);

    if (res && !res.ok) {
      logger.warn("[alerts] webhook non-2xx", { status: res.status });
    }
    return true;
  } catch (err) {
    logger.warn("[alerts] send failed", { err: String(err) });
    return false;
  }
}

/**
 * Construit le payload adapté au type de webhook.
 * Slack et Discord ont des schémas très différents pour du rendu joli.
 */
function buildPayload(type: string, opts: AlertOptions, level: Level): unknown {
  const emoji = EMOJI[level];
  const title = `${emoji} ${opts.title}`;
  const app = process.env.NEXT_PUBLIC_APP_NAME || "Vitrix";
  const env = process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown";

  const fields: Array<{ name: string; value: string }> = [
    { name: "env", value: env },
    { name: "app", value: app },
  ];
  if (opts.route) fields.push({ name: "route", value: opts.route });
  if (opts.userId) fields.push({ name: "userId", value: opts.userId });
  if (opts.message) fields.push({ name: "message", value: opts.message.slice(0, 500) });
  if (opts.extra) {
    fields.push({
      name: "extra",
      value: `\`\`\`\n${JSON.stringify(opts.extra, null, 2).slice(0, 800)}\n\`\`\``,
    });
  }

  if (type === "discord") {
    return {
      embeds: [
        {
          title,
          color: COLOR[level],
          timestamp: new Date().toISOString(),
          fields: fields.map((f) => ({ name: f.name, value: f.value, inline: f.name !== "extra" })),
        },
      ],
    };
  }

  if (type === "generic") {
    return {
      title,
      level,
      env,
      app,
      route: opts.route,
      userId: opts.userId,
      message: opts.message,
      extra: opts.extra,
      timestamp: new Date().toISOString(),
    };
  }

  // Slack (défaut) : Block Kit compact
  return {
    text: title,
    blocks: [
      { type: "header", text: { type: "plain_text", text: title } },
      {
        type: "section",
        fields: fields.map((f) => ({
          type: "mrkdwn",
          text: `*${f.name}*\n${f.value}`,
        })),
      },
    ],
  };
}

// Export interne pour tests
export function __resetAlertsThrottle(): void {
  throttleMap.clear();
}
