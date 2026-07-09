import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { loyaltyPoints, clients } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getCurrentBusiness } from "@/lib/session";
import { awardLoyaltyPoints, redeemLoyaltyPoints } from "@/lib/loyalty";
import { handleApiError, unauthorized, badRequest, notFound, forbidden } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

const Schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("award"),
    clientId: z.string().uuid("clientId invalide"),
    amount: z.number().min(0).max(100_000),
    reason: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("redeem"),
    clientId: z.string().uuid("clientId invalide"),
    points: z.number().int().min(1).max(1_000_000),
    reason: z.string().max(500).optional(),
  }),
]);

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

    return NextResponse.json({
      balances,
      config: {
        enabled: business.loyaltyEnabled,
        pointsPerEuro: business.loyaltyPointsPerEuro,
        reward: business.loyaltyReward,
      },
    });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/loyalty" });
  }
}

export async function POST(request: NextRequest) {
  try {
    const business = await getCurrentBusiness();
    if (!business) throw unauthorized();

    const data = await validateBody(request, Schema);

    // Fix IDOR : vérifier que le client appartient bien au business courant
    const [client] = await db
      .select({ id: clients.id, businessId: clients.businessId })
      .from(clients)
      .where(and(eq(clients.id, data.clientId), eq(clients.businessId, business.id)))
      .limit(1);
    if (!client) throw notFound("Client introuvable");
    if (client.businessId !== business.id) throw forbidden();

    if (data.action === "award") {
      const result = await awardLoyaltyPoints(
        business.id,
        data.clientId,
        data.amount,
        data.reason || `Paiement ${data.amount}€`
      );
      return NextResponse.json({ success: true, pointsAwarded: result.awarded });
    }

    // action === "redeem"
    const result = await redeemLoyaltyPoints(
      business.id,
      data.clientId,
      data.points,
      data.reason || "Récompense utilisée"
    );
    if (!result.success) throw badRequest(result.error || "Points insuffisants");
    return NextResponse.json({ success: true, newBalance: result.newBalance });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/loyalty" });
  }
}
