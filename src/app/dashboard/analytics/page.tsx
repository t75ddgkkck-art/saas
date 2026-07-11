/**
 * Lot 36 — /dashboard/analytics — refonte avec fetch réel.
 *
 * Avant : 100% mock data (visitorData/sourceData/deviceData hardcodés).
 * Après : fetch /api/analytics avec période sélectionnable + delta % vs période
 * précédente + funnel visites→RDV→paiements.
 *
 * Charts lazy-loaded (recharts ~150 KB) via dynamic import.
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Eye,
  Users,
  MousePointer,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Loader2,
  Globe,
} from "lucide-react";
import { PageTitle } from "@/components/layout/PageTitle";
import { UpgradeGate } from "@/components/entitlements/UpgradeGate";
import { useEntitlement } from "@/hooks/useEntitlement";

// Lazy-load des charts recharts (bundle initial économisé)
const TimelineChart = dynamic(
  () => import("./_components/AnalyticsCharts").then((m) => m.TimelineChart),
  { ssr: false, loading: () => <ChartSkeleton height={280} /> }
);
const SourcesChart = dynamic(
  () => import("./_components/AnalyticsCharts").then((m) => m.SourcesChart),
  { ssr: false, loading: () => <ChartSkeleton height={280} /> }
);
const DevicesChart = dynamic(
  () => import("./_components/AnalyticsCharts").then((m) => m.DevicesChart),
  { ssr: false, loading: () => <ChartSkeleton height={240} /> }
);
const FunnelChart = dynamic(
  () => import("./_components/AnalyticsCharts").then((m) => m.FunnelChart),
  { ssr: false, loading: () => <ChartSkeleton height={180} /> }
);

type Period = "7d" | "30d" | "90d";

interface AnalyticsResponse {
  period: Period;
  upgradeRequired: boolean;
  summary: {
    totalVisits: number;
    uniqueVisitors: number;
    deltaVisitsPct: number;
  };
  timeline: { date: string; visits: number; uniques: number }[];
  sources?: { source: string; count: number }[];
  devices?: { device: string; count: number }[];
  topPaths?: { path: string | null; count: number }[];
  funnel: {
    visits: number;
    appointmentsCreated: number;
    appointmentsConfirmed?: number;
    appointmentsCompleted: number;
    paymentsCount: number;
    revenueCents: number;
  };
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("30d");
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const { allowed: advancedAllowed } = useEntitlement("analytics.advanced");

  const load = useCallback(async (p: Period) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics?period=${p}`);
      if (!res.ok) throw new Error("load");
      setData(await res.json());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(period);
  }, [load, period]);

  const funnelSteps = useMemo(() => {
    if (!data) return [];
    return [
      { label: "Visites vitrine", value: data.funnel.visits, color: "#6366f1" },
      { label: "Demandes RDV", value: data.funnel.appointmentsCreated, color: "#8b5cf6" },
      { label: "RDV réalisés", value: data.funnel.appointmentsCompleted, color: "#10b981" },
      { label: "Paiements encaissés", value: data.funnel.paymentsCount, color: "#f59e0b" },
    ];
  }, [data]);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageTitle title="Analytics" />

      {/* Header + sélecteur période */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Analytics</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Vue d&apos;ensemble de votre activité et de vos visiteurs
          </p>
        </div>
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>

      {loading && !data ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-hidden />
        </div>
      ) : !data ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center text-sm text-slate-500">
          Impossible de charger les analytics. Réessayez plus tard.
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi
              icon={<Eye className="h-4 w-4" />}
              label="Visites"
              value={data.summary.totalVisits}
              deltaPct={data.summary.deltaVisitsPct}
            />
            <Kpi
              icon={<Users className="h-4 w-4" />}
              label="Visiteurs uniques"
              value={data.summary.uniqueVisitors}
            />
            <Kpi
              icon={<MousePointer className="h-4 w-4" />}
              label="Demandes RDV"
              value={data.funnel.appointmentsCreated}
            />
            <Kpi
              icon={<TrendingUp className="h-4 w-4" />}
              label="CA encaissé"
              value={`${(data.funnel.revenueCents / 100).toLocaleString("fr-FR", {
                style: "currency",
                currency: "EUR",
                maximumFractionDigits: 0,
              })}`}
            />
          </div>

          {/* Timeline */}
          <Card
            title="Évolution des visites"
            description={`Sur les ${period === "7d" ? "7" : period === "30d" ? "30" : "90"} derniers jours`}
          >
            {data.timeline.length === 0 ? (
              <EmptyChart message="Aucune visite enregistrée sur cette période." />
            ) : (
              <TimelineChart data={data.timeline} />
            )}
          </Card>

          {/* Funnel — visible pour tous les plans */}
          <Card title="Funnel de conversion" description="Du visiteur au paiement">
            {funnelSteps.every((s) => s.value === 0) ? (
              <EmptyChart message="Aucune donnée. Publiez votre vitrine et partagez le lien !" />
            ) : (
              <FunnelChart steps={funnelSteps} />
            )}
          </Card>

          {/* Sources + Devices — Advanced (Pro+) */}
          {advancedAllowed && data.sources && data.devices ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Sources de trafic" description="D'où viennent vos visiteurs">
                {data.sources.length === 0 ? (
                  <EmptyChart message="Pas encore de données." />
                ) : (
                  <SourcesChart data={data.sources} />
                )}
              </Card>
              <Card title="Appareils" description="Mobile, ordinateur ou tablette">
                {data.devices.length === 0 ? (
                  <EmptyChart message="Pas encore de données." />
                ) : (
                  <DevicesChart data={data.devices} />
                )}
              </Card>
            </div>
          ) : (
            <UpgradeGate feature="analytics.advanced" mode="card">
              <div />
            </UpgradeGate>
          )}

          {/* Top paths — Advanced */}
          {advancedAllowed && data.topPaths && data.topPaths.length > 0 && (
            <Card title="Pages les plus consultées" description="Top 10">
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.topPaths.map((p) => (
                  <li key={p.path} className="flex items-center justify-between py-2 text-sm">
                    <span className="truncate text-slate-700 dark:text-slate-300">
                      {p.path ?? "/"}
                    </span>
                    <span className="tabular-nums font-medium text-slate-900 dark:text-white">
                      {p.count}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      {/* Aide contextuelle */}
      <div className="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-950/30 p-4 text-xs text-blue-900 dark:text-blue-200">
        💡 Les analytics respectent la vie privée : aucune donnée personnelle n&apos;est stockée
        (pas de cookie, pas d&apos;IP). Compatible RGPD par défaut, sans bandeau de consentement.
        <Link href="/confidentialite" className="ml-1 font-medium underline">
          En savoir plus
        </Link>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sous-composants
// -----------------------------------------------------------------------------

function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
      {(["7d", "30d", "90d"] as Period[]).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={`rounded-md px-3 py-1 text-xs font-medium ${
            value === p
              ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          {p === "7d" ? "7 jours" : p === "30d" ? "30 jours" : "90 jours"}
        </button>
      ))}
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  deltaPct,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  deltaPct?: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
        {typeof value === "number" ? value.toLocaleString("fr-FR") : value}
      </p>
      {deltaPct !== undefined && deltaPct !== 0 && (
        <p
          className={`mt-0.5 flex items-center gap-1 text-xs ${
            deltaPct > 0 ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {deltaPct > 0 ? (
            <TrendingUp className="h-3 w-3" aria-hidden />
          ) : (
            <TrendingDown className="h-3 w-3" aria-hidden />
          )}
          {deltaPct > 0 ? "+" : ""}
          {deltaPct}% vs période précédente
        </p>
      )}
    </div>
  );
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
        {description && <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function ChartSkeleton({ height }: { height: number }) {
  return (
    <div className="animate-pulse rounded-md bg-slate-100 dark:bg-slate-800" style={{ height }} />
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center rounded-md bg-slate-50 dark:bg-slate-800/40 py-12 text-center text-xs text-slate-500">
      <Globe className="mr-2 h-4 w-4" aria-hidden />
      {message}
      <Sparkles className="ml-2 h-4 w-4" aria-hidden />
    </div>
  );
}
