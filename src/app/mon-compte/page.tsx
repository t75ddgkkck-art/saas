/**
 * F3 (Lot 31) — /mon-compte
 *
 * Dashboard client final : vue synthétique de tous les RDV, devis, businesses.
 * Server component qui redirige vers /mon-compte/login si pas connecté.
 * Charge les données via les routes /api/client/* côté client (interactivité).
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentClient } from "@/lib/client-session";
import { ClientDashboard } from "./_components/ClientDashboard";

export const dynamic = "force-dynamic";

export default async function MonComptePage() {
  const client = await getCurrentClient();
  if (!client) {
    redirect("/mon-compte/login");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Mon espace</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{client.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/annuaire"
            className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Trouver un pro
          </Link>
          <form action="/api/client/logout" method="POST">
            <button
              type="submit"
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </div>

      <ClientDashboard />
    </div>
  );
}
