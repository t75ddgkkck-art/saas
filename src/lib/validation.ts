import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { PLAN_PERMISSIONS, SubscriptionPlan } from "@/lib/permissions";

// Vérifie qu'un user a une permission spécifique
export async function requirePermission(permission: keyof typeof PLAN_PERMISSIONS.free) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }), user: null };
  }

  const plan = (user.subscription || "free") as SubscriptionPlan;
  const hasPermission = PLAN_PERMISSIONS[plan][permission];

  if (!hasPermission) {
    return {
      error: NextResponse.json(
        {
          error: `Fonctionnalité réservée au plan ${permission.includes("Premium") ? "Premium" : "Pro"}`,
        },
        { status: 403 }
      ),
      user,
    };
  }

  return { error: null, user };
}

// Vérifie une limite (ex: nombre de clients, services, etc.)
export async function checkLimit(
  currentCount: number,
  limitKey: keyof typeof PLAN_PERMISSIONS.free
) {
  const user = await getCurrentUser();
  if (!user) {
    return { allowed: false, error: "Non authentifié" };
  }

  const plan = (user.subscription || "free") as SubscriptionPlan;
  const limit = PLAN_PERMISSIONS[plan][limitKey] as number;

  if (limit === -1) {
    return { allowed: true, error: null };
  }

  if (currentCount >= limit) {
    return {
      allowed: false,
      error: `Limite du plan ${plan} atteinte (${limit} maximum)`,
    };
  }

  return { allowed: true, error: null };
}

// Valide un email
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Normalise un téléphone
export function normalizePhone(phone: string): string {
  return phone.replace(/\s+/g, "").replace(/[^+\d]/g, "");
}

// Valide un téléphone français
export function isValidFrenchPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return /^\+33[1-9]\d{8}$/.test(normalized) || /^0[1-9]\d{8}$/.test(normalized);
}
