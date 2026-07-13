/**
 * Lot 42 (F9) — Numérotation séquentielle SANS TROU des factures.
 *
 * Contrainte légale FR (art. 289 CGI) :
 *  > Les factures doivent être émises dans une SÉRIE CONTINUE, sans discontinuité,
 *  > basée sur une séquence chronologique et croissante, propre à l'émetteur.
 *
 * Ce qui exclut :
 *  - `businessId + timestamp` → discontinu (deux factures dans la même seconde partagent le numéro OU si l'horloge saute)
 *  - `MAX(invoiceCounter)+1` sans lock → race condition = doublons
 *  - `nextval('sequence')` global → un rollback = trou dans la série
 *
 * Solution ici : `SELECT ... FOR UPDATE` dans une transaction Postgres.
 *  - Bloque toute autre transaction qui essaie de lire/écrire le compteur
 *  - Le +1 est atomique
 *  - Si la transaction rollback (erreur PDF, INSERT invoice raté), le compteur ne bouge pas
 *  - Zéro trou possible
 *
 * Format généré : `<prefix><year>-<counter zero-padded 4>`
 *  Ex. "F-2026-0001", "F-2026-0002", ...
 *
 * Le préfixe et le compteur sont stockés sur `businesses` (colonnes L42).
 */

import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { PgTransaction } from "drizzle-orm/pg-core";

export interface GeneratedInvoiceNumber {
  /** Numéro humain formaté prêt à imprimer/envoyer */
  invoiceNumber: string;
  /** Valeur brute du compteur incrémenté (pour audit) */
  counter: number;
  /** Année d'émission (utilisée dans le numéro) */
  year: number;
}

/**
 * Génère un nouveau numéro de facture atomique pour un business.
 *
 * ⚠️ DOIT être appelé DANS la même transaction que l'INSERT de la facture.
 * Passer `tx` si tu es déjà dans une transaction, sinon la fonction ouvre la sienne.
 *
 * @param businessId    UUID du business qui émet
 * @param tx            (optionnel) transaction Drizzle existante
 * @param nowFactory    (optionnel) horloge injectable pour les tests
 */
export async function generateInvoiceNumber(
  businessId: string,
  tx?: PgTransaction<never, never, never>,
  nowFactory: () => Date = () => new Date()
): Promise<GeneratedInvoiceNumber> {
  const runner = tx ?? db;

  // Transaction serialisable si on n'a pas déjà une transaction ouverte.
  // On garde le pattern simple : un SELECT FOR UPDATE + un UPDATE.
  const exec = async (executor: typeof db) => {
    // 1) Lock la ligne business pour empêcher toute autre transaction
    //    de lire invoice_counter avant qu'on ait fini.
    //    IMPORTANT : on renvoie le prefix aussi, car il peut avoir été
    //    changé par l'utilisateur entre-temps.
    //
    // Note Drizzle : `.execute()` avec pg driver retourne { rows, ... },
    // on accède aux résultats via `.rows[0]` (pattern déjà en place dans metrics.ts).
    const selectRes = await executor.execute<{
      invoice_prefix: string | null;
      invoice_counter: number;
    }>(sql`
      SELECT invoice_prefix, invoice_counter
      FROM businesses
      WHERE id = ${businessId}
      FOR UPDATE
    `);
    const row = selectRes.rows[0];

    if (!row) {
      throw new Error(`Business ${businessId} introuvable pour numérotation facture`);
    }

    const next = row.invoice_counter + 1;

    // 2) Incrémente le compteur — protégé par le FOR UPDATE
    await executor.execute(sql`
      UPDATE businesses
      SET invoice_counter = ${next}, updated_at = now()
      WHERE id = ${businessId}
    `);

    const prefix = (row.invoice_prefix ?? "F-").trim();
    const year = nowFactory().getUTCFullYear();
    // Zero-pad sur 4 chiffres — supporte 9999 factures/an, largement suffisant
    // pour un artisan (au-delà on scale à 5 chiffres, mais c'est un problème
    // qu'on préfère avoir).
    const counterStr = String(next).padStart(4, "0");

    return {
      invoiceNumber: `${prefix}${year}-${counterStr}`,
      counter: next,
      year,
    };
  };

  if (tx) {
    // Transaction déjà ouverte par l'appelant → on l'utilise directement
    return exec(runner as typeof db);
  }

  // Sinon on ouvre la nôtre — garantit l'atomicité même sans caller-tx
  return db.transaction(async (innerTx) => exec(innerTx as unknown as typeof db));
}
