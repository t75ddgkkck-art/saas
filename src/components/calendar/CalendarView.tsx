/**
 * F4 (Lot 33) — Vue calendrier jour/semaine/mois avec drag&drop.
 *
 * 100% maison, 0 dep externe. Utilise :
 *  - CSS Grid pour la structure semaine (7 cols × N slots)
 *  - HTML5 native drag & drop (dragstart, dragover, drop) pour reprogrammer
 *  - Absolute positioning des events avec top/height calculés depuis les heures
 *
 * Props :
 *  - events : liste des RDV à afficher
 *  - onEventClick : ouvrir un modal d'édition
 *  - onEventDrop : callback quand l'user relâche un event sur une nouvelle date/heure
 *
 * Le composant est déterministe (pas d'état interne persistant à part la vue
 * et l'anchor date).
 */

"use client";

import { useMemo, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addDays,
  addMonths,
  colorForKey,
  durationToPx,
  hourSlots,
  isSameDay,
  isToday,
  monthGrid,
  rangeLabel,
  startOfMonth,
  timeToPx,
  toIsoDate,
  weekDays,
  DAYS_FR,
} from "./calendar-utils";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

// Type renommé pour éviter le conflit avec le composant `CalendarView` exporté ci-dessous.
export type CalendarViewMode = "day" | "week" | "month";

export interface CalendarEvent {
  id: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM */
  startTime: string;
  /** HH:MM */
  endTime: string;
  status: "pending" | "confirmed" | "cancelled" | "completed" | "no_show";
  clientLabel?: string | null;
  /** Clé utilisée pour coloration (assignedToUserId ou service). */
  colorKey?: string | null;
  /** True si c'est un bloc d'indispo (rendu différent, non-draggable). */
  isUnavailability?: boolean;
}

interface CalendarViewProps {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  /** Appelé après drop réussi. Doit persister via PATCH puis re-fetch. */
  onEventDrop?: (event: CalendarEvent, newDate: string, newStartTime: string) => void;
  /** Callback clic sur un slot vide (créer nouveau RDV pré-rempli). */
  onSlotClick?: (date: string, startTime: string) => void;
  /** Heure de début / fin de la grille (défauts 7h → 21h). */
  startHour?: number;
  endHour?: number;
}

// -----------------------------------------------------------------------------
// Composant principal
// -----------------------------------------------------------------------------

export function CalendarView({
  events,
  onEventClick,
  onEventDrop,
  onSlotClick,
  startHour = 7,
  endHour = 21,
}: CalendarViewProps) {
  const [view, setView] = useState<CalendarViewMode>("week");
  const [anchor, setAnchor] = useState<Date>(new Date());

  // Navigation
  const goPrev = useCallback(() => {
    setAnchor((a) => (view === "month" ? addMonths(a, -1) : addDays(a, view === "week" ? -7 : -1)));
  }, [view]);
  const goNext = useCallback(() => {
    setAnchor((a) => (view === "month" ? addMonths(a, 1) : addDays(a, view === "week" ? 7 : 1)));
  }, [view]);
  const goToday = useCallback(() => setAnchor(new Date()), []);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      {/* Header : navigation + switch de vue */}
      <div className="flex flex-col gap-3 border-b border-slate-200 dark:border-slate-800 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goPrev}
            className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Précédent"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded-md px-3 py-1 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Aujourd&apos;hui
          </button>
          <button
            type="button"
            onClick={goNext}
            className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Suivant"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
          <h2 className="ml-3 text-sm font-semibold capitalize text-slate-900 dark:text-white">
            {rangeLabel(view, anchor)}
          </h2>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
          {(["day", "week", "month"] as CalendarViewMode[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                view === v
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {v === "day" ? "Jour" : v === "week" ? "Semaine" : "Mois"}
            </button>
          ))}
        </div>
      </div>

      {/* Corps du calendrier */}
      <div className="overflow-auto">
        {view === "month" ? (
          <MonthGrid
            anchor={anchor}
            events={events}
            onEventClick={onEventClick}
            onEventDrop={onEventDrop}
            onSlotClick={onSlotClick}
          />
        ) : (
          <TimeGrid
            days={view === "day" ? [anchor] : weekDays(anchor)}
            events={events}
            onEventClick={onEventClick}
            onEventDrop={onEventDrop}
            onSlotClick={onSlotClick}
            startHour={startHour}
            endHour={endHour}
          />
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Vue Jour / Semaine (grille horaire)
// -----------------------------------------------------------------------------

const PX_PER_HOUR = 48;

function TimeGrid({
  days,
  events,
  onEventClick,
  onEventDrop,
  onSlotClick,
  startHour,
  endHour,
}: {
  days: Date[];
  events: CalendarEvent[];
  onEventClick?: (e: CalendarEvent) => void;
  onEventDrop?: (e: CalendarEvent, d: string, t: string) => void;
  onSlotClick?: (d: string, t: string) => void;
  startHour: number;
  endHour: number;
}) {
  const slots = useMemo(() => hourSlots(startHour, endHour, 60), [startHour, endHour]);
  const totalHeight = (endHour - startHour + 1) * PX_PER_HOUR;

  // Groupe les events par date pour lookup rapide
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    }
    return map;
  }, [events]);

  return (
    <div className="flex">
      {/* Colonne des heures */}
      <div
        className="w-14 shrink-0 border-r border-slate-200 dark:border-slate-800"
        style={{ paddingTop: 40 }} // décalage égal à hauteur du header jours
      >
        {slots.map((slot) => (
          <div
            key={slot}
            style={{ height: PX_PER_HOUR }}
            className="border-t border-slate-100 dark:border-slate-800/60 text-right pr-2 pt-0.5 text-[10px] text-slate-400"
          >
            {slot}
          </div>
        ))}
      </div>
      {/* Grille jours */}
      <div
        className="flex-1 min-w-0 grid"
        style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
      >
        {days.map((day) => {
          const iso = toIsoDate(day);
          const dayEvents = eventsByDate.get(iso) ?? [];
          return (
            <DayColumn
              key={iso}
              day={day}
              events={dayEvents}
              totalHeight={totalHeight}
              slots={slots}
              onEventClick={onEventClick}
              onEventDrop={onEventDrop}
              onSlotClick={onSlotClick}
              startHour={startHour}
            />
          );
        })}
      </div>
    </div>
  );
}

function DayColumn({
  day,
  events,
  totalHeight,
  slots,
  onEventClick,
  onEventDrop,
  onSlotClick,
  startHour,
}: {
  day: Date;
  events: CalendarEvent[];
  totalHeight: number;
  slots: string[];
  onEventClick?: (e: CalendarEvent) => void;
  onEventDrop?: (e: CalendarEvent, d: string, t: string) => void;
  onSlotClick?: (d: string, t: string) => void;
  startHour: number;
}) {
  const iso = toIsoDate(day);
  const today = isToday(day);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData("application/vnd.vitrix.event");
      if (!raw) return;
      try {
        const ev = JSON.parse(raw) as CalendarEvent;
        // Calcule le slot d'atterrissage depuis la position Y
        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top - 40; // -40 pour le header
        const minutes = Math.max(0, Math.round((y / PX_PER_HOUR) * 60));
        const snappedMin = Math.round(minutes / 15) * 15; // snap 15min
        const totalMin = startHour * 60 + snappedMin;
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        const newStart = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        onEventDrop?.(ev, iso, newStart);
      } catch {
        // ignore parse errors
      }
    },
    [iso, onEventDrop, startHour]
  );

  return (
    <div
      className="relative border-r border-slate-200 dark:border-slate-800 last:border-r-0"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Header nom du jour */}
      <div
        className={`sticky top-0 z-10 flex h-10 items-center justify-center border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium ${
          today ? "text-indigo-600 dark:text-indigo-400" : "text-slate-700 dark:text-slate-300"
        }`}
      >
        {DAYS_FR[(day.getDay() + 6) % 7]} {day.getDate()}
      </div>
      {/* Lignes horaires + slots cliquables */}
      <div className="relative" style={{ height: totalHeight }}>
        {slots.map((slot) => (
          <button
            key={slot}
            type="button"
            onClick={() => onSlotClick?.(iso, slot)}
            style={{ height: PX_PER_HOUR }}
            className="block w-full border-t border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
            aria-label={`Créer un RDV le ${iso} à ${slot}`}
          />
        ))}
        {/* Ligne "maintenant" si aujourd'hui */}
        {today && <NowIndicator startHour={startHour} />}
        {/* Events positionnés en absolu */}
        {events.map((ev) => (
          <EventBlock key={ev.id} event={ev} startHour={startHour} onClick={onEventClick} />
        ))}
      </div>
    </div>
  );
}

function NowIndicator({ startHour }: { startHour: number }) {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const top = timeToPx(currentTime, startHour, PX_PER_HOUR);
  if (top < 0) return null;
  return (
    <div className="pointer-events-none absolute left-0 right-0 z-20" style={{ top }} aria-hidden>
      <div className="h-0.5 bg-red-500" />
      <div className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
    </div>
  );
}

function EventBlock({
  event,
  startHour,
  onClick,
}: {
  event: CalendarEvent;
  startHour: number;
  onClick?: (e: CalendarEvent) => void;
}) {
  const top = timeToPx(event.startTime, startHour, PX_PER_HOUR);
  const height = Math.max(20, durationToPx(event.startTime, event.endTime, PX_PER_HOUR) - 2);
  const color = event.isUnavailability ? "#64748b" : colorForKey(event.colorKey ?? event.id);
  const isCancelled = event.status === "cancelled";

  const onDragStart = useCallback(
    (e: React.DragEvent) => {
      if (event.isUnavailability) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("application/vnd.vitrix.event", JSON.stringify(event));
    },
    [event]
  );

  return (
    <button
      type="button"
      draggable={!event.isUnavailability}
      onDragStart={onDragStart}
      onClick={() => onClick?.(event)}
      className={`absolute left-1 right-1 overflow-hidden rounded-md text-left text-[11px] shadow-sm hover:shadow-md transition cursor-pointer z-10 ${
        isCancelled ? "opacity-50 line-through" : ""
      } ${event.isUnavailability ? "cursor-not-allowed" : ""}`}
      style={{
        top,
        height,
        background: color,
        color: "white",
        borderLeft: `3px solid ${darken(color)}`,
      }}
      aria-label={`${event.title} de ${event.startTime} à ${event.endTime}`}
    >
      <div className="px-2 py-1 leading-tight">
        <div className="truncate font-semibold">{event.title}</div>
        {event.clientLabel && (
          <div className="truncate text-[10px] opacity-90">{event.clientLabel}</div>
        )}
        {height >= 40 && (
          <div className="mt-0.5 text-[10px] opacity-80">
            {event.startTime} – {event.endTime}
          </div>
        )}
      </div>
    </button>
  );
}

/** Assombrit une couleur hex de ~15% pour la bordure gauche. */
function darken(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 0xff) - 40);
  const g = Math.max(0, ((n >> 8) & 0xff) - 40);
  const b = Math.max(0, (n & 0xff) - 40);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// -----------------------------------------------------------------------------
// Vue Mois (grille 7×6)
// -----------------------------------------------------------------------------

function MonthGrid({
  anchor,
  events,
  onEventClick,
  onEventDrop,
  onSlotClick,
}: {
  anchor: Date;
  events: CalendarEvent[];
  onEventClick?: (e: CalendarEvent) => void;
  onEventDrop?: (e: CalendarEvent, d: string, t: string) => void;
  onSlotClick?: (d: string, t: string) => void;
}) {
  const cells = useMemo(() => monthGrid(anchor), [anchor]);
  const anchorMonth = startOfMonth(anchor).getMonth();
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    }
    return map;
  }, [events]);

  return (
    <div className="grid grid-cols-7">
      {DAYS_FR.map((label) => (
        <div
          key={label}
          className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500"
        >
          {label}
        </div>
      ))}
      {cells.map((cell) => {
        const iso = toIsoDate(cell);
        const dayEvents = eventsByDate.get(iso) ?? [];
        const outOfMonth = cell.getMonth() !== anchorMonth;
        const today = isToday(cell);
        return (
          <div
            key={iso}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              const raw = e.dataTransfer.getData("application/vnd.vitrix.event");
              if (!raw) return;
              try {
                const ev = JSON.parse(raw) as CalendarEvent;
                // En vue mois on garde le startTime existant
                onEventDrop?.(ev, iso, ev.startTime);
              } catch {
                /* ignore */
              }
            }}
            className={`min-h-[92px] border-b border-r border-slate-100 dark:border-slate-800 p-1 ${
              outOfMonth ? "bg-slate-50/50 dark:bg-slate-900/40" : ""
            }`}
          >
            <button
              type="button"
              onClick={() => onSlotClick?.(iso, "09:00")}
              className={`mb-0.5 block w-full text-left text-[11px] font-medium ${
                today
                  ? "text-indigo-600 dark:text-indigo-400"
                  : outOfMonth
                    ? "text-slate-400"
                    : "text-slate-700 dark:text-slate-300"
              } hover:underline`}
            >
              {cell.getDate()}
            </button>
            <div className="space-y-0.5">
              {dayEvents.slice(0, 3).map((ev) => (
                <MonthEventPill key={ev.id} event={ev} onClick={onEventClick} />
              ))}
              {dayEvents.length > 3 && (
                <div className="text-[10px] text-slate-500 pl-1">
                  +{dayEvents.length - 3} autres
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonthEventPill({
  event,
  onClick,
}: {
  event: CalendarEvent;
  onClick?: (e: CalendarEvent) => void;
}) {
  const color = event.isUnavailability ? "#64748b" : colorForKey(event.colorKey ?? event.id);
  return (
    <button
      type="button"
      draggable={!event.isUnavailability}
      onDragStart={(e) => {
        if (event.isUnavailability) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("application/vnd.vitrix.event", JSON.stringify(event));
      }}
      onClick={() => onClick?.(event)}
      className={`block w-full truncate rounded px-1 text-left text-[10px] leading-tight hover:opacity-90 ${
        event.status === "cancelled" ? "line-through opacity-60" : ""
      }`}
      style={{ background: color, color: "white" }}
      aria-label={event.title}
    >
      <span className="font-semibold">{event.startTime}</span> {event.title}
    </button>
  );
}
