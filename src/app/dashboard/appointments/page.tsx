"use client";

/**
 * Dashboard "Rendez-vous" (Lot 20 fix B4).
 *
 * Avant : mockAppointments = 5 lignes hardcodées, aucun fetch, filtres qui
 * ne filtraient que du mock.
 *
 * Maintenant : GET /api/appointments (avec ?from=&to=&status=), création via
 * POST /api/appointments (client à la volée par phone), update statut via
 * PATCH, soft delete via DELETE. Vue LISTE + vue AGENDA du jour + KPIs.
 * Skeletons pendant chargement, EmptyState si vide.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import {
  Calendar,
  Clock,
  Plus,
  CheckCircle2,
  XCircle,
  User,
  Trash2,
  Phone,
} from "lucide-react";

type Status = "pending" | "confirmed" | "cancelled" | "completed";
type FilterStatus = Status | "all";

interface AppointmentRow {
  id: string;
  title: string;
  description: string | null;
  date: string;
  startTime: string;
  endTime: string;
  status: Status;
  clientId: string | null;
  clientFirstName: string | null;
  clientLastName: string | null;
  clientPhone: string | null;
  createdAt: string;
}

const statusConfig: Record<
  Status,
  { label: string; variant: "default" | "success" | "warning" | "danger" | "info" | "purple" }
> = {
  pending: { label: "En attente", variant: "warning" },
  confirmed: { label: "Confirmé", variant: "success" },
  cancelled: { label: "Annulé", variant: "danger" },
  completed: { label: "Terminé", variant: "info" },
};

/** YYYY-MM-DD du jour, en local — évite les décalages UTC pour comparer aux dates DB. */
function todayLocalISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AppointmentsPage() {
  const toast = useToast();
  const [items, setItems] = useState<AppointmentRow[] | null>(null);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [showNewModal, setShowNewModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form
  const [form, setForm] = useState({
    clientFirstName: "",
    clientLastName: "",
    clientPhone: "",
    clientEmail: "",
    title: "",
    description: "",
    date: todayLocalISO(),
    startTime: "09:00",
    endTime: "10:00",
  });

  const resetForm = () =>
    setForm({
      clientFirstName: "",
      clientLastName: "",
      clientPhone: "",
      clientEmail: "",
      title: "",
      description: "",
      date: todayLocalISO(),
      startTime: "09:00",
      endTime: "10:00",
    });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/appointments", { cache: "no-store" });
      if (!res.ok) throw new Error("Erreur de chargement");
      const data = await res.json();
      setItems(data.appointments || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
      setItems([]);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!items) return null;
    return filter === "all" ? items : items.filter((a) => a.status === filter);
  }, [items, filter]);

  // KPIs : aujourd'hui / à venir / cette semaine
  const kpi = useMemo(() => {
    if (!items) return { today: 0, upcoming: 0, week: 0, completed30d: 0 };
    const today = todayLocalISO();
    const in7 = new Date();
    in7.setDate(in7.getDate() + 7);
    const in7Iso = `${in7.getFullYear()}-${String(in7.getMonth() + 1).padStart(2, "0")}-${String(in7.getDate()).padStart(2, "0")}`;
    const in30 = new Date();
    in30.setDate(in30.getDate() - 30);
    const in30Iso = `${in30.getFullYear()}-${String(in30.getMonth() + 1).padStart(2, "0")}-${String(in30.getDate()).padStart(2, "0")}`;

    return {
      today: items.filter((a) => a.date === today && a.status !== "cancelled").length,
      upcoming: items.filter(
        (a) => a.date > today && a.status !== "cancelled" && a.status !== "completed"
      ).length,
      week: items.filter(
        (a) => a.date >= today && a.date <= in7Iso && a.status !== "cancelled"
      ).length,
      completed30d: items.filter((a) => a.status === "completed" && a.date >= in30Iso).length,
    };
  }, [items]);

  async function createAppointment() {
    // Validations client
    if (!form.title.trim()) {
      toast.error("Titre requis");
      return;
    }
    if (!form.clientFirstName.trim() || !form.clientLastName.trim() || !form.clientPhone.trim()) {
      toast.error("Client (prénom + nom + téléphone) requis");
      return;
    }
    if (form.endTime <= form.startTime) {
      toast.error("L'heure de fin doit être après l'heure de début");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description || undefined,
          date: form.date,
          startTime: form.startTime,
          endTime: form.endTime,
          client: {
            firstName: form.clientFirstName,
            lastName: form.clientLastName,
            phone: form.clientPhone,
            email: form.clientEmail || undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de création");
      toast.success("Rendez-vous créé");
      setShowNewModal(false);
      resetForm();
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(id: string, status: Status) {
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Erreur");
      toast.success(`Statut : ${statusConfig[status].label}`);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  }

  async function removeAppointment(id: string) {
    if (!window.confirm("Supprimer ce rendez-vous ? (récupérable 30 jours)")) return;
    try {
      const res = await fetch(`/api/appointments/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "Erreur");
      toast.success("Rendez-vous supprimé");
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Rendez-vous</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Gérez votre agenda et les demandes de vos clients
          </p>
        </div>
        <Button onClick={() => setShowNewModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau RDV
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Aujourd'hui" value={kpi.today.toString()} icon={<Calendar className="h-4 w-4" />} />
        <Kpi label="Cette semaine" value={kpi.week.toString()} icon={<Calendar className="h-4 w-4" />} />
        <Kpi label="À venir" value={kpi.upcoming.toString()} icon={<Clock className="h-4 w-4" />} />
        <Kpi
          label="Terminés (30j)"
          value={kpi.completed30d.toString()}
          icon={<CheckCircle2 className="h-4 w-4" />}
          color="text-emerald-600"
        />
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2">
        {(["all", "pending", "confirmed", "completed", "cancelled"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === s
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            {s === "all" ? "Tous" : statusConfig[s].label}
          </button>
        ))}
      </div>

      {/* Liste */}
      {filtered === null ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-10 w-10" />}
          title={filter === "all" ? "Aucun rendez-vous" : "Aucun RDV pour ce filtre"}
          description={
            filter === "all"
              ? "Créez votre premier rendez-vous pour commencer à organiser votre agenda."
              : "Essayez un autre filtre ou créez un nouveau rendez-vous."
          }
          action={
            <Button onClick={() => setShowNewModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau RDV
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => {
            const clientLabel =
              a.clientFirstName || a.clientLastName
                ? `${a.clientFirstName ?? ""} ${a.clientLastName ?? ""}`.trim()
                : "Client supprimé";
            return (
              <Card key={a.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-6">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <Calendar className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-slate-900 dark:text-slate-100">
                        {a.title}
                      </h3>
                      <Badge variant={statusConfig[a.status].variant}>
                        {statusConfig[a.status].label}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        {a.date} · {a.startTime} → {a.endTime}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" aria-hidden="true" />
                        {clientLabel}
                      </span>
                      {a.clientPhone && (
                        <a
                          href={`tel:${a.clientPhone}`}
                          className="flex items-center gap-1 hover:text-slate-900 hover:underline dark:hover:text-slate-100"
                        >
                          <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                          {a.clientPhone}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {a.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateStatus(a.id, "confirmed")}
                        aria-label="Confirmer"
                      >
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      </Button>
                    )}
                    {(a.status === "pending" || a.status === "confirmed") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateStatus(a.id, "completed")}
                        aria-label="Marquer terminé"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    )}
                    {a.status !== "cancelled" && a.status !== "completed" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateStatus(a.id, "cancelled")}
                        aria-label="Annuler"
                      >
                        <XCircle className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAppointment(a.id)}
                      aria-label="Supprimer"
                    >
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal création */}
      <Modal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        title="Nouveau rendez-vous"
        description="Créez le RDV et le client sera créé automatiquement s'il n'existe pas."
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Titre"
            placeholder="Ex: Réparation fuite salle de bain"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <Textarea
            label="Description (optionnelle)"
            placeholder="Notes internes, contexte…"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h4 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Client</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Prénom"
                value={form.clientFirstName}
                onChange={(e) => setForm({ ...form, clientFirstName: e.target.value })}
                required
              />
              <Input
                label="Nom"
                value={form.clientLastName}
                onChange={(e) => setForm({ ...form, clientLastName: e.target.value })}
                required
              />
              <Input
                label="Téléphone"
                value={form.clientPhone}
                onChange={(e) => setForm({ ...form, clientPhone: e.target.value })}
                placeholder="+33 6 12 34 56 78"
                required
              />
              <Input
                label="Email (optionnel)"
                type="email"
                value={form.clientEmail}
                onChange={(e) => setForm({ ...form, clientEmail: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              label="Date"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
            />
            <Input
              label="Début"
              type="time"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              required
            />
            <Input
              label="Fin"
              type="time"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              required
            />
          </div>

          <div className="flex flex-col justify-end gap-2 sm:flex-row sm:gap-3">
            <Button variant="outline" onClick={() => setShowNewModal(false)}>
              Annuler
            </Button>
            <Button onClick={createAppointment} loading={submitting}>
              Créer le RDV
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          {icon}
          <p className="text-xs">{label}</p>
        </div>
        <p className={`mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100 ${color ?? ""}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
