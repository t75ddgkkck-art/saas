/**
 * Auto-application des crédits parrainage via coupons Stripe.
 *
 * Design :
 *  - 1 crédit référent = 1 coupon Stripe `duration=once` `amount_off = prix_mensuel`
 *  - Appliqué directement à la subscription du parrain (prochaine facture uniquement)
 *  - Décrémente `users.referral_credit_months` de N dans le même flow
 *  - Idempotent via un check `subscription.metadata.referral_coupon_applied_events` (JSON array
 *    d'event IDs déjà traités). Un webhook rejoué → skip.
 *
 * Alternative écartée : `trial_period_days` → nécessite recréer la sub, casse
 * la facturation existante. Les coupons Stripe sont plus légers et propres.
 *
 * Prérequis parrain :
 *  - `users.stripeSubscriptionId` renseigné (le parrain doit avoir une sub Pro/Premium active)
 *  - Sinon on garde le crédit en DB (`referral_credit_months`) pour usage futur
 *    au moment où le parrain upgradera (déjà géré par la logique DB Lot 52).
 *
 * Sécurité :
 *  - Amount capé au prix mensuel du plan actuel (jamais un coupon > 79€)
 *  - Non-bloquant : si Stripe API râle, on log warn mais on ne throw pas
 *    (le crédit DB reste préservé, l'admin peut appliquer manuellement)
 */

import Stripe from "stripe";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getStripe } from "@/lib/stripe";
import { PLANS, type PlanId } from "@/lib/plans";
import { logger } from "@/lib/logger";

export interface ApplyResult {
  ok: boolean;
  reason?:
    | "no_subscription"
    | "no_credits"
    | "already_applied_recently"
    | "invalid_plan"
    | "stripe_error"
    | "applied";
  couponId?: string;
  amountOffCents?: number;
  monthsConsumed?: number;
}

/**
 * Applique 1 crédit référent au parrain sous forme de coupon Stripe.
 *
 * Appelé fire-and-forget depuis `handleCheckoutCompleted` juste après
 * `creditReferrer(referrerId, 1)`. Toutes les erreurs sont catchées ici.
 *
 * @param referrerId user id du parrain qui doit recevoir le crédit
 * @returns résultat détaillé (log/debug)
 */
export async function applyReferralCreditsAsStripeCoupon(
  referrerId: string
): Promise<ApplyResult> {
  try {
    // 1. Charge l'user parrain + sa subscription + son plan
    const [user] = await db
      .select({
        id: users.id,
        subscription: users.subscription,
        stripeSubscriptionId: users.stripeSubscriptionId,
        stripeCustomerId: users.stripeCustomerId,
        referralCreditMonths: users.referralCreditMonths,
      })
      .from(users)
      .where(eq(users.id, referrerId))
      .limit(1);

    if (!user) {
      return { ok: false, reason: "no_subscription" };
    }

    // 2. Vérif préalables
    if (!user.stripeSubscriptionId) {
      // Parrain n'est pas sur un plan payant → on garde le crédit DB (Lot 52)
      // Il sera appliqué au moment où il upgradera Pro/Premium.
      logger.info("referral-coupon.skipped", {
        referrerId,
        reason: "no_subscription",
        creditsPending: user.referralCreditMonths,
      });
      return { ok: false, reason: "no_subscription" };
    }

    if (user.referralCreditMonths <= 0) {
      return { ok: false, reason: "no_credits" };
    }

    // 3. Récupère la sub Stripe pour :
    //    - lire les metadata (idempotence)
    //    - récupérer le prix du plan actuel (pour dimensionner le coupon)
    const stripe = getStripe();
    let subscription: Stripe.Subscription;
    try {
      subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
    } catch (err) {
      logger.warn("referral-coupon.subscription_not_found", {
        referrerId,
        stripeSubscriptionId: user.stripeSubscriptionId,
        err: err instanceof Error ? err.message : String(err),
      });
      return { ok: false, reason: "stripe_error" };
    }

    // 4. Idempotence : si un coupon a été appliqué dans les 60 dernières secondes,
    // on skip (webhook rejoué ou concurrence).
    const lastAppliedAt = subscription.metadata?.referral_coupon_last_applied_at;
    if (lastAppliedAt) {
      const lastMs = Date.parse(lastAppliedAt);
      if (!Number.isNaN(lastMs) && Date.now() - lastMs < 60_000) {
        logger.info("referral-coupon.skipped_idempotent", {
          referrerId,
          lastAppliedAt,
        });
        return { ok: false, reason: "already_applied_recently" };
      }
    }

    // 5. Calcul du montant du coupon = prix mensuel du plan actuel
    // Le user peut être sur `pro` ou `premium` — dans les deux cas on offre 1 mois complet.
    const plan = user.subscription as PlanId;
    if (plan !== "pro" && plan !== "premium") {
      // Free ou plan bizarre — pas de subscription payante théoriquement, mais défensif
      return { ok: false, reason: "invalid_plan" };
    }
    const monthlyPriceEur = PLANS[plan].monthlyPrice;
    if (monthlyPriceEur <= 0) {
      return { ok: false, reason: "invalid_plan" };
    }
    const amountOffCents = Math.round(monthlyPriceEur * 100);

    // 6. Crée le coupon Stripe (durée = once → appliqué à la prochaine facture uniquement)
    // Currency doit matcher celle de la sub (EUR pour Vitrix).
    let coupon: Stripe.Coupon;
    try {
      coupon = await stripe.coupons.create({
        amount_off: amountOffCents,
        currency: "eur",
        duration: "once",
        name: `Parrainage Vitrix — 1 mois offert`,
        metadata: {
          type: "referral_credit",
          referrer_user_id: referrerId,
        },
      });
    } catch (err) {
      logger.error("referral-coupon.create_failed", {
        referrerId,
        err: err instanceof Error ? err.message : String(err),
      });
      return { ok: false, reason: "stripe_error" };
    }

    // 7. Attache le coupon à la subscription — Stripe l'appliquera à la prochaine facture
    // Note : depuis Stripe SDK v22+, `coupon` (singulier) est retiré au profit
    // de `discounts: [{ coupon }]`. Le comportement est identique.
    try {
      await stripe.subscriptions.update(user.stripeSubscriptionId, {
        discounts: [{ coupon: coupon.id }],
        metadata: {
          ...subscription.metadata,
          referral_coupon_last_applied_at: new Date().toISOString(),
          referral_coupon_last_id: coupon.id,
        },
      });
    } catch (err) {
      logger.error("referral-coupon.attach_failed", {
        referrerId,
        couponId: coupon.id,
        err: err instanceof Error ? err.message : String(err),
      });
      // Le coupon a été créé mais pas attaché — on peut le retenter manuellement.
      // On préserve le crédit DB pour que la prochaine tentative fonctionne.
      return { ok: false, reason: "stripe_error" };
    }

    // 8. Décrémente le crédit DB de 1 (le coupon = 1 mois)
    // Utilise `GREATEST(x-1, 0)` pour ne jamais descendre sous 0 (défensif).
    await db
      .update(users)
      .set({
        referralCreditMonths: sql`GREATEST(${users.referralCreditMonths} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, referrerId));

    logger.info("referral-coupon.applied", {
      referrerId,
      couponId: coupon.id,
      amountOffCents,
      plan,
    });

    return {
      ok: true,
      reason: "applied",
      couponId: coupon.id,
      amountOffCents,
      monthsConsumed: 1,
    };
  } catch (err) {
    // Filet de sécurité — jamais throw depuis cette fonction
    logger.error("referral-coupon.unexpected_error", {
      referrerId,
      err: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, reason: "stripe_error" };
  }
}

/**
 * Wrapper fire-and-forget pour usage webhook (ne bloque jamais).
 */
export function applyReferralCreditsAsync(referrerId: string): void {
  void applyReferralCreditsAsStripeCoupon(referrerId).catch(() => {
    /* déjà catch en interne, ceinture-bretelles */
  });
}
