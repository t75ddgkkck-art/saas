/**
 * F4 (Lot 33) — Panel calendrier pour /dashboard/appointments.
 *
 * Fetch les RDV + indisponibilités, gère drag&drop → PATCH via API,
 * délègue le rendu à `<CalendarView>`.
 *
 * Design découplé de la vue liste (l'user peut basculer entre les 2).
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarView, type CalendarEvent } from "./CalendarView";
import { useToast } from "@/components/ui/Toast";

interface ApiAppointment {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  status: "pending" | "confirmed" | "cancelled" | "completed" | "no_show";
  clientFirstName: string | null;
  clientLastName: string | null;
  assignedToUserId?: string | null;
}

interface ApiUnavail {
  id: string;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  userId: string | null;
  color: string | null;
}

interface Props {
  onEventClick?: (id: string) => void;
  onSlotClick?: (date: string, startTime: string) => void;
  /** Reload signal — incrémenter pour forcer refetch depuis le parent. */
  reloadKey?: number;
}

export function AppointmentsCalendarPanel({ onEventClick, onSlotClick, reloadKey = 0 }: Props) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [apts, unavails] = await Promise.all([
        fetch("/api/appointments").then((r) => r.json()),
        fetch("/api/unavailabilities").then((r) => (r.ok ? r.json() : { unavailabilities: [] })),
      ]);
      const aptEvents: CalendarEvent[] = (apts.appointments ?? []).map((a: ApiAppointment) => ({
        id: a.id,
        title: a.title,
        date: a.date,
        startTime: a.startTime,
        endTime: a.endTime,
        status: a.status,
        clientLabel: [a.clientFirstName, a.clientLastName].filter(Boolean).join(" ") || null,
        // Coloration par membre assigné (fallback : par ID du RDV pour palette stable)
        colorKey: a.assignedToUserId,
        isUnavailability: false,
      }));
      const unavailEvents: CalendarEvent[] = (unavails.unavailabilities ?? []).map(
        (u: ApiUnavail) => ({
          id: u.id,
          title: u.title,
          date: u.date,
          startTime: u.startTime ?? "00:00",
          endTime: u.endTime ?? "23:59",
          status: "confirmed" as const,
          clientLabel: null,
          colorKey: null,
          isUnavailability: true,
        })
      );
      setEvents([...aptEvents, ...unavailEvents]);
    } catch {
      toast.error("Impossible de charger le calendrier");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll, reloadKey]);

  const handleDrop = useCallback(
    async (ev: CalendarEvent, newDate: string, newStartTime: string) => {
      // Calcule le nouveau endTime en conservant la durée
      const [sh, sm] = ev.startTime.split(":").map(Number);
      const [eh, em] = ev.endTime.split(":").map(Number);
      const durationMin = (eh - sh) * 60 + (em - sm);
      const [nsh, nsm] = newStartTime.split(":").map(Number);
      const totalStart = nsh * 60 + nsm;
      const totalEnd = totalStart + durationMin;
      const newEndTime = `${String(Math.floor(totalEnd / 60)).padStart(2, "0")}:${String(totalEnd % 60).padStart(2, "0")}`;

      // Optimistic update
      setEvents((prev) =>
        prev.map((e) =>
          e.id === ev.id ? { ...e, date: newDate, startTime: newStartTime, endTime: newEndTime } : e
        )
      );

      try {
        const res = await fetch(`/api/appointments/${ev.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: newDate,
            startTime: newStartTime,
            endTime: newEndTime,
          }),
        });
        if (!res.ok) throw new Error("patch");
        toast.success(`RDV déplacé au ${newDate} ${newStartTime}`);
      } catch {
        toast.error("Impossible de déplacer le RDV");
        void fetchAll(); // rollback
      }
    },
    [fetchAll, toast]
  );

  if (loading && events.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center text-sm text-slate-500">
        Chargement du calendrier…
      </div>
    );
  }

  return (
    <CalendarView
      events={events}
      onEventClick={(ev) => onEventClick?.(ev.id)}
      onEventDrop={handleDrop}
      onSlotClick={onSlotClick}
    />
  );
}
