/**
 * Vérification opt-out email pour un couple (email, catégorie).
 * Fichier séparé pour éviter un cycle avec `email-queue.ts` et `email.ts`.
 */
import { db } from "@/db";
import { emailOptouts } from "@/db/schema";
import { and, eq, or, sql } from "drizzle-orm";
import type { EmailCategory } from "@/lib/unsubscribe";

/**
 * True si l'email a opt-out pour cette catégorie OU pour "all".
 * Utilise l'index unique (lower(email), category) pour être rapide.
 */
export async function isEmailOptedOut(email: string, category: EmailCategory): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  try {
    const [row] = await db
      .select({ id: emailOptouts.id })
      .from(emailOptouts)
      .where(
        and(
          sql`lower(${emailOptouts.email}) = ${normalized}`,
          or(eq(emailOptouts.category, category), eq(emailOptouts.category, "all"))
        )
      )
      .limit(1);
    return Boolean(row);
  } catch {
    // DB indispo : fail-open (mieux envoyer un email de trop qu'en oublier un critique)
    return false;
  }
}
