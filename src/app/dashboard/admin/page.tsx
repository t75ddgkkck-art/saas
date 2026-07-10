/**
 * Dashboard admin (Lot 13 monitoring).
 *
 * Server Component : la garde `getAdminUser()` s'exécute côté server,
 * on redirige vers /dashboard si l'user n'est pas admin (aucune fuite d'API).
 *
 * Sections :
 *  - Metrics business (users, subs, MRR, RDV, IA)
 *  - Liste users (recherche + ban/unban)
 *  - Audit log (admin_events)
 */

import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { getBusinessMetrics, getConversionRate30d, formatEurCents } from "@/lib/metrics";
import { AdminUsersTable } from "./_components/AdminUsersTable";
import { AdminEventsLog } from "./_components/AdminEventsLog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminDashboardPage() {
  const admin = await getAdminUser();
  if (!admin) redirect("/dashboard");

  // On peut charger les metrics côté server : cache 60s côté lib
  const [metrics, conversion] = await Promise.all([
    getBusinessMetrics(),
    getConversionRate30d(),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
          Admin — Vue d&apos;ensemble
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Connecté en tant que {admin.email}. Toutes les actions sont loggées.
        </p>
      </header>

      {/* KPIs business */}
      <section aria-labelledby="kpis-heading">
        <h2 id="kpis-heading" className="sr-only">
          Indicateurs clés
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="MRR estimé"
            value={formatEurCents(metrics.subscriptions.mrrEurCents)}
            hint={`${metrics.subscriptions.pro} Pro · ${metrics.subscriptions.premium} Premium`}
          />
          <KpiCard
            label="Utilisateurs"
            value={metrics.users.total.toLocaleString("fr-FR")}
            hint={`+${metrics.users.newLast7d} sur 7j · +${metrics.users.newLast30d} sur 30j`}
          />
          <KpiCard
            label="Conversion 30j"
            value={`${(conversion.ratio * 100).toFixed(1)} %`}
            hint={`${conversion.paid}/${conversion.registered} paient`}
          />
          <KpiCard
            label="Trials en cours"
            value={metrics.subscriptions.trialing.toLocaleString("fr-FR")}
            hint={`${metrics.subscriptions.pastDue} en past_due`}
          />
          <KpiCard
            label="RDV (30j)"
            value={metrics.appointments.last30d.toLocaleString("fr-FR")}
            hint={`${metrics.appointments.upcoming} à venir`}
          />
          <KpiCard
            label="Vitrines actives"
            value={metrics.businesses.activeLast30d.toLocaleString("fr-FR")}
            hint={`sur ${metrics.businesses.total} au total`}
          />
          <KpiCard
            label="IA (30j)"
            value={metrics.ai.totalCallsLast30d.toLocaleString("fr-FR")}
            hint={`≈ ${metrics.ai.totalCostUsd.toFixed(2)} $`}
          />
          <KpiCard
            label="Churn 30j"
            value={metrics.subscriptions.canceledLast30d.toLocaleString("fr-FR")}
            hint="abonnements annulés"
          />
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Données mises en cache 60 s · dernière MAJ {new Date(metrics.computedAt).toLocaleTimeString("fr-FR")}
        </p>
      </section>

      {/* Users table */}
      <section
        aria-labelledby="users-heading"
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6"
      >
        <h2 id="users-heading" className="mb-4 text-xl font-semibold text-slate-900 dark:text-slate-100">
          Utilisateurs
        </h2>
        <AdminUsersTable />
      </section>

      {/* Audit log */}
      <section
        aria-labelledby="events-heading"
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6"
      >
        <h2 id="events-heading" className="mb-4 text-xl font-semibold text-slate-900 dark:text-slate-100">
          Journal des actions admin
        </h2>
        <AdminEventsLog />
      </section>
    </div>
  );
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</div>}
    </div>
  );
}
