/**
 * F5 (Lot 32) — /dashboard/team
 *
 * Gestion complète de l'équipe : liste + invite + change role + revoke.
 * Server component qui vérifie l'accès + gate entitlement, délègue l'interactivité
 * au composant client `<TeamManager>`.
 */

import { redirect } from "next/navigation";
import { getCurrentTeamContext } from "@/lib/team-context";
import { canUse } from "@/lib/entitlements";
import type { SubscriptionPlan } from "@/lib/permissions";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { UpgradeGate } from "@/components/entitlements/UpgradeGate";
import { TeamManager } from "./_components/TeamManager";
import { PageTitle } from "@/components/layout/PageTitle";
import { Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const ctx = await getCurrentTeamContext();
  if (!ctx) redirect("/login");

  // Charge le plan du owner du business (ce qui débloque team.enable)
  const [owner] = await db
    .select({ subscription: users.subscription })
    .from(users)
    .where(eq(users.id, ctx.business.ownerId))
    .limit(1);
  const ownerPlan = (owner?.subscription || "free") as SubscriptionPlan;
  const teamEnabled = canUse(ownerPlan, "team.enable");

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6 space-y-6">
      <PageTitle title="Équipe" />

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
          <Users className="h-5 w-5 text-slate-700 dark:text-slate-200" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Équipe</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Invitez vos collaborateurs et attribuez-leur des rôles.
          </p>
        </div>
      </div>

      {teamEnabled ? (
        <TeamManager currentRole={ctx.role} isOwner={ctx.isOwner} plan={ownerPlan} />
      ) : (
        <UpgradeGate feature="team.enable">
          <div />
        </UpgradeGate>
      )}
    </div>
  );
}
