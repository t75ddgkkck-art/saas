import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  appointments,
  quotes,
  clients,
  payments,
  reviews,
  analytics,
  businesses,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentBusiness } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
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

    // Compter les données réelles
    const [appointmentList, quoteList, clientList, paymentList, reviewList] = await Promise.all([
      db.select().from(appointments).where(eq(appointments.businessId, business.id)),
      db.select().from(quotes).where(eq(quotes.businessId, business.id)),
      db.select().from(clients).where(eq(clients.businessId, business.id)),
      db.select().from(payments).where(eq(payments.businessId, business.id)),
      db.select().from(reviews).where(eq(reviews.businessId, business.id)),
    ]);

    // Calculer le CA
    const totalRevenue = paymentList
      .filter((p) => p.status === "completed")
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);

    // Compter les devis acceptés
    const acceptedQuotes = quoteList.filter(
      (q) => q.status === "accepted" || q.status === "signed"
    ).length;

    // Rendez-vous à venir (status confirmed ou pending, date >= aujourd'hui)
    const today = new Date().toISOString().split("T")[0];
    const upcoming = appointmentList
      .filter((a) => a.status === "confirmed" || a.status === "pending")
      .filter((a) => a.date >= today)
      .slice(0, 5);

    // Devis récents
    const recentQuotes = quoteList
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .map((q) => ({
        id: q.quoteNumber,
        title: q.title,
        client: "Client",
        amount: parseFloat(q.total || "0"),
        status: q.status,
        date: q.createdAt.toISOString().split("T")[0],
      }));

    return NextResponse.json({
      revenue: totalRevenue,
      appointments: appointmentList.length,
      quotes: quoteList.length,
      quotesAccepted: acceptedQuotes,
      clients: clientList.length,
      visitors: 0, // À implémenter avec un vrai tracking
      reviews: reviewList.length,
      avgRating: reviewList.length > 0
        ? reviewList.reduce((sum, r) => sum + r.rating, 0) / reviewList.length
        : 0,
      upcomingAppointments: upcoming,
      recentQuotes,
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        pageUrl: `/${business.slug}`,
      },
    });
  } catch (error: any) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}
