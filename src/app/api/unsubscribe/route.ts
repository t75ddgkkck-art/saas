/**
 * Endpoint unsubscribe RFC 8058 (one-click) + page HTML de confirmation.
 *
 * - GET  /api/unsubscribe?token=XYZ → page HTML "vous êtes bien désabonné"
 * - POST /api/unsubscribe?token=XYZ → one-click (Gmail/Yahoo appellent ça direct)
 *
 * Le token porte l'email + la catégorie signée HMAC : personne d'autre que
 * le destinataire du mail ne peut se désabonner d'un email dont il a le lien.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { emailOptouts } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";
import { logger } from "@/lib/logger";
import { handleApiError } from "@/lib/api-error";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  transactional: "confirmations (contractuelles, non désabonnables)",
  reminders: "rappels de rendez-vous et de devis",
  "review-request": "demandes d'avis",
  marketing: "newsletters et communications commerciales",
  // Lot 53 : catégorie dédiée pour l'opt-out du digest hebdomadaire
  "weekly-digest": "récap hebdomadaire d'activité",
  all: "tous les emails (sauf confirmations obligatoires)",
};

async function recordOptout(email: string, category: string, reason?: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  try {
    // Upsert : on ignore le doublon (index unique lower(email), category)
    await db
      .insert(emailOptouts)
      .values({
        email: normalized,
        category,
        reason: reason || null,
      })
      .onConflictDoNothing();
    logger.info("unsubscribe.recorded", { email: normalized, category });
  } catch (err) {
    logger.error("unsubscribe.record_failed", {
      email: normalized,
      category,
      message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

function renderPage(title: string, body: string): Response {
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${title} · Vitrix</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, system-ui, sans-serif; background: #f8fafc; margin: 0; padding: 40px 20px; color: #0f172a; }
  .card { max-width: 480px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 40px 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); text-align: center; }
  h1 { font-size: 22px; margin: 20px 0 8px; }
  p { color: #64748b; line-height: 1.6; margin: 8px 0; }
  .icon { width: 64px; height: 64px; border-radius: 50%; background: #dcfce7; display: inline-flex; align-items: center; justify-content: center; font-size: 32px; }
  .icon.error { background: #fef2f2; }
  .home { display: inline-block; margin-top: 24px; color: #0f172a; text-decoration: none; font-weight: 600; border: 1px solid #e2e8f0; padding: 10px 20px; border-radius: 10px; }
  .home:hover { background: #f8fafc; }
</style>
</head>
<body>
<main class="card">${body}<a class="home" href="https://www.vitrix.fr">Retour à l'accueil</a></main>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

async function handleUnsubscribe(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return renderPage(
      "Lien invalide",
      `<div class="icon error">⚠️</div>
       <h1>Lien invalide</h1>
       <p>Ce lien de désabonnement n'est pas valide ou a expiré.</p>`
    );
  }

  const verified = verifyUnsubscribeToken(token);
  if (!verified) {
    return renderPage(
      "Lien expiré",
      `<div class="icon error">⚠️</div>
       <h1>Lien expiré ou invalide</h1>
       <p>Ce lien a expiré (les liens de désabonnement sont valides 1 an) ou a été modifié.</p>
       <p>Contactez-nous à <a href="mailto:contact@vitrix.fr" style="color:#0f172a">contact@vitrix.fr</a> pour vous désabonner manuellement.</p>`
    );
  }

  const { email, category } = verified;

  // Refus explicite : catégorie "transactional" = obligation contractuelle
  if (category === "transactional") {
    return renderPage(
      "Impossible",
      `<div class="icon error">🚫</div>
       <h1>Désabonnement impossible</h1>
       <p>Les <strong>emails de confirmation</strong> (rendez-vous, devis) sont indispensables au bon fonctionnement du service et ne peuvent pas être désactivés.</p>
       <p>Vous pouvez en revanche vous désabonner des <strong>rappels</strong>, <strong>demandes d'avis</strong> ou <strong>communications marketing</strong> via un autre lien reçu.</p>`
    );
  }

  const labelHuman = CATEGORY_LABELS[category] || category;

  try {
    await recordOptout(email, category, "user_click");
  } catch (err) {
    return handleApiError(err, { route: "/api/unsubscribe" });
  }

  return renderPage(
    "Désabonné",
    `<div class="icon">✓</div>
     <h1>Vous êtes désabonné</h1>
     <p><strong>${escapeHtml(email)}</strong> ne recevra plus de <strong>${escapeHtml(labelHuman)}</strong>.</p>
     <p style="font-size:13px;color:#94a3b8;margin-top:20px;">Vous continuerez à recevoir les confirmations de rendez-vous et devis (obligation contractuelle).</p>`
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(request: NextRequest) {
  // Lot 64 : 30/min — protège contre spam de tokens fabriqués/brute-force
  // (le token est signé HMAC donc invalidé côté verifyUnsubscribeToken, mais
  // le rate-limit épargne le coût CPU HMAC + query DB par tentative).
  const rl = checkRateLimit(request, { key: "unsubscribe-get", limit: 30, windowSec: 60 });
  if (!rl.ok) return rl.response;
  return handleUnsubscribe(request);
}

// RFC 8058 one-click : Gmail/Yahoo POST au lieu de GET pour respecter la
// bonne pratique "ne pas exécuter d'action sur un GET" (mais ils lisent
// aussi le GET pour être compatibles avec les vieux serveurs).
export async function POST(request: NextRequest) {
  // Lot 64 : plus permissif pour POST (Gmail/Yahoo peuvent grouper des requests)
  const rl = checkRateLimit(request, { key: "unsubscribe-post", limit: 60, windowSec: 60 });
  if (!rl.ok) return rl.response;
  await handleUnsubscribe(request);
  // Réponse 200 vide suffit pour Gmail/Yahoo one-click.
  return new NextResponse(null, { status: 200 });
}
