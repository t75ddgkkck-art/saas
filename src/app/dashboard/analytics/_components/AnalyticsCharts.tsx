/**
 * Lot 36 — Charts recharts, séparés dans un fichier dédié pour lazy-loading.
 *
 * Recharts pèse ~150 KB gzipped — on ne veut pas l'inclure dans le bundle
 * initial pour les users qui ne visitent pas /dashboard/analytics.
 * Le parent utilise `dynamic(() => import(...))` avec ssr: false.
 */

"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// -----------------------------------------------------------------------------
// Timeline visites/uniques (aire empilée)
// -----------------------------------------------------------------------------

export interface TimelinePoint {
  date: string;
  visits: number;
  uniques: number;
}

export function TimelineChart({ data }: { data: TimelinePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="visitsGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="uniquesGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip
          contentStyle={{
            backgroundColor: "#0f172a",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area
          type="monotone"
          dataKey="visits"
          name="Visites"
          stroke="#6366f1"
          strokeWidth={2}
          fill="url(#visitsGradient)"
        />
        <Area
          type="monotone"
          dataKey="uniques"
          name="Visiteurs uniques"
          stroke="#10b981"
          strokeWidth={2}
          fill="url(#uniquesGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// -----------------------------------------------------------------------------
// Sources (bar horizontal)
// -----------------------------------------------------------------------------

const SOURCE_COLORS: Record<string, string> = {
  google: "#4285F4",
  direct: "#64748b",
  facebook: "#1877F2",
  instagram: "#E4405F",
  linkedin: "#0A66C2",
  twitter: "#000000",
  whatsapp: "#25D366",
  youtube: "#FF0000",
  tiktok: "#000000",
  qr: "#8b5cf6",
  email: "#f59e0b",
};

export interface SourceItem {
  source: string;
  count: number;
}

export function SourcesChart({ data }: { data: SourceItem[] }) {
  const enriched = data.map((d) => ({
    ...d,
    label: d.source.charAt(0).toUpperCase() + d.source.slice(1),
    color: SOURCE_COLORS[d.source] ?? "#94a3b8",
  }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={enriched} layout="vertical" margin={{ left: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={70} />
        <Tooltip
          contentStyle={{
            backgroundColor: "#0f172a",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Bar dataKey="count" name="Visites" radius={[0, 4, 4, 0]}>
          {enriched.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// -----------------------------------------------------------------------------
// Devices (donut)
// -----------------------------------------------------------------------------

const DEVICE_COLORS = ["#3b82f6", "#8b5cf6", "#ec4899"];

export interface DeviceItem {
  device: string;
  count: number;
}

export function DevicesChart({ data }: { data: DeviceItem[] }) {
  const enriched = data.map((d, i) => ({
    name: d.device.charAt(0).toUpperCase() + d.device.slice(1),
    value: d.count,
    color: DEVICE_COLORS[i % DEVICE_COLORS.length],
  }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={enriched}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={2}
          dataKey="value"
        >
          {enriched.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "#0f172a",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// -----------------------------------------------------------------------------
// Funnel horizontal (BarChart custom)
// -----------------------------------------------------------------------------

export interface FunnelStep {
  label: string;
  value: number;
  color: string;
}

export function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  const max = Math.max(...steps.map((s) => s.value), 1);
  return (
    <div className="space-y-3">
      {steps.map((step, i) => {
        const pct = Math.max(4, Math.round((step.value / max) * 100));
        const prev = i > 0 ? steps[i - 1].value : null;
        const dropPct =
          prev !== null && prev > 0 ? Math.round(((prev - step.value) / prev) * 100) : null;
        return (
          <div key={step.label} className="space-y-1">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-300">{step.label}</span>
              <span className="tabular-nums text-slate-900 dark:text-white">
                {step.value.toLocaleString("fr-FR")}
                {dropPct !== null && dropPct > 0 && (
                  <span className="ml-2 text-slate-500">-{dropPct}%</span>
                )}
              </span>
            </div>
            <div className="h-6 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-md transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: step.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Alias exports pour compatibilité (recharts non utilisé directement en top-level)
 */
export { LineChart, Line };
