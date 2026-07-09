"use client";

import { Clock } from "lucide-react";
import { DAYS } from "@/lib/utils";
import { t, type Lang } from "@/lib/i18n";

export interface WorkingHoursCardProps {
  hours: Array<{
    id: string;
    dayOfWeek: number;
    startTime: string | null;
    endTime: string | null;
    isClosed: boolean;
  }>;
  lang?: Lang;
}

/**
 * Bloc "Horaires d'ouverture" de la vitrine publique.
 * Extrait de PublicPage.tsx (voir sections/README.md).
 */
export function WorkingHoursCard({ hours, lang = "fr" }: WorkingHoursCardProps) {
  if (hours.length === 0) return null;

  return (
    <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
        <Clock className="h-5 w-5" aria-hidden="true" />
        {t(lang, "hours")}
      </h2>
      <div className="mt-4 space-y-2.5">
        {hours.map((hour) => (
          <div key={hour.id} className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {DAYS[hour.dayOfWeek]}
            </span>
            {hour.isClosed ? (
              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {t(lang, "closed")}
              </span>
            ) : (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                {hour.startTime} - {hour.endTime}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
