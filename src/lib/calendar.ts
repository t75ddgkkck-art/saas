// Service Google Calendar - Synchronisation des RDV
// Nécessite GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
import { logger } from "@/lib/logger";

interface CalendarEvent {
  summary: string;
  description: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location?: string;
}

export async function createCalendarEvent(event: CalendarEvent) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    logger.warn("calendar.simulated", { summary: event.summary, reason: "Google not configured" });
    return { success: true, simulated: true, eventId: `sim_${Date.now()}` };
  }

  try {
    // 1. Obtenir un access token via le refresh token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      throw new Error("Impossible d'obtenir un access token Google");
    }

    // 2. Créer l'événement
    const calendarId = "primary";
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...event,
          reminders: {
            useDefault: false,
            overrides: [
              { method: "email", minutes: 60 },
              { method: "popup", minutes: 30 },
            ],
          },
        }),
      }
    );

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error?.message || "Erreur Google Calendar");
    }

    return { success: true, eventId: result.id, htmlLink: result.htmlLink };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("calendar.create_failed", { message });
    return { success: false, error: message };
  }
}

export function formatGoogleDateTime(date: string, time: string): string {
  // date: YYYY-MM-DD, time: HH:MM
  return `${date}T${time}:00`;
}
