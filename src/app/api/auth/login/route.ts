import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword } from "@/lib/auth";
import { createSessionToken } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyCaptcha } from "@/lib/captcha";
import { recordLoginFailure, recordLoginSuccess } from "@/lib/brute-force-detector";
import { badRequest, handleApiError, unauthorized } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const TOKEN_EXPIRY_SEC = 7 * 24 * 60 * 60;

const LoginSchema = z.object({
  email: z.string().email("Email invalide").max(255),
  password: z.string().min(1, "Mot de passe requis").max(200),
  // Lot 19 : captcha optionnel côté schéma (obligatoire seulement en prod
  // via TURNSTILE_SECRET_KEY, le verifyCaptcha gère le skip auto en dev).
  captchaToken: z.string().optional(),
});

export async function POST(request: NextRequest) {
  // 5 tentatives / minute / IP — limite le brute-force
  const rl = checkRateLimit(request, { key: "auth:login", limit: 5, windowSec: 60 });
  if (!rl.ok) return rl.response;

  try {
    const json = await request.json().catch(() => null);
    const parsed = LoginSchema.safeParse(json);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues[0]?.message ?? "Données invalides");
    }
    const { email, password, captchaToken } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    // Lot 19 : captcha Turnstile. Skip auto en dev (pas de TURNSTILE_SECRET_KEY).
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      null;
    const captcha = await verifyCaptcha(captchaToken, { ip });
    if (!captcha.ok && captcha.reason !== "no_secret") {
      // On ne dit pas explicitement "captcha" pour ne pas donner d'info à un bot.
      // Le rate-limit + le message générique gèrent la posture globale.
      throw unauthorized("Vérification anti-robot échouée. Rechargez la page et réessayez.");
    }

    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    // On répond toujours le même message pour ne pas révéler l'existence d'un compte.
    const invalidCreds = unauthorized("Email ou mot de passe incorrect");
    // Lot 26 : helper local pour tracker l'échec ET throw (DRY)
    const fail = () => {
      recordLoginFailure(ip, { email: normalizedEmail });
      return invalidCreds;
    };

    if (userResult.length === 0) throw fail();

    const user = userResult[0];

    // Lot 14.3 soft delete : compte supprimé → on renvoie le même message
    // générique que "credentials invalides" pour ne pas révéler qu'il a
    // existé (anti-énumération). L'user a reçu un email de confirmation
    // au moment de la suppression, il sait où il en est.
    if (user.deletedAt) throw fail();

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) throw fail();

    // Lot 13 monitoring : compte banni par un admin → refus explicite.
    // Message spécifique ok ici (info connue de l'user, pas d'énumération possible).
    if (user.bannedAt) {
      throw unauthorized(
        "Ce compte a été suspendu. Contactez le support pour plus d'informations."
      );
    }

    // Lot 36 : pose lastLoginAt (utilisé par cron réactivation + analytics)
    // Fire-and-forget : ne doit pas ralentir la réponse login
    void db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id))
      .catch(() => {
        /* non bloquant */
      });

    const token = createSessionToken(user.id);
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_SEC * 1000);
    const secure =
      request.headers.get("x-forwarded-proto")?.split(",")[0].trim() === "https" ||
      new URL(request.url).protocol === "https:";

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        subscription: user.subscription,
      },
    });

    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      expires: expiresAt,
      path: "/",
    });

    // Lot 26 : login réussi → reset compteur brute-force pour cette IP
    // (évite qu'un user légitime qui a tapé son mdp 5× soit flag)
    recordLoginSuccess(ip);

    return response;
  } catch (err) {
    return handleApiError(err, { route: "/api/auth/login" });
  }
}
