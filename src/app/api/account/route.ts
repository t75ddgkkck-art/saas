import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, businesses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { handleApiError, unauthorized } from "@/lib/api-error";
import { markDeleted } from "@/lib/soft-delete";

export const dynamic = "force-dynamic";

/**
 * DELETE : suppression du compte utilisateur (Lot 14.3 soft delete).
 *
 * On fait un soft delete : `deleted_at = NOW()` sur users + tous les
 * businesses possédés. L'utilisateur ne peut plus se connecter (login
 * doit filtrer sur `deleted_at IS NULL`), ses vitrines sont masquées
 * de l'annuaire public, mais les données restent 30 jours pour :
 *  - Restauration en cas d'erreur (email support)
 *  - Litige Stripe (dispute, chargeback : 60 jours)
 *  - Obligations comptables (10 ans en France mais anonymisables)
 *
 * Un cron RGPD (Lot 15) fera le hard delete après N jours.
 *
 * IMPORTANT : pour les tests + rare cas où on veut vraiment purger tout
 * de suite (ex: RGPD article 17 avec urgence médicale), un endpoint admin
 * dédié permettra le hard delete. Ce endpoint public reste soft.
 */
export async function DELETE() {
  try {
    const user = await getCurrentUser();
    if (!user) throw unauthorized();

    const now = markDeleted();

    // Soft delete des businesses possédés (vitrine masquée du public,
    // mais les données restent restaurables N jours).
    await db
      .update(businesses)
      .set({ deletedAt: now })
      .where(eq(businesses.ownerId, user.id));

    // Soft delete du user (login refusé, sauf s'il est admin ou banni,
    // ces cas restent prioritaires côté route /api/auth/login).
    await db.update(users).set({ deletedAt: now }).where(eq(users.id, user.id));

    // Purge de tous les cookies auth
    const response = NextResponse.json({
      success: true,
      message: "Compte supprimé. Vos données seront purgées définitivement sous 30 jours.",
    });
    response.cookies.delete("auth_token");
    response.cookies.delete("auth_user");
    response.cookies.delete("auth_expires");
    return response;
  } catch (err) {
    return handleApiError(err, { route: "DELETE /api/account" });
  }
}
