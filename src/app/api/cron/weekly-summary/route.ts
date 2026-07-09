import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { db } from "@/db";
import { users, businesses, appointments, quotes, payments, pageVisits } from "@/db/schema";
import { eq, and, gte } from "drizzle-orm";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// Cron hebdomadaire (dimanche soir) : récap de la semaine par email pour les pros Pro/Premium
// Configurer sur Vercel : vercel.json crons ou appel externe avec x-cron-secret

async function handler(request: NextRequest) {
  // Accepte le header Vercel Cron (Authorization: Bearer) OU x-cron-secret (appels manuels)
  const authHeader = request.headers.get("authorization");
  const cronSecret = request.headers.get("x-cron-secret");
  if (process.env.CRON_SECRET) {
    const validBearer = authHeader === `Bearer ${process.env.CRON_SECRET}`;
    const validHeader = cronSecret === process.env.CRON_SECRET;
    if (!validBearer && !validHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split("T")[0];

    const allBusinesses = await db.select().from(businesses);
    let sent = 0;

    for (const biz of allBusinesses) {
      const owner = await db.select().from(users).where(eq(users.id, biz.ownerId)).limit(1);
      if (!owner.length || !owner[0].email) continue;
      // Récap réservé aux plans payants
      if (owner[0].subscription === "free") continue;

      const [apts, qts, pmts, visits] = await Promise.all([
        db.select().from(appointments).where(and(eq(appointments.businessId, biz.id), gte(appointments.createdAt, weekAgo))),
        db.select().from(quotes).where(and(eq(quotes.businessId, biz.id), gte(quotes.createdAt, weekAgo))),
        db.select().from(payments).where(and(eq(payments.businessId, biz.id), gte(payments.createdAt, weekAgo))),
        db.select().from(pageVisits).where(and(eq(pageVisits.businessId, biz.id), gte(pageVisits.date, weekAgoStr))),
      ]);

      const revenue = pmts.filter(p => p.status === "completed").reduce((s, p) => s + parseFloat(p.amount), 0);

      // Ne pas spammer si aucune activité
      if (apts.length === 0 && qts.length === 0 && visits.length === 0) continue;

      await sendEmail({
        to: owner[0].email,
        subject: `📊 Votre semaine chez ${biz.name} — ${visits.length} visites, ${apts.length} RDV`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <h1 style="color: #0f172a; font-size: 22px;">Votre récap de la semaine 📊</h1>
            <p style="color: #64748b;">Bonjour ${owner[0].firstName}, voici l'activité de <strong>${biz.name}</strong> ces 7 derniers jours.</p>
            <div style="display: block; background: #f8fafc; border-radius: 12px; padding: 20px; margin: 20px 0;">
              <table style="width: 100%; font-size: 15px; color: #334155;">
                <tr><td style="padding: 8px 0;">👀 Visites de votre vitrine</td><td style="text-align: right; font-weight: 700;">${visits.length}</td></tr>
                <tr><td style="padding: 8px 0;">📅 Nouveaux rendez-vous</td><td style="text-align: right; font-weight: 700;">${apts.length}</td></tr>
                <tr><td style="padding: 8px 0;">📋 Demandes de devis</td><td style="text-align: right; font-weight: 700;">${qts.length}</td></tr>
                <tr><td style="padding: 8px 0;">💰 Encaissements</td><td style="text-align: right; font-weight: 700;">${revenue.toFixed(2)} €</td></tr>
              </table>
            </div>
            <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr"}/dashboard" style="display: inline-block; background: #0f172a; color: white; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 600;">Voir mon tableau de bord</a>
            <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">Vitrix — Visibilité & clients pour artisans</p>
          </div>
        `,
      });
      sent++;
    }

    return NextResponse.json({ success: true, summariesSent: sent });
  } catch (err) {
    return handleApiError(err, { route: "/api/cron/weekly-summary" });
  }
}


// Vercel Cron appelle en GET ; on accepte aussi POST pour les appels manuels
export async function GET(request: NextRequest) {
  return handler(request);
}

export async function POST(request: NextRequest) {
  return handler(request);
}
