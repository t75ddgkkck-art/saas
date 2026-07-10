/**
 * Petits utilitaires pour les routes API :
 *  - `assertOwnership` : vérifie qu'une ressource appartient au business courant (fix IDOR)
 *  - `withValidation` : parse un body JSON via un schéma Zod avec gestion d'erreur uniforme
 *  - `parseJson` : parse du JSON de façon safe (ne throw jamais un TypeError obscur)
 */
import type { z } from "zod";
import { badRequest, forbidden, notFound } from "@/lib/api-error";

/**
 * Parse du JSON safe. Renvoie null si le body est vide ou malformé.
 */
export async function parseJson<T = unknown>(req: Request): Promise<T | null> {
  try {
    const text = await req.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/**
 * Parse + valide un body JSON via Zod. Throw un HttpError 400 si invalide.
 */
export async function validateBody<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  const raw = await parseJson(req);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const field = first?.path.join(".") || "champ";
    throw badRequest(`${field}: ${first?.message || "invalide"}`);
  }
  return parsed.data;
}

/**
 * Vérifie qu'un enregistrement existe ET appartient au business courant.
 * Usage :
 *   const row = assertOwnership(dbRow, business.id, "Article");
 * Throw 404 si null, 403 si business_id ne correspond pas.
 */
export function assertOwnership<T extends { businessId: string } | null | undefined>(
  row: T,
  businessId: string,
  what = "Ressource"
): NonNullable<T> {
  if (!row) throw notFound(`${what} introuvable`);
  if (row.businessId !== businessId) throw forbidden(`${what} : accès refusé`);
  return row as NonNullable<T>;
}
