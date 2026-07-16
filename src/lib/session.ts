import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/db";
import { users, businesses } from "@/db/schema";
import { and, eq } from "drizzle-orm";

// Fail-fast en production si le secret n'est pas configuré.
// En développement on tolère un secret par défaut mais on le signale bruyamment.
function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("NEXTAUTH_SECRET manquant ou trop court (>= 16 chars requis en production).");
    }
    // eslint-disable-next-line no-console
    console.warn(
      "[session] NEXTAUTH_SECRET non défini — utilisation d'un secret DEV, ne PAS utiliser en prod."
    );
    return "dev-secret-change-me-please-use-32bytes-min";
  }
  return secret;
}

const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

// Crée un token signé : base64url(userId.expiry.signature)
export function createSessionToken(userId: string): string {
  const expiry = Date.now() + TOKEN_EXPIRY_MS;
  const payload = `${userId}.${expiry}`;
  const signature = sign(payload);
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

// Vérifie et décode un token de session en temps constant.
export function verifySessionToken(token: string): { userId: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const parts = decoded.split(".");
    if (parts.length !== 3) return null;
    const [userId, expiryStr, signature] = parts;
    if (!userId || !expiryStr || !signature) return null;

    const expected = sign(`${userId}.${expiryStr}`);
    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    const expiry = Number.parseInt(expiryStr, 10);
    if (!Number.isFinite(expiry) || Date.now() > expiry) return null;

    return { userId };
  } catch {
    return null;
  }
}

// Récupère l'utilisateur courant depuis le cookie de session (côté serveur).
// Lot 14.3 : un user soft-deleted ou banni est traité comme non-connecté
// (le cookie reste valide côté crypto mais la ressource est indisponible).
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;

  const session = verifySessionToken(token);
  if (!session) return null;

  const result = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  const user = result[0];
  if (!user) return null;
  // Compte soft-deleted → session invalide (RGPD droit à l'oubli)
  if (user.deletedAt) return null;
  // Compte banni admin → session invalide
  if (user.bannedAt) return null;
  return user;
}

// Récupère le business courant de l'utilisateur connecté.
//
// Lot 46 (F11) : respect de `users.active_business_id` si présent.
//  - Si l'user a sélectionné une vitrine active (via /api/my-businesses/switch)
//    ET qu'il en est bien owner → on renvoie CELLE-LÀ
//  - Sinon : fallback sur le premier business (comportement legacy Lot 1 → Lot 45)
//
// Le fallback garantit que tous les users historiques (activeBusinessId = null)
// continuent à voir leur 1ère vitrine sans effort. Aucune migration data requise.
export async function getCurrentBusiness() {
  const user = await getCurrentUser();
  if (!user) return null;

  // 1) Business actif explicitement sélectionné ?
  if (user.activeBusinessId) {
    const [active] = await db
      .select()
      .from(businesses)
      .where(and(eq(businesses.id, user.activeBusinessId), eq(businesses.ownerId, user.id)))
      .limit(1);
    if (active) return active;
    // Si on tombe ici : l'user a un activeBusinessId périmé (business supprimé,
    // ou changement d'owner). Le trigger DB `__vx_cleanup_active_business` est
    // censé remettre à NULL au DELETE, mais on garde ce fallback défensif.
  }

  // 2) Fallback : premier business trouvé (peut être null si l'user n'en a aucun)
  const [first] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.ownerId, user.id))
    .limit(1);
  return first || null;
}

// Récupère tous les établissements de l'utilisateur connecté.
export async function getCurrentUserBusinesses() {
  const user = await getCurrentUser();
  if (!user) return [];
  return db.select().from(businesses).where(eq(businesses.ownerId, user.id));
}
