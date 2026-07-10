/**
 * GET /api/clients/duplicates
 * Détecte les doublons potentiels (Lot 24).
 *
 * Règles simples et fiables (pas de fuzzy match — trop de faux positifs) :
 *  - Même phone (normalisé) → doublon quasi-certain
 *  - Même email (lowercase) → doublon quasi-certain
 *
 * Retourne des groupes : chaque groupe = 2+ clients partageant phone ou email.
 * L'UI peut proposer "fusionner" (v2, hors ce lot).
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { getCurrentBusiness } from "@/lib/session";
import { requirePermission } from "@/lib/validation";
import { handleApiError, unauthorized } from "@/lib/api-error";

export const dynamic = "force-dynamic";

interface DuplicateGroup {
  key: string; // "phone:+33612345678" ou "email:foo@bar.com"
  type: "phone" | "email";
  value: string;
  clients: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string;
    appointmentsCount: number | null;
    createdAt: string;
  }>;
}

export async function GET() {
  const perm = await requirePermission("canAddClients");
  if (perm.error) return perm.error;

  try {
    const business = await getCurrentBusiness();
    if (!business) throw unauthorized();

    // Récupère tous les clients actifs (soft-deleted exclus)
    const all = await db
      .select({
        id: clients.id,
        firstName: clients.firstName,
        lastName: clients.lastName,
        email: clients.email,
        phone: clients.phone,
        appointmentsCount: clients.appointmentsCount,
        createdAt: clients.createdAt,
      })
      .from(clients)
      .where(and(eq(clients.businessId, business.id), isNull(clients.deletedAt)));

    // Groupement en mémoire — parfait tant qu'on est < 50k clients par pro.
    // Au-delà : DISTINCT ON PostgreSQL, mais on est très loin de ce cap.
    const byPhone = new Map<string, typeof all>();
    const byEmail = new Map<string, typeof all>();

    for (const c of all) {
      const phoneKey = (c.phone || "").trim();
      if (phoneKey.length >= 4) {
        const arr = byPhone.get(phoneKey) || [];
        arr.push(c);
        byPhone.set(phoneKey, arr);
      }
      const emailKey = (c.email || "").trim().toLowerCase();
      if (emailKey) {
        const arr = byEmail.get(emailKey) || [];
        arr.push(c);
        byEmail.set(emailKey, arr);
      }
    }

    const groups: DuplicateGroup[] = [];
    for (const [phone, list] of byPhone.entries()) {
      if (list.length > 1) {
        groups.push({
          key: `phone:${phone}`,
          type: "phone",
          value: phone,
          clients: list.map((c) => ({
            ...c,
            createdAt: c.createdAt.toISOString(),
          })),
        });
      }
    }
    for (const [email, list] of byEmail.entries()) {
      if (list.length > 1) {
        // On skip si tous les clients de ce groupe email sont déjà dans un groupe phone
        // (évite le double-comptage : Alice + Alice ont même phone ET même email)
        const alreadyGrouped = list.every((c) =>
          groups.some((g) => g.clients.some((x) => x.id === c.id))
        );
        if (alreadyGrouped) continue;
        groups.push({
          key: `email:${email}`,
          type: "email",
          value: email,
          clients: list.map((c) => ({
            ...c,
            createdAt: c.createdAt.toISOString(),
          })),
        });
      }
    }

    return NextResponse.json({
      groups,
      totalDuplicates: groups.reduce((s, g) => s + g.clients.length, 0),
      // Utile pour l'UI : "5 doublons détectés sur 234 clients"
      totalClients: all.length,
    });
  } catch (err) {
    return handleApiError(err, { route: "GET /api/clients/duplicates" });
  }
}
