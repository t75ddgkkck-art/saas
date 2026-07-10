"use client";

/**
 * Journal des actions admin — lecture seule, dernières 50 par défaut.
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

interface AdminEvent {
  id: string;
  action: string;
  payload: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
  actorEmail: string | null;
  targetEmail: string | null;
}

export function AdminEventsLog() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>("");

  async function load() {
    setLoading(true);
    try {
      const url = new URL("/api/admin/events", window.location.origin);
      url.searchParams.set("limit", "50");
      if (filter) url.searchParams.set("action", filter);
      const res = await fetch(url.toString());
      if (res.ok) {
        const j = await res.json();
        setEvents(j.events || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-500">Filtrer :</span>
        {["", "ban_user", "unban_user", "override_plan", "refund"].map((a) => (
          <button
            key={a || "all"}
            type="button"
            onClick={() => setFilter(a)}
            className={`rounded-full px-3 py-1 text-xs ${
              filter === a
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            {a || "Tous"}
          </button>
        ))}
        <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
          {loading ? "…" : "↻"}
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <th className="py-2 pr-3">Date</th>
              <th className="py-2 pr-3">Action</th>
              <th className="py-2 pr-3">Admin</th>
              <th className="py-2 pr-3">Cible</th>
              <th className="py-2 pr-3">Payload</th>
              <th className="py-2 pr-3">IP</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr
                key={e.id}
                className="border-b border-slate-100 last:border-0 dark:border-slate-800/50"
              >
                <td className="py-2 pr-3 text-xs text-slate-500">
                  {new Date(e.createdAt).toLocaleString("fr-FR")}
                </td>
                <td className="py-2 pr-3">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs dark:bg-slate-800">
                    {e.action}
                  </span>
                </td>
                <td className="py-2 pr-3 text-xs">{e.actorEmail || "—"}</td>
                <td className="py-2 pr-3 text-xs">{e.targetEmail || "—"}</td>
                <td className="py-2 pr-3 max-w-xs truncate font-mono text-xs text-slate-500">
                  {e.payload ? JSON.stringify(e.payload) : "—"}
                </td>
                <td className="py-2 pr-3 font-mono text-xs text-slate-500">{e.ip || "—"}</td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-sm text-slate-500">
                  Aucun événement.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
