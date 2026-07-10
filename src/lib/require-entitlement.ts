/**
 * F1 (Lot 29) — Guard API centralisé pour les entitlements.
 *
 * Usage dans une route API :
 *   export async function POST(req: NextRequest) {
 *     try {
 *       const { user } = await requireEntitlement("ai.chat");
 *       // ... logique métier ...
 *     } catch (err) {
 *       return handleApiError(err, { route: "POST /api/ai-chat" });
 *     }
 *   }
 *
 * Comportement :
 * - Pas de session → 401 UNAUTHORIZED
 * - Session + plan insuffisant → 402 PLAN_REQUIRED (avec `requiredPlan` dans body)
 * - Session + plan OK → renvoie `{ user, plan }`
 *
 * Le 402 est reconnu par le composant `<UpgradeGate>` côté client pour
 * afficher un CTA "Passez Pro/Premium" contextuel.
 */

import { getCurrentUser } from "@/lib/session";
import { unauthorized, paymentRequired } from "@/lib/api-error";
import { canUse, getRequiredPlan, type FeatureKey } from "@/lib/entitlements";
import type { SubscriptionPlan } from "@/lib/permissions";

export interface EntitlementContext {
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
  plan: SubscriptionPlan;
}

/**
 * Vérifie que l'utilisateur connecté a accès à la feature demandée.
 * Throw un `HttpError` (401 ou 402) sinon.
 *
 * Note : `getCurrentUser` filtre déjà les comptes soft-deleted et bannis.
 */
export async function requireEntitlement(feature: FeatureKey): Promise<EntitlementContext> {
  const user = await getCurrentUser();
  if (!user) {
    throw unauthorized();
  }

  const plan = (user.subscription || "free") as SubscriptionPlan;

  if (!canUse(plan, feature)) {
    const requiredPlan = getRequiredPlan(feature);
    throw paymentRequired(
      `Cette fonctionnalité nécessite le plan ${requiredPlan === "premium" ? "Premium" : "Pro"}.`,
      {
        requiredPlan,
        currentPlan: plan,
        feature,
      }
    );
  }

  return { user, plan };
}

/**
 * Variante non-throw : renvoie `null` au lieu de throw, pour les cas où
 * on veut brancher sur l'accès (ex : afficher un champ "advanced" côté
 * réponse d'une route qui existe pour tous les plans).
 */
export async function tryEntitlement(feature: FeatureKey): Promise<EntitlementContext | null> {
  try {
    return await requireEntitlement(feature);
  } catch {
    return null;
  }
}
