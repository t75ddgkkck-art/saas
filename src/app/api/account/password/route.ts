/**
 * PUT /api/account/password
 * Change le mot de passe du user connecté (Lot 19).
 *
 * SÉCURITÉ :
 * - Requiert l'ancien mot de passe (protège en cas de session volée : l'attaquant
 *   ne peut pas rebasculer le mdp sans le connaître)
 * - Rate limit 5 tentatives / heure / IP
 * - Nouveau mdp validé identique au register (min 8, max 200)
 * - Log audit
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { handleApiError, unauthorized, badRequest } from "@/lib/api-error";
import { validateBody } from "@/lib/api-helpers";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const Schema = z
  .object({
    currentPassword: z.string().min(1, "Ancien mot de passe requis").max(200),
    newPassword: z
      .string()
      .min(8, "Le nouveau mot de passe doit contenir au moins 8 caractères")
      .max(200),
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: "Le nouveau mot de passe doit être différent de l'ancien",
    path: ["newPassword"],
  });

export async function PUT(req: NextRequest) {
  const rl = checkRateLimit(req, {
    key: "account:change-password",
    limit: 5,
    windowSec: 3600,
  });
  if (!rl.ok) return rl.response;

  try {
    const user = await getCurrentUser();
    if (!user) throw unauthorized();

    const data = await validateBody(req, Schema);

    // Vérif ancien mdp (anti-vol de session)
    const valid = await verifyPassword(data.currentPassword, user.passwordHash);
    if (!valid) {
      logger.warn("[account/password] mauvais ancien mdp", { userId: user.id });
      throw badRequest("Ancien mot de passe incorrect");
    }

    const newHash = await hashPassword(data.newPassword);
    await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));

    logger.info("[account/password] mdp changé", { userId: user.id });

    return NextResponse.json({
      ok: true,
      message: "Mot de passe mis à jour",
    });
  } catch (err) {
    return handleApiError(err, { route: "PUT /api/account/password" });
  }
}
