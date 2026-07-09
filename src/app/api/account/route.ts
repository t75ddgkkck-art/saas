import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, businesses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// DELETE: suppression complète du compte et de toutes ses données
export async function DELETE() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Supprimer les businesses (cascade supprime tout : RDV, devis, clients, etc.)
    const userBusinesses = await db.select().from(businesses).where(eq(businesses.ownerId, user.id));
    for (const biz of userBusinesses) {
      await db.delete(businesses).where(eq(businesses.id, biz.id));
    }

    // Supprimer l'utilisateur
    await db.delete(users).where(eq(users.id, user.id));

    // Supprimer les cookies
    const response = NextResponse.json({ success: true, message: "Compte supprimé définitivement" });
    response.cookies.delete("auth_token");
    response.cookies.delete("auth_user");
    response.cookies.delete("auth_expires");
    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
