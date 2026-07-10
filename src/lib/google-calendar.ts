/**
 * F4 (Lot 33) — Client Google Calendar léger (0 dep — fetch direct API v3).
 *
 * Objectif : push CREATE / UPDATE / DELETE d'events depuis Vitrix vers
 * le calendrier Google du pro. Utilise le refresh_token stocké dans
 * `calendar_tokens` pour obtenir un access_token à la volée (TTL 1h).
 *
 * On NE pull PAS Google → Vitrix en v1 (évite les conflits de sync).
 * v2 : cron 5 min qui poll `events.list?updatedMin=<lastSyncAt>` + résolution
 * de conflits (dernier écrit gagne).
 *
 * Toutes les fonctions sont "best effort" : si Google refuse (token révoqué,
 * quota, etc.), on log et on return sans throw — la sync ne doit JAMAIS
 * casser le flow métier (créer un RDV côté Vitrix reste OK même si push
 * Google échoue).
 */

import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { calendarTokens } from "@/db/schema";
import { logger } from "@/lib/logger";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";
// Marge de sécurité : on renouvelle 5 min avant l'expiration
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

// -----------------------------------------------------------------------------
// Config helpers
// -----------------------------------------------------------------------------

export function isGoogleCalendarConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

// -----------------------------------------------------------------------------
// Récupération d'un access_token valide (refresh si nécessaire)
// -----------------------------------------------------------------------------

interface AccessTokenResult {
  accessToken: string;
  calendarId: string;
}

async function getFreshAccessToken(businessId: string): Promise<AccessTokenResult | null> {
  if (!isGoogleCalendarConfigured()) return null;

  const [token] = await db
    .select()
    .from(calendarTokens)
    .where(and(eq(calendarTokens.businessId, businessId), eq(calendarTokens.provider, "google")))
    .limit(1);

  if (!token) return null;

  const now = Date.now();
  const stillValid =
    token.accessToken &&
    token.accessTokenExpiresAt &&
    token.accessTokenExpiresAt.getTime() > now + REFRESH_MARGIN_MS;

  if (stillValid && token.accessToken) {
    return { accessToken: token.accessToken, calendarId: token.calendarId };
  }

  // Refresh via refresh_token
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: token.refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const data = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
    };
    if (!data.access_token) {
      logger.warn("google-calendar.refresh_failed", { businessId, error: data.error });
      return null;
    }
    const expiresAt = new Date(now + (data.expires_in ?? 3600) * 1000);
    await db
      .update(calendarTokens)
      .set({
        accessToken: data.access_token,
        accessTokenExpiresAt: expiresAt,
      })
      .where(eq(calendarTokens.businessId, businessId));

    return { accessToken: data.access_token, calendarId: token.calendarId };
  } catch (err) {
    logger.error("google-calendar.refresh_error", {
      businessId,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// -----------------------------------------------------------------------------
// Type Event (aligné sur Google Calendar API v3)
// -----------------------------------------------------------------------------

export interface GoogleEventInput {
  summary: string;
  description?: string;
  location?: string;
  /** Date début en ISO 8601 avec timezone (ex: `2026-08-15T09:00:00+02:00`). */
  start: string;
  /** Date fin en ISO 8601. */
  end: string;
  timeZone?: string;
  /** Attendees (email uniquement, pas d'invitation Google par défaut). */
  attendees?: { email: string }[];
}

function buildEventBody(event: GoogleEventInput): Record<string, unknown> {
  return {
    summary: event.summary,
    description: event.description,
    location: event.location,
    start: {
      dateTime: event.start,
      timeZone: event.timeZone ?? "Europe/Paris",
    },
    end: {
      dateTime: event.end,
      timeZone: event.timeZone ?? "Europe/Paris",
    },
    attendees: event.attendees,
  };
}

// -----------------------------------------------------------------------------
// CRUD events (best effort — jamais de throw)
// -----------------------------------------------------------------------------

/**
 * Crée un event Google. Retourne l'ID Google si succès, null sinon.
 * L'appelant devrait stocker cet ID dans `appointments.googleCalendarId`
 * pour permettre les updates ultérieurs.
 */
export async function pushCreateGoogleEvent(
  businessId: string,
  event: GoogleEventInput
): Promise<string | null> {
  const token = await getFreshAccessToken(businessId);
  if (!token) return null;

  try {
    const res = await fetch(
      `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(token.calendarId)}/events?sendUpdates=none`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildEventBody(event)),
      }
    );
    if (!res.ok) {
      logger.warn("google-calendar.create_failed", { businessId, status: res.status });
      return null;
    }
    const data = (await res.json()) as { id?: string };
    return data.id ?? null;
  } catch (err) {
    logger.error("google-calendar.create_error", {
      businessId,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Met à jour un event existant. Silencieusement no-op si eventId inconnu.
 */
export async function pushUpdateGoogleEvent(
  businessId: string,
  eventId: string,
  event: GoogleEventInput
): Promise<boolean> {
  const token = await getFreshAccessToken(businessId);
  if (!token) return false;

  try {
    const res = await fetch(
      `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(token.calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildEventBody(event)),
      }
    );
    return res.ok;
  } catch (err) {
    logger.error("google-calendar.update_error", {
      businessId,
      eventId,
      err: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Supprime un event. No-op si eventId inconnu ou déjà supprimé.
 */
export async function pushDeleteGoogleEvent(businessId: string, eventId: string): Promise<boolean> {
  const token = await getFreshAccessToken(businessId);
  if (!token) return false;

  try {
    const res = await fetch(
      `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(token.calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token.accessToken}` },
      }
    );
    // 410 Gone = déjà supprimé, on considère succès
    return res.ok || res.status === 410;
  } catch (err) {
    logger.error("google-calendar.delete_error", {
      businessId,
      eventId,
      err: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

// -----------------------------------------------------------------------------
// URL OAuth pour connecter le calendrier
// -----------------------------------------------------------------------------

/**
 * URL de consentement Google pour scope calendar.events.
 * Le pro clique → Google → callback POST `/api/google/calendar/callback`.
 */
export function buildGoogleCalendarAuthUrl(state: string): string | null {
  if (!isGoogleCalendarConfigured()) return null;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const redirectUri = `${appUrl}/api/google/calendar/callback`;
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    // Scope minimum pour créer/modifier des events sur le calendrier primary
    scope: "https://www.googleapis.com/auth/calendar.events",
    access_type: "offline", // force refresh_token
    prompt: "consent", // force re-consent pour toujours obtenir refresh_token
    state, // CSRF + businessId round-trip
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Renvoie true si le business a une connexion Google Calendar active.
 */
export async function hasGoogleCalendarConnection(businessId: string): Promise<boolean> {
  const [row] = await db
    .select({ businessId: calendarTokens.businessId })
    .from(calendarTokens)
    .where(and(eq(calendarTokens.businessId, businessId), eq(calendarTokens.provider, "google")))
    .limit(1);
  return Boolean(row);
}

/**
 * Déconnecte Google Calendar (supprime le token, ne révoque pas côté Google).
 */
export async function disconnectGoogleCalendar(businessId: string): Promise<void> {
  await db
    .delete(calendarTokens)
    .where(and(eq(calendarTokens.businessId, businessId), eq(calendarTokens.provider, "google")));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _unused = gt; // évite l'unused import warning
