/**
 * Lot 53 (F15) — Digest email hebdomadaire (anti-churn).
 *
 * Design :
 *  - `computeDigestSegment(stats)` : catégorise le user en 4 segments selon
 *    son activité de la semaine (POWER / ACTIVE / QUIET / DORMANT).
 *  - `computeActionItems(context)` : liste des trucs "à faire" cliquables
 *    (devis non signés > 3j, avis 1-2 étoiles non répondus, RDV demain à confirmer).
 *  - `buildDigestHtml(payload)` : template HTML responsive/dark-mode-friendly
 *    avec preheader + CTA hero + section stats + section actions + footer opt-out.
 *
 * Le cron `/api/cron/weekly-summary` orchestre : charge users → pour chacun
 * appelle ces helpers → send email → update `weekly_digest_sent_at`.
 *
 * TOUS les helpers sont PURES fonctions — 0 accès DB, 100% testable unitaire.
 */

// -----------------------------------------------------------------------------
// Segment utilisateur — priorise le contenu email selon l'activité
// -----------------------------------------------------------------------------

export type DigestSegment = "power" | "active" | "quiet" | "dormant";

export interface WeekStats {
  visitors: number;
  appointments: number;
  quotes: number;
  reviews: number;
  revenueEur: number;
  /** Nb de semaines consécutives sans activité (calculé côté cron via dernier login) */
  weeksSinceActivity: number;
}

/**
 * Range le user en 4 segments — sert à choisir le TON du digest.
 *
 * Seuils calibrés pour matcher la réalité artisan FR (10-30 RDV/semaine = actif).
 * On PRIORISE `weeksSinceActivity` : un user très inactif = dormant même
 * si sa vitrine a reçu qqes visites organiques.
 */
export function computeDigestSegment(stats: WeekStats): DigestSegment {
  // Dormant en priorité : 3+ semaines sans login = urgence relance
  if (stats.weeksSinceActivity >= 3) return "dormant";

  // Power user : 10+ RDV/semaine OU revenus > 1000€
  if (stats.appointments >= 10 || stats.revenueEur >= 1000) return "power";

  // Active : activité normale (1-9 RDV OU 1+ devis OU 5+ visites)
  if (stats.appointments >= 1 || stats.quotes >= 1 || stats.visitors >= 5) return "active";

  // Quiet : peu d'activité mais pas dormant (< 3 semaines silence)
  return "quiet";
}

// -----------------------------------------------------------------------------
// Action items — 3 catégories de "trucs à faire" cliquables
// -----------------------------------------------------------------------------

export interface ActionItemsInput {
  /** Devis envoyés > 3j sans réponse client (attente signature) */
  quotesAwaitingSignature: number;
  /** Reviews 1-2 étoiles non répondues (urgence réputation) */
  negativeReviewsUnreplied: number;
  /** RDV demain — à confirmer via SMS/appel (préventif no-show) */
  appointmentsTomorrow: number;
  /** Factures impayées > 15j */
  invoicesOverdue: number;
}

export interface ActionItem {
  label: string;
  count: number;
  url: string;
  priority: "high" | "medium" | "low";
}

/**
 * Génère la liste des actions à faire, triées par priorité décroissante.
 * Retourne uniquement les items avec count > 0 (pas de "0 devis à signer" inutile).
 */
export function computeActionItems(input: ActionItemsInput): ActionItem[] {
  const items: ActionItem[] = [];

  // Priorité HAUTE : réputation en jeu ou cash-flow bloqué
  if (input.negativeReviewsUnreplied > 0) {
    items.push({
      label: `Répondre à ${input.negativeReviewsUnreplied} avis négatif${input.negativeReviewsUnreplied > 1 ? "s" : ""}`,
      count: input.negativeReviewsUnreplied,
      url: "/dashboard/reviews",
      priority: "high",
    });
  }
  if (input.invoicesOverdue > 0) {
    items.push({
      label: `Relancer ${input.invoicesOverdue} facture${input.invoicesOverdue > 1 ? "s" : ""} en retard`,
      count: input.invoicesOverdue,
      url: "/dashboard/invoices?status=issued",
      priority: "high",
    });
  }

  // Priorité MOYENNE : conversion à débloquer
  if (input.quotesAwaitingSignature > 0) {
    items.push({
      label: `Relancer ${input.quotesAwaitingSignature} devis en attente de signature`,
      count: input.quotesAwaitingSignature,
      url: "/dashboard/quotes",
      priority: "medium",
    });
  }

  // Priorité BASSE : préventif
  if (input.appointmentsTomorrow > 0) {
    items.push({
      label: `Confirmer ${input.appointmentsTomorrow} RDV pour demain`,
      count: input.appointmentsTomorrow,
      url: "/dashboard/today",
      priority: "low",
    });
  }

  return items;
}

// -----------------------------------------------------------------------------
// Décision "faut-il envoyer" — évite le spam
// -----------------------------------------------------------------------------

export interface DigestSendDecision {
  send: boolean;
  reason:
    | "opted_out"
    | "sent_recently"
    | "quiet_no_actions"
    | "dormant_recent_relance"
    | "ok";
}

/**
 * Décide si le user doit recevoir le digest cette semaine.
 *
 * Règles :
 *  1. Opt-out explicite → jamais
 *  2. Digest envoyé il y a < 6 jours → skip (protection cron rejoué)
 *  3. Segment "quiet" ET zéro action item → skip (pas de spam pour rien dire)
 *  4. Segment "dormant" ET dernière relance réactivation < 30j → skip (double email)
 *  5. Sinon → envoi
 */
export function shouldSendDigest(input: {
  optIn: boolean;
  lastDigestSentAt: Date | null;
  lastReactivationSentAt: Date | null;
  segment: DigestSegment;
  actionItemsCount: number;
  now?: Date;
}): DigestSendDecision {
  if (!input.optIn) return { send: false, reason: "opted_out" };

  const now = input.now ?? new Date();

  // Anti-doublon : cron rejoué manuellement
  if (input.lastDigestSentAt) {
    const daysSince = (now.getTime() - input.lastDigestSentAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 6) return { send: false, reason: "sent_recently" };
  }

  // Segment quiet sans action → aucun contenu utile
  if (input.segment === "quiet" && input.actionItemsCount === 0) {
    return { send: false, reason: "quiet_no_actions" };
  }

  // Dormant avec relance réactivation récente → évite doublon
  if (input.segment === "dormant" && input.lastReactivationSentAt) {
    const daysSince =
      (now.getTime() - input.lastReactivationSentAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 30) return { send: false, reason: "dormant_recent_relance" };
  }

  return { send: true, reason: "ok" };
}

// -----------------------------------------------------------------------------
// Template HTML email
// -----------------------------------------------------------------------------

export interface DigestPayload {
  firstName: string;
  businessName: string;
  segment: DigestSegment;
  stats: WeekStats;
  actionItems: ActionItem[];
  appUrl: string;
  /** URL one-click d'opt-out (List-Unsubscribe RFC 8058) */
  unsubscribeUrl: string;
}

/**
 * Construit l'email HTML final.
 *
 * Design :
 *  - Preheader (masqué) pour l'aperçu Gmail/iOS
 *  - Header adaptatif selon segment (ton du sujet + intro)
 *  - Grid stats (4 KPI cards)
 *  - Liste actions à faire (si présentes)
 *  - CTA hero vers dashboard
 *  - Footer avec lien opt-out visible (obligation légale)
 *  - Inline styles obligatoires (Gmail supprime les <style>)
 *  - Dark-mode via meta color-scheme (support récent iOS + Apple Mail)
 */
export function buildDigestHtml(payload: DigestPayload): string {
  const {
    firstName,
    businessName,
    segment,
    stats,
    actionItems,
    appUrl,
    unsubscribeUrl,
  } = payload;

  const preheader = buildPreheaderText(segment, stats);
  const greeting = firstName ? `Bonjour ${firstName},` : "Bonjour,";
  const segmentIntro = buildSegmentIntro(segment, businessName, stats);

  // Escape défensif : le business name peut contenir des < ou "
  const safeBiz = escapeHtml(businessName);

  const actionItemsHtml =
    actionItems.length > 0
      ? `
    <div style="margin: 32px 0;">
      <p style="margin: 0 0 12px; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">À faire cette semaine</p>
      ${actionItems.map((a) => renderActionItem(a, appUrl)).join("\n")}
    </div>`
      : "";

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Récap Vitrix</title>
</head>
<body style="margin: 0; padding: 0; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a;">
  <!-- Preheader masqué : premier texte lu par Gmail/iOS dans l'aperçu -->
  <div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #f8fafc;">
    ${escapeHtml(preheader)}
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f8fafc; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width: 560px; width: 100%; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
          <!-- HEADER -->
          <tr>
            <td style="padding: 28px 28px 8px;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600;">
                Récap de la semaine
              </p>
              <h1 style="margin: 6px 0 4px; font-size: 22px; color: #0f172a; line-height: 1.3;">
                ${greeting}
              </h1>
              <p style="margin: 0; font-size: 15px; color: #475569; line-height: 1.5;">
                ${segmentIntro}
              </p>
            </td>
          </tr>

          <!-- STATS GRID 2x2 (2 lignes pour mobile-friendly) -->
          <tr>
            <td style="padding: 20px 28px 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  ${renderStatCell("👀", "Visites vitrine", String(stats.visitors))}
                  ${renderStatCell("📅", "Nouveaux RDV", String(stats.appointments))}
                </tr>
                <tr>
                  ${renderStatCell("📋", "Nouveaux devis", String(stats.quotes))}
                  ${renderStatCell("💰", "Encaissé", `${stats.revenueEur.toFixed(0)} €`)}
                </tr>
              </table>
            </td>
          </tr>

          ${actionItemsHtml ? `<tr><td style="padding: 0 28px;">${actionItemsHtml}</td></tr>` : ""}

          <!-- CTA HERO -->
          <tr>
            <td style="padding: 8px 28px 28px;" align="center">
              <a href="${escapeHtml(appUrl)}/dashboard" style="display: inline-block; background: #0f172a; color: #ffffff; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-size: 15px; font-weight: 600;">
                Ouvrir mon tableau de bord
              </a>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding: 20px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 6px; font-size: 12px; color: #64748b; text-align: center;">
                ${safeBiz} · Vitrix
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8; text-align: center;">
                <a href="${escapeHtml(unsubscribeUrl)}" style="color: #94a3b8; text-decoration: underline;">Se désabonner de ce résumé</a>
                &nbsp;·&nbsp;
                <a href="${escapeHtml(appUrl)}/dashboard/settings" style="color: #94a3b8; text-decoration: underline;">Mes préférences</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Sujet email — adapté au segment pour maximiser open-rate.
 * Segments high-signal ("power") ont un sujet avec chiffres → curiosité.
 * Segments faibles ("dormant") ont un sujet plus doux → pas de guilt-trip.
 */
export function buildDigestSubject(
  segment: DigestSegment,
  stats: WeekStats,
  businessName: string
): string {
  const safeBiz = businessName.slice(0, 40); // évite les sujets à rallonge coupés
  switch (segment) {
    case "power":
      return `🚀 Belle semaine : ${stats.appointments} RDV, ${stats.revenueEur.toFixed(0)} € encaissés`;
    case "active":
      return `📊 Votre semaine chez ${safeBiz} — ${stats.visitors} visites, ${stats.appointments} RDV`;
    case "quiet":
      return `📌 Un point rapide sur votre semaine — ${safeBiz}`;
    case "dormant":
      return `👋 On ne vous voit plus, tout va bien ?`;
  }
}

// -----------------------------------------------------------------------------
// Helpers privés — template
// -----------------------------------------------------------------------------

function buildPreheaderText(segment: DigestSegment, stats: WeekStats): string {
  switch (segment) {
    case "power":
      return `Records de la semaine : ${stats.appointments} RDV et ${stats.revenueEur.toFixed(0)} € encaissés.`;
    case "active":
      return `${stats.visitors} visites, ${stats.appointments} RDV et ${stats.quotes} devis cette semaine.`;
    case "quiet":
      return `Petit récap et actions à envisager pour redynamiser votre activité.`;
    case "dormant":
      return `Cela fait un moment que vous n'êtes pas venu — quelques nouveautés à découvrir.`;
  }
}

function buildSegmentIntro(
  segment: DigestSegment,
  businessName: string,
  stats: WeekStats
): string {
  const safeBiz = escapeHtml(businessName);
  switch (segment) {
    case "power":
      return `Belle semaine chez <strong>${safeBiz}</strong> ! ${stats.appointments} RDV et ${stats.revenueEur.toFixed(0)} € encaissés, continuez comme ça.`;
    case "active":
      return `Voici l'activité de <strong>${safeBiz}</strong> ces 7 derniers jours.`;
    case "quiet":
      return `Semaine plus calme chez <strong>${safeBiz}</strong>. Quelques idées pour relancer la machine ci-dessous.`;
    case "dormant":
      return `Cela fait plusieurs semaines que vous n'êtes pas connecté à Vitrix. Voici un rapide point.`;
  }
}

function renderStatCell(icon: string, label: string, value: string): string {
  return `
    <td width="50%" style="padding: 8px;">
      <div style="background: #f8fafc; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0;">
        <p style="margin: 0 0 4px; font-size: 20px;">${icon}</p>
        <p style="margin: 0 0 2px; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">${escapeHtml(label)}</p>
        <p style="margin: 0; font-size: 22px; font-weight: 700; color: #0f172a;">${escapeHtml(value)}</p>
      </div>
    </td>`;
}

function renderActionItem(item: ActionItem, appUrl: string): string {
  const dotColor =
    item.priority === "high" ? "#ef4444" : item.priority === "medium" ? "#f59e0b" : "#64748b";
  return `
    <a href="${escapeHtml(appUrl)}${escapeHtml(item.url)}" style="display: block; text-decoration: none; padding: 12px 14px; margin: 6px 0; background: #f8fafc; border-radius: 10px; border-left: 3px solid ${dotColor}; color: #0f172a;">
      <span style="font-size: 14px; font-weight: 500;">${escapeHtml(item.label)}</span>
      <span style="float: right; color: #94a3b8; font-size: 14px;">›</span>
    </a>`;
}

/**
 * Escape HTML basique — évite XSS via nom de business qui contient <script>.
 * Suffisant ici car on ne rend PAS du markdown ou du user input libre.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
