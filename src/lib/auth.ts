import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function registerUser(email: string, password: string, firstName: string, lastName: string) {
  const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existingUser.length > 0) {
    throw new Error("Un utilisateur avec cet email existe déjà");
  }

  const passwordHash = await hashPassword(password);
  const result = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      firstName,
      lastName,
      role: "professional",
      subscription: "free",
    })
    .returning();

  return result[0];
}

export async function loginUser(email: string, password: string) {
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (result.length === 0) {
    throw new Error("Email ou mot de passe incorrect");
  }

  const user = result[0];
  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    throw new Error("Email ou mot de passe incorrect");
  }

  const token = generateToken();
  const expiresAt = Date.now() + TOKEN_EXPIRY;

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      subscription: user.subscription,
    },
    token,
    expiresAt,
  };
}

export async function getUserById(id: string) {
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] || null;
}

export async function getUserByEmail(email: string) {
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0] || null;
}
