import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { loyaltyPoints, loyaltyTransactions, clients } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getCurrentBusiness } from "@/lib/session";
import { awardLoyaltyPoints, redeemLoyaltyPoints } from "@/lib/loyalty";

export const dynamic = "force-dynamic";

// GET: liste des soldes de points de tous les clients du pro
export async function GET() {
  try {
    const business = await getCurrentBusiness();
    if (!business) return NextResponse.json({ balances: [] });

    const balances = await db
      .select({
        clientId: loyaltyPoints.clientId,
        points: loyaltyPoints.points,
        firstName: clients.firstName,
        lastName: clients.lastName,
        phone: clients.phone,
      })
      .from(loyaltyPoints)
      .leftJoin(clients, eq(loyaltyPoints.clientId, clients.id))
      .where(eq(loyaltyPoints.businessId, business.id))
      .orderBy(desc(loyaltyPoints.points));

    return NextResponse.json({ balances, config: {
      enabled: business.loyaltyEnabled,
      pointsPerEuro: business.loyaltyPointsPerEuro,
      reward: business.loyaltyReward,
    }});
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: attribuer ou utiliser des points manuellement (le pro encaisse en espèces par ex.)
export async function POST(request: NextRequest) {
  try {
    const business = await getCurrentBusiness();
    if (!business) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const body = await request.json();
    const { clientId, action, amount, points, reason } = body;

    if (!clientId) return NextResponse.json({ error: "clientId requis" }, { status: 400 });

    if (action === "award") {
      // Attribuer des points selon un montant en euros (ex: paiement espèces de 150€)
      const result = await awardLoyaltyPoints(business.id, clientId, amount || 0, reason || `Paiement ${amount}€`);
      return NextResponse.json({ success: true, pointsAwarded: result.awarded });
    }

    if (action === "redeem") {
      // Utiliser des points (récompense)
      const result = await redeemLoyaltyPoints(business.id, clientId, points || 0, reason || "Récompense utilisée");
      if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json({ success: true, newBalance: result.newBalance });
    }

    return NextResponse.json({ error: "Action invalide (award ou redeem)" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
