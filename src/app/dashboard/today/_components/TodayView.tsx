/**
 * F6 (Lot 35) — <TodayView> : liste interactive des RDV du jour.
 *
 * Composant client qui :
 *  - Gère le refetch après chaque action (transition, encaissement, note)
 *  - Affiche un bandeau "prochain RDV dans Xh Xm" (countdown)
 *  - Affiche KPIs synthétiques (X à venir, Y terminés, revenus)
 *  - EmptyState si aucun RDV
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, Clock, CheckCircle2, TrendingUp } from "lucide-react";
import { TodayAppointmentCard, type TodayAppointment } from "./TodayAppointmentCard";

interface Props {
  initialAppointments: TodayAppointment[];
}

export function TodayView({ initialAppointments }: Props) {
  const [items, setItems] = useState<TodayAppointment[]>(initialAppointments);
  const [now, setNow] = useState<Date>(() => new Date());

  // Refresh time toutes les 30s pour le countdown
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const refetch = useCallback(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch(`/api/appointments?from=${today}&to=${today}`);
      if (!res.ok) return;
      const data = await res.json();
      // L'API renvoie clientPhone/clientFirstName mais pas clientAddress.
      // Pour la Today view on garde l'address venant du server component initial.
      // → On merge les listes en préservant address.
      const currentById = new Map(items.map((i) => [i.id, i]));
      const merged: TodayAppointment[] = (data.appointments ?? []).map((a: TodayAppointment) => ({
        ...a,
        clientAddress: currentById.get(a.id)?.clientAddress ?? null,
      }));
      setItems(merged);
    } catch {
      /* silent */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // KPIs
  const kpi = useMemo(() => {
    const total = items.length;
    const completed = items.filter((i) => i.status === "completed").length;
    const upcoming = items.filter(
      (i) => i.status === "pending" || i.status === "confirmed" || i.status === "en_route"
    ).length;
    const inProgress = items.filter((i) => i.status === "in_progress").length;
    return { total, completed, upcoming, inProgress };
  }, [items]);

  // Prochain RDV (upcoming, chronologiquement)
  const nextAppt = useMemo(() => {
    const upcomingList = items
      .filter((i) => i.status === "confirmed" || i.status === "pending" || i.status === "en_route")
      .map((i) => ({
        item: i,
        startDate: new Date(`${i.date}T${i.startTime}:00`),
      }))
      .filter((x) => x.startDate.getTime() > now.getTime() - 5 * 60_000) // tolère -5min
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    return upcomingList[0] ?? null;
  }, [items, now]);

  const countdown = useMemo(() => {
    if (!nextAppt) return null;
    const diff = nextAppt.startDate.getTime() - now.getTime();
    if (diff <= 0) return { text: "maintenant", urgent: true };
    const min = Math.round(diff / 60_000);
    if (min < 60) return { text: `dans ${min} min`, urgent: min <= 15 };
    const h = Math.floor(min / 60);
    const remainingMin = min % 60;
    return { text: `dans ${h}h${String(remainingMin).padStart(2, "0")}`, urgent: false };
  }, [nextAppt, now]);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-8 text-center">
        <Calendar className="mx-auto mb-3 h-10 w-10 text-slate-400" aria-hidden />
        <h2 className="mb-1 text-base font-semibold text-slate-900 dark:text-white">
          Rien au programme aujourd&apos;hui
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          Profitez-en pour préparer vos prochains chantiers ✨
        </p>
        <Link
          href="/dashboard/appointments"
          className="inline-flex rounded-md bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 text-sm font-medium"
        >
          Voir tous mes rendez-vous
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs — 3 pastilles */}
      <div className="grid grid-cols-3 gap-2">
        <Kpi label="À venir" value={kpi.upcoming} tone="blue" icon={Clock} />
        <Kpi label="En cours" value={kpi.inProgress} tone="purple" icon={TrendingUp} />
        <Kpi label="Terminés" value={kpi.completed} tone="emerald" icon={CheckCircle2} />
      </div>

      {/* Bandeau prochain RDV */}
      {nextAppt && countdown && (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            countdown.urgent
              ? "bg-amber-100 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200"
              : "bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200"
          }`}
        >
          <p className="font-semibold">🔔 Prochain RDV {countdown.text}</p>
          <p className="mt-0.5 text-xs">
            {nextAppt.item.startTime} — {nextAppt.item.title}
          </p>
        </div>
      )}

      {/* Liste chronologique */}
      <div className="space-y-3">
        {items.map((apt) => (
          <TodayAppointmentCard key={apt.id} appointment={apt} onChanged={refetch} />
        ))}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// KPI pastille
// -----------------------------------------------------------------------------

function Kpi({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: "blue" | "purple" | "emerald";
  icon: typeof Clock;
}) {
  const toneCls =
    tone === "blue"
      ? "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40"
      : tone === "purple"
        ? "text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40"
        : "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40";
  return (
    <div className={`rounded-xl px-3 py-2 ${toneCls}`}>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide opacity-80">
        <Icon className="h-3 w-3" aria-hidden />
        {label}
      </div>
      <p className="mt-0.5 text-2xl font-bold leading-none">{value}</p>
    </div>
  );
}
