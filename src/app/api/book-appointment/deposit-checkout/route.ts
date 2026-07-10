/**
 * F2 (Lot 30) — POST /api/book-appointment/deposit-checkout
 *
 * Flow "acompte à la réservation" :
 *  1. Valide le body (mêmes champs que book-appointment classique + serviceId)
 *  2. Résout le business + service, calcule le montant acompte
 *  3. Vérifie que le business a Stripe connecté (compte Connect actif)
 *  4. Vérifie que le pro (owner) a l'entitlement `payments.stripe`
 *  5. Upsert client (comme book-appointment)
 *  6. Marque le slot comme réservé pour éviter les doubles réservations
 *  7. Crée le RDV en status `pending` + `depositStatus='pending'`
 *  8. Crée la session Stripe Checkout (expiration 30 min)
 *  9. Stocke `stripeCheckoutSessionId` sur le RDV
 * 10. Retourne l'URL Checkout au client (redirection depuis la vitrine)
 *
 * Le RDV n'est **PAS** confirmé tant que le webhook `checkout.session.completed`
 * n'est pas reçu — évite qu'un pro voit un faux RDV s'afficher avant paiement.
 *
 * Si abandon → webhook `checkout.session.expired` libère le slot et soft-delete le RDV.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { clients, appointments, availabilitySlots, businesses, services, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { checkRateLimit } from "@/lib/rate-limit";
import { badRequest, handleApiError, notFound, paymentRequired } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";
import { computeDepositCents, DEPOSIT_CHECKOUT_EXPIRY_SEC } from "@/lib/deposit";
import { canUse } from "@/lib/entitlements";
import type { SubscriptionPlan } from "@/lib/permissions";
import { createDepositCheckoutSession, isStripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// Rate-limit très strict : créer des sessions Checkout coûte du temps/IO Stripe
// et un attaquant pourrait spammer pour flood les créneaux "pending".
const RATE = { key: "book-deposit", limit: 3, windowSec: 600 } as const;

const Schema = z.object({
  businessId: z.string().uuid().optional(),
  businessSlug: z.string().trim().max(150).optional(),
  serviceId: z.string().uuid("serviceId requis pour un acompte"),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().max(100).optional().default(""),
  phone: z.string().trim().min(6).max(30),
  email: z.string().trim().toLowerCase().email("Email invalide"),
  notes: z.string().trim().max(2000).optional().default(""),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format YYYY-MM-DD"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Heure attendue au format HH:MM"),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Heure attendue au format HH:MM")
    .optional(),
});

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, RATE);
  if (!rl.ok) return rl.response;

  try {
    if (!isStripeConfigured()) {
      throw badRequest("Stripe n'est pas configuré côté serveur.");
    }

    const data = await validateBody(
      request,
      Schema.refine((v) => v.businessId || v.businessSlug, {
        message: "businessId ou businessSlug requis",
        path: ["businessId"],
      })
    );

    // 1. Résoudre le business
    const [business] = data.businessId
      ? await db.select().from(businesses).where(eq(businesses.id, data.businessId)).limit(1)
      : await db.select().from(businesses).where(eq(businesses.slug, data.businessSlug!)).limit(1);
    if (!business) throw notFound("Professionnel introuvable");

    if (!business.stripeAccountId || !business.enableStripe) {
      throw badRequest("Ce professionnel n'accepte pas les paiements en ligne.");
    }

    // 2. Vérifier l'entitlement du pro (owner du business)
    const [owner] = await db
      .select({ subscription: users.subscription })
      .from(users)
      .where(eq(users.id, business.ownerId))
      .limit(1);
    const ownerPlan = (owner?.subscription || "free") as SubscriptionPlan;
    if (!canUse(ownerPlan, "payments.stripe")) {
      throw paymentRequired("Les acomptes ne sont pas activés pour ce professionnel.", {
        feature: "payments.stripe",
        requiredPlan: "pro",
        currentPlan: ownerPlan,
      });
    }

    // 3. Résoudre le service + calculer l'acompte
    const [service] = await db
      .select()
      .from(services)
      .where(and(eq(services.id, data.serviceId), eq(services.businessId, business.id)))
      .limit(1);
    if (!service) throw notFound("Service introuvable pour ce professionnel");

    const depositCents = computeDepositCents({
      priceCents: service.priceCents,
      depositType: service.depositType as "fixed" | "percent" | null,
      depositAmount: service.depositAmount,
    });
    if (depositCents <= 0) {
      throw badRequest("Ce service ne nécessite pas d'acompte — utilisez /api/book-appointment.");
    }
    // Stripe minimum charge = 50 centimes (EUR) — cas edge d'un acompte trop petit
    if (depositCents < 50) {
      throw badRequest("Le montant d'acompte doit être d'au moins 0,50 €.");
    }

    // 4. Vérif date pas dans le passé
    const now = new Date();
    const target = new Date(`${data.date}T${data.startTime}:00`);
    if (target.getTime() < now.getTime() - 60_000) {
      throw badRequest("Impossible de réserver un créneau passé.");
    }

    // 5. Upsert client par (business, phone)
    const [existing] = await db
      .select()
      .from(clients)
      .where(and(eq(clients.phone, data.phone), eq(clients.businessId, business.id)))
      .limit(1);
    let clientId: string;
    if (!existing) {
      const [c] = await db
        .insert(clients)
        .values({
          businessId: business.id,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          source: "website",
          appointmentsCount: 0, // on incrémente seulement au paiement effectif
          lastContact: new Date(),
        })
        .returning();
      clientId = c.id;
    } else {
      clientId = existing.id;
      await db
        .update(clients)
        .set({
          firstName: data.firstName,
          lastName: data.lastName || existing.lastName,
          email: data.email || existing.email,
          lastContact: new Date(),
        })
        .where(eq(clients.id, clientId));
    }

    // 6. Réservation du slot (atomique via update conditionnel isBooked=false)
    const [slot] = await db
      .select()
      .from(availabilitySlots)
      .where(
        and(
          eq(availabilitySlots.businessId, business.id),
          eq(availabilitySlots.date, data.date),
          eq(availabilitySlots.startTime, data.startTime)
        )
      )
      .limit(1);
    if (slot) {
      if (slot.isBooked)
        throw badRequest("Ce créneau vient d'être réservé, choisissez-en un autre.");
      await db
        .update(availabilitySlots)
        .set({ isBooked: true })
        .where(eq(availabilitySlots.id, slot.id));
    }

    // 7. Créer le RDV en attente d'acompte
    const [startH, startM] = data.startTime.split(":").map(Number);
    const computedEnd =
      data.endTime || `${String(startH + 1).padStart(2, "0")}:${String(startM).padStart(2, "0")}`;

    const [appointment] = await db
      .insert(appointments)
      .values({
        businessId: business.id,
        clientId,
        title: `${service.name} — ${data.firstName} ${data.lastName}`.trim(),
        description: data.notes || null,
        date: data.date,
        startTime: data.startTime,
        endTime: computedEnd,
        status: "pending", // pas encore confirmé
        depositRequired: true,
        depositAmountCents: depositCents,
        depositStatus: "pending",
      })
      .returning();

    // 8. Créer la session Stripe Checkout
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr";
    const successUrl = `${appUrl}/${business.slug}?booking=confirmed&aid=${appointment.id}`;
    const cancelUrl = `${appUrl}/${business.slug}?booking=canceled&aid=${appointment.id}`;

    const session = await createDepositCheckoutSession({
      businessStripeAccountId: business.stripeAccountId,
      businessId: business.id,
      businessSlug: business.slug,
      appointmentId: appointment.id,
      amountCents: depositCents,
      serviceName: service.name,
      clientEmail: data.email,
      successUrl,
      cancelUrl,
      expiresInSec: DEPOSIT_CHECKOUT_EXPIRY_SEC,
    });

    if (!session.url) {
      // Cas très rare — Stripe n'a pas généré d'URL, on rollback le RDV + slot
      if (slot) {
        await db
          .update(availabilitySlots)
          .set({ isBooked: false })
          .where(eq(availabilitySlots.id, slot.id));
      }
      await db.delete(appointments).where(eq(appointments.id, appointment.id));
      throw new Error("Stripe n'a pas retourné d'URL de paiement");
    }

    // 9. Lier la session au RDV pour idempotence côté webhook
    await db
      .update(appointments)
      .set({ stripeCheckoutSessionId: session.id })
      .where(eq(appointments.id, appointment.id));

    logger.info("booking.deposit.session_created", {
      appointmentId: appointment.id,
      sessionId: session.id,
      amountCents: depositCents,
    });

    return NextResponse.json({
      checkoutUrl: session.url,
      appointmentId: appointment.id,
      expiresAt: session.expires_at,
      amountCents: depositCents,
    });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/book-appointment/deposit-checkout" });
  }
}
