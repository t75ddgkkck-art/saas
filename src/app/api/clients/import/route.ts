/**
 * POST /api/clients/import (multipart form: file=csv)
 * Import CSV de clients (Lot 24).
 *
 * FORMAT ATTENDU :
 *   - Colonnes reconnues (case-insensitive) : firstName, lastName, email,
 *     phone, address, notes, source
 *   - firstName + lastName + phone requis (au moins)
 *   - Duplication : upsert par (business, phone normalisé) — on met à jour
 *     les champs non-vides du CSV, on ne détruit pas les données existantes
 *   - Limite : 5000 lignes / import (au-delà, le user devrait passer par
 *     l'API v1 ou plusieurs imports)
 *
 * Réponse : { imported, updated, skipped, errors: [{line, error}, ...] }
 *
 * Sécurité : file size cap 2 MB, header validation, escape strings.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { getCurrentBusiness } from "@/lib/session";
import { requirePermission } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { handleApiError, badRequest, unauthorized } from "@/lib/api-error";
import { parseCsv } from "@/lib/csv";
import { normalizePhone } from "@/lib/validation";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const MAX_ROWS = 5000;

const HEADER_ALIASES: Record<string, string> = {
  // Français fréquents
  prénom: "firstName",
  prenom: "firstName",
  nom: "lastName",
  "e-mail": "email",
  mail: "email",
  téléphone: "phone",
  telephone: "phone",
  tel: "phone",
  adresse: "address",
  notes: "notes",
  source: "source",
  // Anglais/canoniques
  firstname: "firstName",
  first_name: "firstName",
  lastname: "lastName",
  last_name: "lastName",
  email: "email",
  phone: "phone",
  address: "address",
};

/** Normalise un header CSV → clé interne (firstName / lastName / …) ou null. */
function normalizeHeader(raw: string): string | null {
  const key = raw.trim().toLowerCase();
  return HEADER_ALIASES[key] ?? null;
}

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, {
    key: "clients:import",
    limit: 3,
    windowSec: 3600,
  });
  if (!rl.ok) return rl.response;

  const perm = await requirePermission("canAddClients");
  if (perm.error) return perm.error;

  try {
    const business = await getCurrentBusiness();
    if (!business) throw unauthorized();

    // Lire le fichier depuis multipart
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!file || !(file instanceof Blob)) {
      throw badRequest("Fichier CSV manquant (champ 'file')");
    }
    if (file.size > MAX_FILE_SIZE) {
      throw badRequest(`Fichier trop lourd (max ${MAX_FILE_SIZE / 1024 / 1024} MB)`);
    }

    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length === 0) throw badRequest("CSV vide ou en-tête manquant");
    if (rows.length > MAX_ROWS) {
      throw badRequest(`Trop de lignes (max ${MAX_ROWS}). Divisez en plusieurs imports.`);
    }

    // Normalise les headers reçus (le parse renvoie un obj avec les headers bruts)
    // On mappe chaque ligne vers les clés internes.
    const sampleKeys = Object.keys(rows[0]);
    const headerMap: Record<string, string> = {};
    for (const rawHeader of sampleKeys) {
      const canonical = normalizeHeader(rawHeader);
      if (canonical) headerMap[rawHeader] = canonical;
    }
    if (Object.keys(headerMap).length === 0) {
      throw badRequest("Aucun en-tête reconnu (attendus: firstName/lastName/phone/email…)");
    }

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors: { line: number; error: string }[] = [];

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      // Ligne CSV = idx+2 (1-based + header)
      const lineNum = idx + 2;

      // Map row → clés internes
      const normalized: Record<string, string> = {};
      for (const [raw, val] of Object.entries(row)) {
        const key = headerMap[raw];
        if (key) normalized[key] = val.trim();
      }

      const firstName = normalized.firstName?.trim() || "";
      const lastName = normalized.lastName?.trim() || "";
      const phoneRaw = normalized.phone?.trim() || "";
      const emailRaw = normalized.email?.trim().toLowerCase() || "";

      // Validation minimale : au moins un identifiant
      if (!firstName && !lastName && !phoneRaw && !emailRaw) {
        skipped++;
        continue; // ligne totalement vide, on skip silencieusement
      }
      if (!phoneRaw && !emailRaw) {
        errors.push({ line: lineNum, error: "phone ou email requis" });
        skipped++;
        continue;
      }
      if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
        errors.push({ line: lineNum, error: `email invalide: ${emailRaw}` });
        skipped++;
        continue;
      }

      const phone = phoneRaw ? normalizePhone(phoneRaw) : null;

      try {
        // Upsert par (business, phone) si phone présent, sinon insert simple
        let existingId: string | null = null;
        if (phone) {
          const [existing] = await db
            .select({ id: clients.id })
            .from(clients)
            .where(
              and(
                eq(clients.businessId, business.id),
                eq(clients.phone, phone),
                isNull(clients.deletedAt)
              )
            )
            .limit(1);
          if (existing) existingId = existing.id;
        }

        if (existingId) {
          // On met à jour uniquement les champs non-vides du CSV
          // (on ne détruit pas ce que le pro avait déjà saisi manuellement)
          const patch: Partial<typeof clients.$inferInsert> & { updatedAt?: Date } = {
            updatedAt: new Date(),
          };
          if (firstName) patch.firstName = firstName;
          if (lastName) patch.lastName = lastName;
          if (emailRaw) patch.email = emailRaw;
          if (normalized.address) patch.address = normalized.address;
          if (normalized.notes) patch.notes = normalized.notes;
          await db.update(clients).set(patch).where(eq(clients.id, existingId));
          updated++;
        } else {
          await db.insert(clients).values({
            businessId: business.id,
            firstName: firstName || "?",
            lastName: lastName || "?",
            phone: phone || "",
            email: emailRaw || null,
            address: normalized.address || null,
            notes: normalized.notes || null,
            source: (["website", "google", "referral", "social", "other"].includes(
              normalized.source
            )
              ? normalized.source
              : "other") as "website" | "google" | "referral" | "social" | "other",
          });
          imported++;
        }
      } catch (err) {
        logger.warn("[clients/import] ligne rejetée par DB", {
          line: lineNum,
          err: err instanceof Error ? err.message : String(err),
        });
        errors.push({
          line: lineNum,
          error: err instanceof Error ? err.message.slice(0, 200) : "Erreur DB",
        });
        skipped++;
      }
    }

    logger.info("[clients/import] terminé", {
      businessId: business.id,
      imported,
      updated,
      skipped,
      errors: errors.length,
    });

    return NextResponse.json({
      imported,
      updated,
      skipped,
      totalLines: rows.length,
      errors: errors.slice(0, 50), // cap 50 pour éviter payload énorme
    });
  } catch (err) {
    return handleApiError(err, { route: "POST /api/clients/import" });
  }
}
