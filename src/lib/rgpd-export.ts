/**
 * Export RGPD (article 20 – droit à la portabilité).
 *
 * Collecte TOUTES les données personnelles d'un user + celles de son business
 * dans un JSON structuré, machine-readable. Format aligné sur les
 * recommandations CNIL (voir docs/RGPD.md).
 *
 * SÉCURITÉ :
 * - Le hash de mot de passe est EXCLU (pas une donnée perso au sens RGPD,
 *   et exposer bcrypt permettrait un brute-force offline)
 * - Les tokens de session ne sont pas persistés en DB → rien à exporter
 * - Les données des CLIENTS du user (CRM) SONT incluses car le user en est
 *   le responsable de traitement (nous sommes sous-traitants). Il peut donc
 *   les exporter pour honorer la portabilité vers ses propres clients.
 *
 * Performance : requêtes séquentielles OK (export = action ponctuelle,
 * jamais dans un hot path).
 */

import { db } from "@/db";
import {
  users,
  businesses,
  clients,
  appointments,
  quotes,
  payments,
  blogPosts,
  reviews,
  aiUsage,
  services,
  emailOptouts,
} from "@/db/schema";
import { eq, inArray, or } from "drizzle-orm";
import type { User } from "@/db/types";

export interface RgpdExport {
  meta: {
    exportedAt: string;
    format: "vitrix-rgpd-v1";
    userId: string;
    notice: string;
  };
  user: Omit<User, "passwordHash">;
  businesses: unknown[];
  clients: unknown[];
  appointments: unknown[];
  quotes: unknown[];
  payments: unknown[];
  blogPosts: unknown[];
  reviews: unknown[];
  aiUsage: unknown[];
  services: unknown[];
  emailOptouts: unknown[];
}

/**
 * Récupère toutes les données personnelles rattachées à l'user.
 * Le password hash est retiré avant retour (jamais dans un export RGPD).
 */
export async function buildRgpdExport(userId: string): Promise<RgpdExport> {
  // 1. User (sans le password hash)
  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = userRows[0];
  if (!user) throw new Error(`User introuvable : ${userId}`);

  // On casse le lien vers passwordHash sans le TypeScript "any"
  const { passwordHash: _pw, ...userSafe } = user;

  // 2. Businesses (peut être 0, 1 ou plusieurs)
  const bizRows = await db.select().from(businesses).where(eq(businesses.ownerId, userId));
  const bizIds = bizRows.map((b) => b.id);

  // 3. Toutes les données liées via businessId
  //    (si l'user n'a pas de business, on skip → arrays vides)
  const hasBiz = bizIds.length > 0;

  const [
    clientsRows,
    appointmentsRows,
    quotesRows,
    paymentsRows,
    blogRows,
    reviewsRows,
    servicesRows,
  ] = hasBiz
    ? await Promise.all([
        db.select().from(clients).where(inArray(clients.businessId, bizIds)),
        db.select().from(appointments).where(inArray(appointments.businessId, bizIds)),
        db.select().from(quotes).where(inArray(quotes.businessId, bizIds)),
        db.select().from(payments).where(inArray(payments.businessId, bizIds)),
        db.select().from(blogPosts).where(inArray(blogPosts.businessId, bizIds)),
        db.select().from(reviews).where(inArray(reviews.businessId, bizIds)),
        db.select().from(services).where(inArray(services.businessId, bizIds)),
      ])
    : [[], [], [], [], [], [], []];

  // 4. AI usage (rattaché au user directement)
  const aiRows = await db.select().from(aiUsage).where(eq(aiUsage.userId, userId));

  // 5. Email opt-outs : on récupère par email (peut concerner user OU ses clients ayant
  //    demandé unsubscribe). On limite au user pour éviter la fuite.
  const optoutRows = await db
    .select()
    .from(emailOptouts)
    .where(eq(emailOptouts.email, user.email.toLowerCase()));

  return {
    meta: {
      exportedAt: new Date().toISOString(),
      format: "vitrix-rgpd-v1",
      userId,
      notice:
        "Export conforme au RGPD article 20 (portabilité). Les données de vos clients sont incluses car vous en êtes responsable de traitement. Le hash de votre mot de passe est exclu.",
    },
    user: userSafe,
    businesses: bizRows,
    clients: clientsRows,
    appointments: appointmentsRows,
    quotes: quotesRows,
    payments: paymentsRows,
    blogPosts: blogRows,
    reviews: reviewsRows,
    aiUsage: aiRows,
    services: servicesRows,
    emailOptouts: optoutRows,
  };
}

// Utilitaire (évite un warn TS sur `or` importé non utilisé). Certains
// contextes futurs voudront filtrer par clientId aussi → on garde l'import.
export const __rgpdInternals = { or };
