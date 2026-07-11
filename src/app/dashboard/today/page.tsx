/**
 * F6 (Lot 35) — /dashboard/today — Vue "Aujourd'hui" mobile-first.
 *
 * Server component qui charge :
 *  - Les RDV du jour (avec client + adresse)
 *  - Le business courant pour géoloc météo
 *
 * Puis délègue à <TodayView> côté client pour l'interactivité.
 */

import { redirect } from "next/navigation";
import { db } from "@/db";
import { appointments, clients } from "@/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import { getCurrentTeamContext } from "@/lib/team-context";
import { PageTitle } from "@/components/layout/PageTitle";
import { TodayView } from "./_components/TodayView";
import { WeatherWidget } from "./_components/WeatherWidget";

export const dynamic = "force-dynamic";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function TodayPage() {
  const ctx = await getCurrentTeamContext();
  if (!ctx) redirect("/login");

  const today = todayIso();

  const rows = await db
    .select({
      id: appointments.id,
      title: appointments.title,
      description: appointments.description,
      date: appointments.date,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      status: appointments.status,
      clientId: appointments.clientId,
      clientFirstName: clients.firstName,
      clientLastName: clients.lastName,
      clientPhone: clients.phone,
      clientAddress: clients.address,
    })
    .from(appointments)
    .leftJoin(clients, eq(clients.id, appointments.clientId))
    .where(
      and(
        eq(appointments.businessId, ctx.business.id),
        eq(appointments.date, today),
        isNull(appointments.deletedAt)
      )
    )
    .orderBy(asc(appointments.startTime));

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-3 sm:p-6">
      <PageTitle title="Aujourd'hui" />

      {/* Header contextuel */}
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Aujourd&apos;hui</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 capitalize">
          {new Date().toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
      </header>

      {/* Widget météo (masqué si géoloc refusée + API down) */}
      <WeatherWidget locationLabel={ctx.business.city ?? undefined} />

      {/* Liste des RDV */}
      <TodayView initialAppointments={rows} />
    </div>
  );
}
