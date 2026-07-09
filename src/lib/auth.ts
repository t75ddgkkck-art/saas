import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

// Coût bcrypt : 10 = ~100ms/hash (bon compromis prod).
// Augmenter à 12 si le hardware le permet et si le login rate limit est en place.
const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function getUserById(id: string) {
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] || null;
}

export async function getUserByEmail(email: string) {
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0] || null;
}

// ⚠️  Les anciennes fonctions `registerUser` / `loginUser` / `generateToken`
// ont été retirées : elles créaient un token random NON signé, jamais persisté,
// et faisaient doublon avec les routes /api/auth/*. La création de session
// signée passe désormais exclusivement par `createSessionToken()` dans
// `src/lib/session.ts`.
