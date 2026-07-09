import { db } from "@/db";
import { loyaltyPoints, loyaltyTransactions, businesses } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// Attribue des points à un client (appelé après un paiement)
export async function awardLoyaltyPoints(businessId: string, clientId: string, amountEuros: number, reason: string) {
  // Vérifier que le business a la fidélité activée
  const biz = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
  if (!biz.length || !biz[0].loyaltyEnabled) return { awarded: 0 };

  const pointsToAdd = Math.floor(amountEuros * (biz[0].loyaltyPointsPerEuro || 1));
  if (pointsToAdd <= 0) return { awarded: 0 };

  // Chercher le solde existant
  const existing = await db.select().from(loyaltyPoints)
    .where(and(eq(loyaltyPoints.businessId, businessId), eq(loyaltyPoints.clientId, clientId)))
    .limit(1);

  if (existing.length > 0) {
    await db.update(loyaltyPoints)
      .set({ points: existing[0].points + pointsToAdd, updatedAt: new Date() })
      .where(eq(loyaltyPoints.id, existing[0].id));
  } else {
    await db.insert(loyaltyPoints).values({ businessId, clientId, points: pointsToAdd });
  }

  // Historique
  await db.insert(loyaltyTransactions).values({
    businessId, clientId, points: pointsToAdd, reason,
  });

  return { awarded: pointsToAdd };
}

// Récupère le solde de points d'un client
export async function getLoyaltyBalance(businessId: string, clientId: string): Promise<number> {
  const result = await db.select().from(loyaltyPoints)
    .where(and(eq(loyaltyPoints.businessId, businessId), eq(loyaltyPoints.clientId, clientId)))
    .limit(1);
  return result[0]?.points || 0;
}

// Utiliser des points (récompense)
export async function redeemLoyaltyPoints(businessId: string, clientId: string, points: number, reason: string) {
  const balance = await getLoyaltyBalance(businessId, clientId);
  if (balance < points) return { success: false, error: "Solde insuffisant" };

  const existing = await db.select().from(loyaltyPoints)
    .where(and(eq(loyaltyPoints.businessId, businessId), eq(loyaltyPoints.clientId, clientId)))
    .limit(1);

  await db.update(loyaltyPoints)
    .set({ points: balance - points, updatedAt: new Date() })
    .where(eq(loyaltyPoints.id, existing[0].id));

  await db.insert(loyaltyTransactions).values({
    businessId, clientId, points: -points, reason,
  });

  return { success: true, newBalance: balance - points };
}
