/**
 * Webhooks sortants (Lot 16.4).
 *
 * Design :
 *  - Le code métier appelle `dispatchWebhook("appointment.created", businessId, payload)`
 *  - On récupère les endpoints du business abonnés à cet event (ou à tous)
 *  - Pour chaque endpoint : POST HTTP avec signature HMAC-SHA256 dans header X-Vitrix-Signature
 *  - Timeout 5s hard
 *  - En cas d'échec : increment failureCount, log delivery, disable si >5
 *  - Fire-and-forget : le dispatch ne bloque JAMAIS le code appelant
 *
 * Événements supportés :
 *  - `appointment.created`, `appointment.updated`, `appointment.cancelled`
 *  - `payment.received`
 *  - `quote.sent`, `quote.signed`
 *  - `review.received`
 *
 * Format du body :
 * ```json
 * {
 *   "event": "appointment.created",
 *   "id": "evt_...",
 *   "timestamp": "2026-07-10T...",
 *   "businessId": "uuid",
 *   "data": { ... }
 * }
 * ```
 */

import { createHmac, randomUUID } from "crypto";
import { db } from "@/db";
import { webhookEndpoints, webhookDeliveries } from "@/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { captureException } from "@/lib/monitoring";

export type WebhookEvent =
  | "appointment.created"
  | "appointment.updated"
  | "appointment.cancelled"
  | "payment.received"
  | "quote.sent"
  | "quote.signed"
  | "review.received";

export const ALL_WEBHOOK_EVENTS: WebhookEvent[] = [
  "appointment.created",
  "appointment.updated",
  "appointment.cancelled",
  "payment.received",
  "quote.sent",
  "quote.signed",
  "review.received",
];

const TIMEOUT_MS = 5000;
const MAX_FAILURES_BEFORE_DISABLE = 5;

/**
 * Signe le body via HMAC-SHA256. Format compatible Stripe :
 *   `t=<timestamp>,v1=<hex>`
 * Le receveur doit reproduire la signature et vérifier en temps constant.
 */
export function signWebhookBody(body: string, secret: string, timestampSec?: number): string {
  const ts = timestampSec ?? Math.floor(Date.now() / 1000);
  const payload = `${ts}.${body}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `t=${ts},v1=${sig}`;
}

/**
 * Génère un secret de signature (64 chars hex) pour un nouvel endpoint.
 * À montrer au user une seule fois à la création (comme les API keys).
 */
export function generateWebhookSecret(): string {
  // 32 bytes = 256 bits d'entropie
  return createHmac("sha256", randomUUID())
    .update(randomUUID())
    .digest("hex")
    .slice(0, 64);
}

/**
 * Dispatch un event vers TOUS les endpoints d'un business abonnés à cet event.
 * Fire-and-forget : ne throw jamais, ne bloque pas.
 */
export function dispatchWebhook(
  event: WebhookEvent,
  businessId: string,
  data: Record<string, unknown>
): void {
  // Volontairement pas d'await : le code appelant ne doit pas ralentir
  // à cause des webhooks user (dispatch = fire and forget).
  void deliverWebhooks(event, businessId, data).catch((err) => {
    captureException(err, {
      route: "webhooks-out/deliver",
      severity: "warning",
      extra: { event, businessId },
    });
  });
}

/** Interne : logique bloquante réelle. Testable directement. */
export async function deliverWebhooks(
  event: WebhookEvent,
  businessId: string,
  data: Record<string, unknown>
): Promise<void> {
  // On récupère les endpoints actifs abonnés à cet event.
  // events = [] signifie "tous" (comportement pratique pour Zapier).
  const endpoints = await db
    .select()
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.businessId, businessId), isNull(webhookEndpoints.disabledAt)));

  const matching = endpoints.filter(
    (e) => !e.events || e.events.length === 0 || e.events.includes(event)
  );
  if (matching.length === 0) return;

  const eventId = `evt_${randomUUID()}`;
  const timestamp = new Date().toISOString();
  const body = JSON.stringify({
    event,
    id: eventId,
    timestamp,
    businessId,
    data,
  });

  // On envoie en parallèle mais avec un timeout hard par endpoint.
  await Promise.all(matching.map((ep) => deliverOne(ep.id, ep.url, ep.signingSecret, event, body)));
}

/** Envoi effectif à UN endpoint, avec log en DB. */
async function deliverOne(
  endpointId: string,
  url: string,
  secret: string,
  event: string,
  body: string
): Promise<void> {
  const signature = signWebhookBody(body, secret);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let status: number | null = null;
  let responseBody = "";
  let success = false;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Vitrix-Webhooks/1.0",
        "X-Vitrix-Event": event,
        "X-Vitrix-Signature": signature,
      },
      body,
      signal: controller.signal,
    });
    status = res.status;
    responseBody = (await res.text()).slice(0, 500);
    success = res.ok;
  } catch (err) {
    responseBody = (err instanceof Error ? err.message : String(err)).slice(0, 500);
    success = false;
  } finally {
    clearTimeout(timer);
  }

  // Log de la tentative
  try {
    await db.insert(webhookDeliveries).values({
      endpointId,
      event,
      payload: JSON.parse(body),
      responseStatus: status,
      responseBody,
      success,
      attemptCount: 1,
      deliveredAt: success ? new Date() : null,
    });
  } catch (err) {
    logger.warn("[webhooks-out] failed to log delivery", {
      endpointId,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  // Reset ou increment du compteur d'échecs
  if (success) {
    if (status !== null) {
      await db
        .update(webhookEndpoints)
        .set({ failureCount: 0 })
        .where(eq(webhookEndpoints.id, endpointId));
    }
  } else {
    const [updated] = await db
      .update(webhookEndpoints)
      .set({ failureCount: sql`${webhookEndpoints.failureCount} + 1` })
      .where(eq(webhookEndpoints.id, endpointId))
      .returning({ failureCount: webhookEndpoints.failureCount });

    if (updated && updated.failureCount >= MAX_FAILURES_BEFORE_DISABLE) {
      await db
        .update(webhookEndpoints)
        .set({ disabledAt: new Date() })
        .where(eq(webhookEndpoints.id, endpointId));
      logger.warn("[webhooks-out] endpoint auto-disabled après échecs consécutifs", {
        endpointId,
        failureCount: updated.failureCount,
      });
    }
  }
}
