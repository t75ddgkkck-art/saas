import { cookies } from "next/headers";
import { createHmac } from "crypto";
import { db } from "@/db";
import { users, businesses } from "@/db/schema";
import { eq } from "drizzle-orm";

const SECRET = process.env.NEXTAUTH_SECRET || "dev-secret-change-me";
const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

// Crée un token signé contenant l'ID utilisateur : base64(userId.expiry).signature
export function createSessionToken(userId: string): string {
  const expiry = Date.now() + TOKEN_EXPIRY_MS;
  const payload = `${userId}.${expiry}`;
  const signature = createHmac("sha256", SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

// Vérifie et décode un token de session
export function verifySessionToken(token: string): { userId: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const parts = decoded.split(".");
    if (parts.length !== 3) return null;
    const [userId, expiryStr, signature] = parts;
    const payload = `${userId}.${expiryStr}`;
    const expectedSignature = createHmac("sha256", SECRET).update(payload).digest("hex");
    if (signature !== expectedSignature) return null;
    if (Date.now() > parseInt(expiryStr, 10)) return null;
    return { userId };
  } catch {
    return null;
  }
}

// Récupère l'utilisateur courant depuis le cookie de session (côté serveur)
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;

  const session = verifySessionToken(token);
  if (!session) return null;

  const result = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  return result[0] || null;
}

// Récupère le business courant de l'utilisateur connecté
export async function getCurrentBusiness() {
  const user = await getCurrentUser();
  if (!user) return null;

  const result = await db.select().from(businesses).where(eq(businesses.ownerId, user.id)).limit(1);
  return result[0] || null;
}

// Récupère tous les établissements de l'utilisateur connecté
export async function getCurrentUserBusinesses() {
  const user = await getCurrentUser();
  if (!user) return [];

  return db.select().from(businesses).where(eq(businesses.ownerId, user.id));
}
