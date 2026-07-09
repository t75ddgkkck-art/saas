import { NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, quotes, clients, payments, reviews } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getCurrentBusiness } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const business = await getCurrentBusiness();

    if (!business) {
      return NextResponse.json({
        revenue: 0,
        appointments: 0,
        quotes: 0,
        quotesAccepted: 0,
        clients: 0,
        visitors: 0,
        upcomingAppointments: [],
        recentQuotes: [],
      });
    }

    // 5 requêtes en parallèle avec agrégats côté DB (pas de N+1, pas de download inutile).
    const bizId = business.id;
    const [aptAgg, quoteAgg, clientAgg, paymentAgg, reviewAgg, upcoming, recentQuotes] =
      await Promise.all([
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(appointments)
          .where(eq(appointments.businessId, bizId)),
        db
          .select({
            total: sql<number>`count(*)::int`,
            accepted: sql<number>`count(*) filter (where status in ('accepted','signed'))::int`,
          })
          .from(quotes)
          .where(eq(quotes.businessId, bizId)),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(clients)
          .where(eq(clients.businessId, bizId)),
        db
          .select({
            revenue: sql<string>`coalesce(sum(amount) filter (where status = 'completed'), 0)`,
          })
          .from(payments)
          .where(eq(payments.businessId, bizId)),
        db
          .select({
            count: sql<number>`count(*)::int`,
            avg: sql<string>`coalesce(avg(rating)::numeric(3,2), 0)`,
          })
          .from(reviews)
          .where(eq(reviews.businessId, bizId)),
        // Requête ciblée : RDV à venir uniquement
        db
          .select()
          .from(appointments)
          .where(
            sql`${appointments.businessId} = ${bizId}
                and ${appointments.status} in ('confirmed','pending')
                and ${appointments.date} >= ${new Date().toISOString().split("T")[0]}`
          )
          .limit(5),
        // Devis récents (ordonnés côté DB)
        db
          .select()
          .from(quotes)
          .where(eq(quotes.businessId, bizId))
          .orderBy(sql`created_at desc`)
          .limit(5),
      ]);

    return NextResponse.json({
      revenue: Number(paymentAgg[0].revenue) || 0,
      appointments: aptAgg[0].count,
      quotes: quoteAgg[0].total,
      quotesAccepted: quoteAgg[0].accepted,
      clients: clientAgg[0].count,
      visitors: 0, // à connecter à pageVisits si besoin
      reviews: reviewAgg[0].count,
      avgRating: Number(reviewAgg[0].avg) || 0,
      upcomingAppointments: upcoming,
      recentQuotes: recentQuotes.map((q) => ({
        id: q.quoteNumber,
        title: q.title,
        client: "Client",
        amount: parseFloat(q.total || "0"),
        status: q.status,
        date: q.createdAt.toISOString().split("T")[0],
      })),
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        pageUrl: `/${business.slug}`,
      },
    });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/dashboard" });
  }
}
