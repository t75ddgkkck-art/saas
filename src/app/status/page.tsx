/**
 * Statuspage publique (Lot 16.5).
 *
 * Lit le healthcheck interne (`/api/health` du Lot 13) et l'affiche joliment.
 * Aucun secret, aucune donnée user → safe en public.
 * Revalidate 30s pour éviter de mitrailler l'API à chaque hit.
 */

import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Statut du service",
  description: "État en temps réel des services Vitrix (base de données, paiements, emails, IA).",
};

// Revalidation ISR : 30s → équilibre fraîcheur/coût.
export const revalidate = 30;

interface HealthCheck {
  name: string;
  ok: boolean;
  critical: boolean;
  latencyMs?: number;
  detail?: string;
}

interface HealthResponse {
  ok: boolean;
  checks: HealthCheck[];
  version?: string;
  env?: string;
  timestamp: string;
}

const LABELS: Record<string, string> = {
  db: "Base de données",
  stripe: "Paiements Stripe",
  resend: "Emails (Resend)",
  openai: "Intelligence artificielle",
  monitoring: "Monitoring (Sentry)",
  alerts: "Alerting webhook",
};

async function fetchHealth(): Promise<HealthResponse | null> {
  try {
    // Base URL absolue : nécessaire côté serveur pour aller sur son propre endpoint
    const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const res = await fetch(`${base}/api/health`, {
      // On veut la version fraîche à chaque revalidate ISR (pas de cache)
      cache: "no-store",
    });
    if (!res.ok && res.status !== 503) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function StatusPage() {
  const health = await fetchHealth();

  const overallOk = health?.ok ?? false;
  const checks = health?.checks ?? [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Link
          href="/"
          className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
        >
          ← Retour à Vitrix
        </Link>

        <h1 className="mt-6 text-3xl font-bold text-slate-900 dark:text-slate-100">
          Statut du service
        </h1>

        {/* Bandeau global */}
        <div
          className={`mt-6 rounded-2xl border p-5 ${
            overallOk
              ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-900/10"
              : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/10"
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className={`h-3 w-3 shrink-0 rounded-full ${
                overallOk ? "bg-emerald-500" : "bg-red-500"
              }`}
            />
            <p
              className={`text-lg font-semibold ${
                overallOk
                  ? "text-emerald-900 dark:text-emerald-100"
                  : "text-red-900 dark:text-red-100"
              }`}
            >
              {overallOk
                ? "Tous les services sont opérationnels"
                : "Incident en cours — nos équipes sont mobilisées"}
            </p>
          </div>
          {health?.timestamp && (
            <p className="mt-2 pl-6 text-xs text-slate-500 dark:text-slate-400">
              Dernière vérification :{" "}
              {new Date(health.timestamp).toLocaleString("fr-FR")}
            </p>
          )}
        </div>

        {/* Détail par service */}
        <ul className="mt-6 space-y-2" aria-label="État par service">
          {checks.map((c) => (
            <li
              key={c.name}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                    c.ok
                      ? "bg-emerald-500"
                      : c.critical
                        ? "bg-red-500"
                        : "bg-amber-500"
                  }`}
                />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {LABELS[c.name] || c.name}
                  </p>
                  {c.detail && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {c.detail}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {c.ok ? "opérationnel" : c.critical ? "en panne" : "dégradé"}
                </p>
                {c.latencyMs !== undefined && (
                  <p className="text-xs text-slate-400">{c.latencyMs} ms</p>
                )}
              </div>
            </li>
          ))}
        </ul>

        {health?.version && (
          <p className="mt-6 text-center text-xs text-slate-400">
            Version {health.version} · {health.env}
          </p>
        )}

        <p className="mt-4 text-center text-xs text-slate-400">
          Les incidents majeurs sont également annoncés sur notre email support.
        </p>
      </div>
    </div>
  );
}
