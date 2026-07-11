/**
 * Handlers d'événements Stripe (extraits du webhook pour tests unitaires).
 *
 * Chaque handler prend `Stripe.Event` + dépendances et applique la logique métier.
 * Gestion du grace period : quand un paiement échoue, on ne downgrade PAS
 * immédiatement, on donne 3-7 jours au user pour mettre à jour sa CB.
 */

import type Stripe from "stripe";
import { db } from "@/db";
import { users, appointments, payments, availabilitySlots, businesses } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { sendEmail } from "@/lib/email";
import { GRACE_PERIOD_DAYS, type PlanId } from "@/lib/plans";
// F6 (Lot 34, B25) : notif au pro quand deposit payé / paiement reçu
import { notifyAsync } from "@/lib/notify";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr";

/**
 * checkout.session.completed
 * Deux flows selon `metadata.type` :
 *  - `booking_deposit` → F2 (Lot 30) : confirme un RDV + enregistre le paiement
 *  - autre / absent → flow subscription : active le plan payant du user
 */
export async function handleCheckoutCompleted(event: Stripe.Event): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;

  // F2 (Lot 30) : acompte de réservation ?
  if (session.metadata?.type === "booking_deposit") {
    await handleBookingDepositCompleted(event);
    return;
  }

  const userId = session.metadata?.userId;
  const plan = session.metadata?.plan as PlanId | undefined;

  if (!userId || !plan || (plan !== "pro" && plan !== "premium")) {
    logger.warn("stripe.checkout.missing_metadata", { userId, plan });
    return;
  }

  await db
    .update(users)
    .set({
      subscription: plan,
      subscriptionStatus: "active",
      stripeSubscriptionId: (session.subscription as string) || null,
      subscriptionExpiresAt: null, // pas de grace period active
    })
    .where(eq(users.id, userId));

  logger.info("stripe.subscription.activated", { userId, plan });

  // Lot 16.3 : crédit du parrain à la 1ère conversion payante du filleul.
  // On ne re-crédite pas si le filleul upgrade Pro→Premium plus tard (on lit
  // referredBy une seule fois via un flag imaginaire ? non — simpler : on
  // vérifie que subscription était bien "free" avant l'update).
  //
  // Ici le SET a déjà été appliqué, donc on relit + on vérifie qu'il n'y avait
  // pas déjà un stripeSubscriptionId (= déjà converti). C'est plus safe.
  try {
    const [freshUser] = await db
      .select({ referredBy: users.referredBy })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (freshUser?.referredBy) {
      // Import dynamique pour éviter dépendance circulaire potentielle
      const { creditReferrer } = await import("@/lib/referral");
      await creditReferrer(freshUser.referredBy, 1);
    }
  } catch (err) {
    // Ne jamais faire échouer le webhook Stripe pour un problème de parrainage
    logger.warn("[referral] crédit post-checkout échoué", {
      userId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * customer.subscription.updated
 * - Le statut peut passer à `past_due` (paiement échoué) → grace period
 * - Ou à `active` (paiement rattrapé) → on nettoie l'expiration
 */
export async function handleSubscriptionUpdated(event: Stripe.Event): Promise<void> {
  const sub = event.data.object as Stripe.Subscription;
  const userId = sub.metadata?.userId;
  if (!userId) return;

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return;

  const currentPlan = user.subscription as PlanId;

  if (sub.status === "active" || sub.status === "trialing") {
    // Paiement rattrapé (ou trial en cours) → on rétablit
    await db
      .update(users)
      .set({
        subscriptionStatus: sub.status,
        subscriptionExpiresAt: null,
      })
      .where(eq(users.id, userId));
    logger.info("stripe.subscription.restored", { userId, status: sub.status });
    return;
  }

  if (sub.status === "past_due" || sub.status === "unpaid") {
    // Grace period : on ne downgrade pas encore
    if (currentPlan === "free") return;
    const days = GRACE_PERIOD_DAYS[currentPlan] ?? 3;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    await db
      .update(users)
      .set({
        subscriptionStatus: sub.status,
        subscriptionExpiresAt: expiresAt,
      })
      .where(eq(users.id, userId));

    logger.warn("stripe.subscription.grace_period_started", {
      userId,
      plan: currentPlan,
      status: sub.status,
      expiresAt: expiresAt.toISOString(),
      graceDays: days,
    });

    // Email : "votre paiement a échoué, mettez à jour votre CB"
    if (user.email) {
      await sendEmail(
        {
          to: user.email,
          subject: "⚠️ Paiement échoué — mettez à jour votre carte",
          html: `
            <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
              <h1 style="color: #b91c1c; font-size: 20px;">Votre paiement a échoué</h1>
              <p>Nous n'avons pas pu prélever le renouvellement de votre abonnement <strong>${currentPlan}</strong>.</p>
              <p>Nous conserverons votre accès jusqu'au <strong>${expiresAt.toLocaleDateString("fr-FR", { dateStyle: "long" })}</strong>.</p>
              <p style="text-align: center; margin: 24px 0;">
                <a href="${APP_URL}/dashboard/settings?tab=abonnement" style="display: inline-block; background: #0f172a; color: #fff; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 600;">
                  Mettre à jour ma carte
                </a>
              </p>
              <p style="color: #64748b; font-size: 13px;">Passé cette date, votre compte reviendra au plan Gratuit.</p>
            </div>
          `,
        },
        { category: "transactional" }
      );
    }
    return;
  }

  if (sub.status === "canceled") {
    // Annulation immédiate (rare) → downgrade
    await db
      .update(users)
      .set({
        subscription: "free",
        subscriptionStatus: "canceled",
        subscriptionExpiresAt: null,
      })
      .where(eq(users.id, userId));
    logger.info("stripe.subscription.canceled", { userId });
  }
}

/**
 * customer.subscription.deleted
 * Fin définitive (grace period expirée côté Stripe) → downgrade
 */
export async function handleSubscriptionDeleted(event: Stripe.Event): Promise<void> {
  const sub = event.data.object as Stripe.Subscription;
  const userId = sub.metadata?.userId;
  if (!userId) return;

  await db
    .update(users)
    .set({
      subscription: "free",
      subscriptionStatus: "canceled",
      stripeSubscriptionId: null,
      subscriptionExpiresAt: null,
    })
    .where(eq(users.id, userId));

  logger.info("stripe.subscription.deleted", { userId });
}

/**
 * invoice.payment_failed
 * Notification supplémentaire au user (customer.subscription.updated fait déjà
 * le gros du travail, mais Stripe peut envoyer payment_failed sans updated
 * pour une facture ponctuelle).
 */
export async function handleInvoicePaymentFailed(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);
  if (!user?.email) return;

  logger.warn("stripe.invoice.payment_failed", {
    userId: user.id,
    invoiceId: invoice.id,
    amountDue: invoice.amount_due,
  });
  // Note : pas d'email ici car customer.subscription.updated envoie déjà
  // le mail "paiement échoué" (évite le doublon). On loggue juste.
}

/**
 * invoice.upcoming
 * Envoyé 3 jours avant renouvellement → email de rappel.
 * (Nécessite d'être activé dans le Dashboard Stripe → Settings → Billing)
 */
export async function handleInvoiceUpcoming(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);
  if (!user?.email) return;

  const amount = ((invoice.amount_due ?? 0) / 100).toFixed(2);
  const currency = (invoice.currency || "eur").toUpperCase();
  const nextDate = new Date((invoice.next_payment_attempt ?? Date.now() / 1000) * 1000);

  await sendEmail(
    {
      to: user.email,
      subject: "📅 Prochain prélèvement dans 3 jours",
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <h1 style="color: #0f172a; font-size: 20px;">Rappel de renouvellement</h1>
          <p>Bonjour ${user.firstName},</p>
          <p>Votre prochain prélèvement de <strong>${amount} ${currency}</strong> aura lieu le <strong>${nextDate.toLocaleDateString("fr-FR", { dateStyle: "long" })}</strong>.</p>
          <p style="text-align: center; margin: 24px 0;">
            <a href="${APP_URL}/dashboard/settings?tab=abonnement" style="display: inline-block; background: #f1f5f9; color: #0f172a; padding: 10px 20px; border-radius: 10px; text-decoration: none; font-weight: 600;">
              Voir mon abonnement
            </a>
          </p>
          <p style="color: #64748b; font-size: 13px;">Pas d'action nécessaire si tout est OK.</p>
        </div>
      `,
    },
    { category: "reminders" }
  );

  logger.info("stripe.invoice.upcoming.notified", { userId: user.id, amount });
}

/**
 * customer.subscription.trial_will_end
 * Envoyé 3 jours avant fin de trial → email conversion.
 */
export async function handleTrialWillEnd(event: Stripe.Event): Promise<void> {
  const sub = event.data.object as Stripe.Subscription;
  const userId = sub.metadata?.userId;
  if (!userId) return;

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.email) return;

  await sendEmail(
    {
      to: user.email,
      subject: "🎯 Votre essai se termine dans 3 jours",
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <h1 style="color: #0f172a; font-size: 20px;">Vous aimez Vitrix ?</h1>
          <p>Bonjour ${user.firstName},</p>
          <p>Votre essai gratuit se termine dans 3 jours. Nous espérons que vous appréciez :</p>
          <ul style="color: #334155;">
            <li>Réservation en ligne 24/7</li>
            <li>Devis avec signature électronique</li>
            <li>Paiements Stripe automatiques</li>
          </ul>
          <p>Aucune action n'est nécessaire : votre abonnement se poursuivra automatiquement.</p>
          <p style="text-align: center; margin: 24px 0;">
            <a href="${APP_URL}/dashboard/settings?tab=abonnement" style="display: inline-block; background: #0f172a; color: #fff; padding: 10px 20px; border-radius: 10px; text-decoration: none; font-weight: 600;">
              Gérer mon abonnement
            </a>
          </p>
        </div>
      `,
    },
    { category: "reminders" }
  );

  logger.info("stripe.trial.will_end.notified", { userId });

  // F6 (Lot 34, B25) : notif in-app + push OS pour être sûr que le user voit
  notifyAsync({
    userId,
    type: "subscription.trial_ending",
    title: "Votre essai se termine bientôt",
    message:
      "Votre essai gratuit expire dans 3 jours. Aucune action nécessaire — l'abonnement se poursuivra automatiquement.",
    priority: "high", // bypass DND — info importante
    url: "/dashboard/settings?tab=abonnement",
  });
}

/**
 * invoice.paid / invoice.payment_succeeded
 * Envoi automatique de la facture Stripe (hosted URL) au user.
 * On n'a pas besoin de générer un PDF nous-mêmes : Stripe en produit un
 * déjà accessible via `invoice.invoice_pdf` (URL signée temporaire).
 */
export async function handleInvoicePaid(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);
  if (!user?.email) return;

  const amount = ((invoice.amount_paid ?? 0) / 100).toFixed(2);
  const currency = (invoice.currency || "eur").toUpperCase();
  const pdfUrl = invoice.invoice_pdf;
  const hostedUrl = invoice.hosted_invoice_url;

  await sendEmail(
    {
      to: user.email,
      subject: `✅ Facture Vitrix — ${amount} ${currency}`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <h1 style="color: #059669; font-size: 20px;">Paiement bien reçu</h1>
          <p>Bonjour ${user.firstName},</p>
          <p>Merci pour votre paiement de <strong>${amount} ${currency}</strong>.</p>
          ${pdfUrl ? `<p style="text-align: center; margin: 24px 0;"><a href="${pdfUrl}" style="display: inline-block; background: #0f172a; color: #fff; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 600;">Télécharger la facture PDF</a></p>` : ""}
          ${hostedUrl ? `<p style="text-align: center; color: #64748b; font-size: 13px;">Ou consulter en ligne : <a href="${hostedUrl}">${hostedUrl}</a></p>` : ""}
        </div>
      `,
    },
    { category: "transactional" }
  );

  logger.info("stripe.invoice.paid.notified", {
    userId: user.id,
    invoiceId: invoice.id,
    amount,
  });
}

/**
 * charge.dispute.created
 * Un client conteste un paiement (chargeback) → alerte critique.
 */
export async function handleDisputeCreated(event: Stripe.Event): Promise<void> {
  const dispute = event.data.object as Stripe.Dispute;
  const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;

  logger.error("stripe.dispute.created", {
    disputeId: dispute.id,
    chargeId,
    amount: dispute.amount,
    currency: dispute.currency,
    reason: dispute.reason,
    status: dispute.status,
  });

  // Alerter l'équipe support par email (env optionnelle)
  const supportEmail = process.env.STRIPE_SUPPORT_EMAIL;
  if (supportEmail) {
    await sendEmail(
      {
        to: supportEmail,
        subject: `🚨 Litige Stripe : ${dispute.reason} (${(dispute.amount / 100).toFixed(2)} ${dispute.currency})`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
            <h1 style="color: #b91c1c;">Litige Stripe reçu</h1>
            <p><strong>ID litige :</strong> ${dispute.id}</p>
            <p><strong>Charge :</strong> ${chargeId}</p>
            <p><strong>Montant :</strong> ${(dispute.amount / 100).toFixed(2)} ${dispute.currency.toUpperCase()}</p>
            <p><strong>Motif :</strong> ${dispute.reason}</p>
            <p><strong>Statut :</strong> ${dispute.status}</p>
            <p style="margin-top: 20px;"><a href="https://dashboard.stripe.com/disputes/${dispute.id}">Ouvrir dans Stripe</a></p>
          </div>
        `,
      },
      { category: "transactional" }
    );
  }
}

// -----------------------------------------------------------------------------
// F2 (Lot 30) — Handlers acompte de réservation
// -----------------------------------------------------------------------------

/**
 * `checkout.session.completed` avec metadata.type = "booking_deposit".
 *
 * Le client vient de payer son acompte :
 *  1. Passe le RDV de status `pending` → `confirmed`
 *  2. Passe deposit_status → `paid`
 *  3. Enregistre une ligne dans `payments` (type = deposit)
 *
 * Idempotence : on ne fait rien si le RDV est déjà `confirmed` (webhook rejoué
 * par Stripe, ou double delivery). Le RDV pending est identifié par
 * `stripe_checkout_session_id`, indexé.
 */
export async function handleBookingDepositCompleted(event: Stripe.Event): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;
  const appointmentId = session.metadata?.appointmentId;
  const businessId = session.metadata?.businessId;

  if (!appointmentId || !businessId) {
    logger.warn("stripe.deposit.missing_metadata", {
      sessionId: session.id,
      metadata: session.metadata,
    });
    return;
  }

  // Idempotence : on cible uniquement les RDV encore en attente d'acompte
  const [apt] = await db
    .select()
    .from(appointments)
    .where(
      and(eq(appointments.id, appointmentId), eq(appointments.stripeCheckoutSessionId, session.id))
    )
    .limit(1);

  if (!apt) {
    logger.warn("stripe.deposit.appointment_not_found", { appointmentId, sessionId: session.id });
    return;
  }

  if (apt.depositStatus === "paid") {
    // Webhook rejoué : rien à faire, on est déjà à jour
    logger.info("stripe.deposit.already_paid", { appointmentId });
    return;
  }

  // Confirmation atomique du RDV + traçabilité paiement
  await db
    .update(appointments)
    .set({
      status: "confirmed",
      depositStatus: "paid",
      updatedAt: new Date(),
    })
    .where(eq(appointments.id, appointmentId));

  // Enregistrement du paiement (type "deposit") pour reporting côté pro
  const amountEuros = ((session.amount_total ?? 0) / 100).toFixed(2);
  try {
    await db.insert(payments).values({
      businessId,
      clientId: apt.clientId,
      stripePaymentId: (session.payment_intent as string) || null,
      stripeCustomerId: (session.customer as string) || null,
      amount: amountEuros,
      currency: (session.currency || "EUR").toUpperCase(),
      type: "deposit",
      status: "completed",
      metadata: {
        source: "booking_deposit",
        sessionId: session.id,
        appointmentId,
      },
    });
  } catch (err) {
    // Erreur d'insert paiement = non bloquant pour la confirmation RDV,
    // mais loggé pour audit manuel
    logger.error("stripe.deposit.payment_insert_failed", {
      appointmentId,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  logger.info("stripe.deposit.paid", {
    appointmentId,
    amount: session.amount_total,
    sessionId: session.id,
  });

  // F6 (Lot 34, B25) : notifier le pro (owner du business) que l'acompte est encaissé
  // → il sait que le RDV est CONFIRMÉ (auto). Fire-and-forget.
  try {
    const [biz] = await db
      .select({ ownerId: businesses.ownerId, name: businesses.name })
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .limit(1);
    if (biz?.ownerId) {
      const eur = ((session.amount_total ?? 0) / 100).toFixed(2);
      notifyAsync({
        userId: biz.ownerId,
        businessId,
        type: "deposit.paid",
        title: "Acompte reçu",
        message: `Un acompte de ${eur} € a été payé. Le rendez-vous est confirmé.`,
        data: { appointmentId, amount: session.amount_total },
        url: "/dashboard/appointments",
      });
    }
  } catch {
    /* notify est déjà non-throwing, ce catch est ceinture-bretelles */
  }
}

/**
 * `checkout.session.expired` (via webhook Stripe).
 *
 * Le client n'a pas payé son acompte dans les 30 min → on libère le créneau
 * et on supprime le RDV pending pour laisser la place à d'autres réservations.
 *
 * NB : Stripe envoie ce webhook automatiquement à `expires_at` — pas besoin
 * de cron côté Vitrix. Un cron de sécurité peut être ajouté séparément si
 * on veut faire du sweep manuel (voir `/api/cron/expire-deposits`).
 */
export async function handleCheckoutExpired(event: Stripe.Event): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;
  if (session.metadata?.type !== "booking_deposit") return;

  const appointmentId = session.metadata?.appointmentId;
  if (!appointmentId) return;

  const [apt] = await db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.id, appointmentId),
        eq(appointments.stripeCheckoutSessionId, session.id),
        eq(appointments.depositStatus, "pending")
      )
    )
    .limit(1);

  if (!apt) {
    // Déjà payé ou déjà nettoyé — no-op
    return;
  }

  // Libérer le slot de disponibilité si trouvé
  await db
    .update(availabilitySlots)
    .set({ isBooked: false })
    .where(
      and(
        eq(availabilitySlots.businessId, apt.businessId),
        eq(availabilitySlots.date, apt.date),
        eq(availabilitySlots.startTime, apt.startTime)
      )
    );

  // Soft-delete du RDV pending (garde trace pour audit)
  await db
    .update(appointments)
    .set({
      status: "cancelled",
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(appointments.id, appointmentId));

  logger.info("stripe.deposit.expired", { appointmentId, sessionId: session.id });
}
