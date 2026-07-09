import { NextResponse } from "next/server";
import { db } from "@/db";
import { appointments, quotes, clients, payments, reviews, pageVisits } from "@/db/schema";
import { eq, desc, gte, and } from "drizzle-orm";
import { getCurrentBusiness } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

// Retourne toute l'activité du pro pour le dashboard unifié
export async function GET() {
  try {
    const business = await getCurrentBusiness();
    if (!business) {
      return NextResponse.json({
        appointments: [], quotes: [], clients: [], payments: [], reviews: [],
        stats: { revenue: 0, appointmentsCount: 0, quotesCount: 0, clientsCount: 0, avgRating: 0 },
        business: null,
      });
    }

    // Fenêtre de 14 jours pour les stats de visites
    const since = new Date();
    since.setDate(since.getDate() - 13);
    const sinceStr = since.toISOString().split("T")[0];

    const [apts, qts, clts, pmts, rvws, visits] = await Promise.all([
      db.select().from(appointments).where(eq(appointments.businessId, business.id)).orderBy(desc(appointments.createdAt)).limit(50),
      db.select().from(quotes).where(eq(quotes.businessId, business.id)).orderBy(desc(quotes.createdAt)).limit(50),
      db.select().from(clients).where(eq(clients.businessId, business.id)).orderBy(desc(clients.createdAt)).limit(100),
      db.select().from(payments).where(eq(payments.businessId, business.id)).orderBy(desc(payments.createdAt)).limit(50),
      db.select().from(reviews).where(eq(reviews.businessId, business.id)).orderBy(desc(reviews.createdAt)).limit(20),
      db.select().from(pageVisits).where(and(eq(pageVisits.businessId, business.id), gte(pageVisits.date, sinceStr))),
    ]);

    const revenue = pmts.filter(p => p.status === "completed").reduce((s, p) => s + parseFloat(p.amount), 0);
    const avgRating = rvws.length > 0 ? rvws.reduce((s, r) => s + r.rating, 0) / rvws.length : 0;

    // Agrégation des visites : par jour + par source + par appareil
    const visitsByDay: Record<string, number> = {};
    for (let i = 0; i < 14; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      visitsByDay[d.toISOString().split("T")[0]] = 0;
    }
    const visitsBySource: Record<string, number> = {};
    const visitsByDevice: Record<string, number> = {};
    for (const v of visits) {
      if (visitsByDay[v.date] !== undefined) visitsByDay[v.date]++;
      visitsBySource[v.source || "direct"] = (visitsBySource[v.source || "direct"] || 0) + 1;
      visitsByDevice[v.device || "desktop"] = (visitsByDevice[v.device || "desktop"] || 0) + 1;
    }

    return NextResponse.json({
      appointments: apts,
      quotes: qts,
      clients: clts,
      payments: pmts,
      reviews: rvws,
      stats: {
        revenue,
        appointmentsCount: apts.length,
        quotesCount: qts.length,
        clientsCount: clts.length,
        avgRating,
        visitsTotal: visits.length,
      },
      visits: {
        byDay: Object.entries(visitsByDay).map(([date, count]) => ({ date, count })),
        bySource: Object.entries(visitsBySource).map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count),
        byDevice: Object.entries(visitsByDevice).map(([device, count]) => ({ device, count })),
      },
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        subscription: null,
      },
    });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/activity" });
  }
}
