/**
 * Helpers soft delete (Lot 14.3).
 *
 * Convention Vitrix : les tables sensibles ont une colonne `deleted_at`
 * (nullable). Un enregistrement supprimé garde toutes ses données mais
 * est masqué des listings via `WHERE deleted_at IS NULL`.
 *
 * Bénéfices :
 * - RGPD "droit à l'oubli" : on peut restaurer une suppression accidentelle
 * - Audit trail : on sait QUAND un client a été supprimé
 * - Anti-fraude : on détecte un pattern "créé puis supprimé"
 *
 * Un cron (à ajouter) pourra faire du hard delete après N jours de rétention
 * (Lot 15 RGPD) pour purger vraiment les données.
 */

import type { SQL } from "drizzle-orm";
import { isNull, isNotNull } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/**
 * Filtre à ajouter dans un `.where()` pour ne récupérer que les
 * enregistrements NON supprimés (cas standard).
 *
 * Exemple :
 * ```ts
 * db.select().from(clients).where(and(
 *   eq(clients.businessId, bizId),
 *   notDeleted(clients.deletedAt)
 * ))
 * ```
 */
export function notDeleted(deletedAtColumn: AnyPgColumn): SQL {
  return isNull(deletedAtColumn);
}

/**
 * Version inversée : uniquement les enregistrements DÉJÀ supprimés.
 * Utile pour l'admin ("corbeille") ou le cron de purge finale.
 */
export function onlyDeleted(deletedAtColumn: AnyPgColumn): SQL {
  return isNotNull(deletedAtColumn);
}

/**
 * Valeur à passer dans un `.update({ deletedAt: markDeleted() })`
 * pour effectuer un soft delete. On garde une fonction (au lieu d'un
 * `new Date()` direct) pour pouvoir mocker le temps dans les tests.
 */
export function markDeleted(): Date {
  return new Date();
}

/**
 * Valeur à passer dans un `.update({ deletedAt: markRestored() })`
 * pour restaurer un enregistrement soft-deleted.
 */
export function markRestored(): null {
  return null;
}
