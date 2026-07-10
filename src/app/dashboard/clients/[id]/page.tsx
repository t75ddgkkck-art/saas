"use client";

/**
 * Fiche client détaillée (Lot 24).
 *
 * Affiche :
 *  - Infos identité (nom/email/phone/adresse/source/notes)
 *  - Agrégats : total dépensé, nb RDV, nb no-show, nb devis
 *  - 4 sections tabs (compact) : RDV, Devis, Paiements, Notes
 *  - Bouton "Modifier" (modal édition rapide)
 *  - Bouton "Supprimer" (soft delete via useConfirm)
 *
 * Source : GET /api/clients/[id] (Lot 24) qui renvoie tout d'un coup.
 */

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/useConfirm";
import { PageTitle } from "@/components/layout/PageTitle";
import { formatPrice } from "@/lib/utils";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Calendar,
  FileText,
  CreditCard,
  StickyNote,
  Edit,
  Trash2,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  address: string | null;
  notes: string | null;
  source: string | null;
  createdAt: string;
}

interface Aggregates {
  totalRevenue: number;
  noShows: number;
  completedAppointments: number;
  totalAppointments: number;
  totalQuotes: number;
}

interface ApptRow {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  status: "pending" | "confirmed" | "cancelled" | "completed" | "no_show";
  createdAt: string;
}

interface QuoteRow {
  id: string;
  quoteNumber: string;
  title: string;
  status: string;
  total: string;
  signedAt: string | null;
  createdAt: string;
}

interface PaymentRow {
  id: string;
  amount: string;
  currency: string | null;
  type: string;
  status: string;
  createdAt: string;
}

interface NoteRow {
  id: string;
  content: string;
  createdAt: string;
}

const statusLabels: Record<
  string,
  { label: string; variant: "default" | "success" | "warning" | "danger" | "info" | "purple" }
> = {
  pending: { label: "En attente", variant: "warning" },
  confirmed: { label: "Confirmé", variant: "success" },
  cancelled: { label: "Annulé", variant: "danger" },
  completed: { label: "Terminé", variant: "info" },
  no_show: { label: "No-show", variant: "danger" },
  draft: { label: "Brouillon", variant: "default" },
  sent: { label: "Envoyé", variant: "warning" },
  signed: { label: "Signé", variant: "success" },
  accepted: { label: "Accepté", variant: "success" },
  rejected: { label: "Refusé", variant: "danger" },
  expired: { label: "Expiré", variant: "default" },
};

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const [client, setClient] = useState<Client | null>(null);
  const [aggs, setAggs] = useState<Aggregates | null>(null);
  const [apts, setApts] = useState<ApptRow[]>([]);
  const [qts, setQts] = useState<QuoteRow[]>([]);
  const [pmts, setPmts] = useState<PaymentRow[]>([]);
  const [nts, setNts] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState<string | null>(null);

  // Édition
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErrored(null);
    try {
      const res = await fetch(`/api/clients/${id}`, { cache: "no-store" });
      if (res.status === 404) {
        setErrored("Client introuvable ou vous n'y avez pas accès.");
        return;
      }
      if (!res.ok) {
        setErrored("Impossible de charger cette fiche.");
        return;
      }
      const data = await res.json();
      setClient(data.client);
      setAggs(data.aggregates);
      setApts(data.appointments || []);
      setQts(data.quotes || []);
      setPmts(data.payments || []);
      setNts(data.notes || []);
      setEditForm({
        firstName: data.client.firstName ?? "",
        lastName: data.client.lastName ?? "",
        email: data.client.email ?? "",
        phone: data.client.phone ?? "",
        address: data.client.address ?? "",
        notes: data.client.notes ?? "",
      });
    } catch {
      setErrored("Erreur réseau. Réessayez.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveEdit() {
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: editForm.firstName || undefined,
          lastName: editForm.lastName || undefined,
          email: editForm.email || null,
          phone: editForm.phone || undefined,
          address: editForm.address || null,
          notes: editForm.notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      toast.success("Fiche mise à jour");
      setShowEdit(false);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function deleteClient() {
    const ok = await confirm({
      title: "Supprimer ce client ?",
      description:
        "Récupérable pendant 30 jours. Ses RDV, devis et paiements restent visibles jusqu'à la purge définitive.",
      variant: "danger",
      confirmLabel: "Supprimer",
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "Erreur");
      toast.success("Client supprimé");
      router.push("/dashboard/clients");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (errored || !client) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <FileText className="mx-auto h-12 w-12 text-slate-400" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-semibold text-slate-900 dark:text-slate-100">
          Client introuvable
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {errored ?? "Ce client n'existe pas."}
        </p>
        <Button className="mt-6" onClick={() => router.push("/dashboard/clients")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux clients
        </Button>
      </div>
    );
  }

  const clientLabel = `${client.firstName} ${client.lastName}`.trim() || "Client";
  const initials = (client.firstName?.[0] ?? "") + (client.lastName?.[0] ?? "") || "?";
  const noShowRate =
    aggs && aggs.totalAppointments > 0
      ? Math.round((aggs.noShows / aggs.totalAppointments) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <PageTitle title={clientLabel} />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard/clients")}
            aria-label="Retour"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {initials.toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{clientLabel}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Client depuis {new Date(client.createdAt).toLocaleDateString("fr-FR")}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
            <Edit className="mr-1 h-4 w-4" /> Modifier
          </Button>
          <Button variant="destructive" size="sm" onClick={deleteClient}>
            <Trash2 className="mr-1 h-4 w-4" /> Supprimer
          </Button>
        </div>
      </div>

      {/* Warning no-show */}
      {aggs && aggs.noShows >= 2 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-900/20">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Client à risque</strong> : {aggs.noShows} no-show sur {aggs.totalAppointments}{" "}
            RDV ({noShowRate}%). Envisagez de demander un acompte à l&apos;avance.
          </p>
        </div>
      )}

      {/* Contact card */}
      <Card>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
          {client.email && (
            <ContactRow
              icon={<Mail className="h-4 w-4" />}
              label="Email"
              value={client.email}
              href={`mailto:${client.email}`}
            />
          )}
          {client.phone && (
            <ContactRow
              icon={<Phone className="h-4 w-4" />}
              label="Téléphone"
              value={client.phone}
              href={`tel:${client.phone}`}
            />
          )}
          {client.address && (
            <ContactRow
              icon={<MapPin className="h-4 w-4" />}
              label="Adresse"
              value={client.address}
            />
          )}
          {client.source && (
            <ContactRow
              icon={<TrendingUp className="h-4 w-4" />}
              label="Source"
              value={client.source}
            />
          )}
        </CardContent>
      </Card>

      {/* KPIs */}
      {aggs && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Total dépensé"
            value={formatPrice(aggs.totalRevenue)}
            icon={<CreditCard className="h-4 w-4" />}
          />
          <Kpi
            label="RDV honorés"
            value={`${aggs.completedAppointments} / ${aggs.totalAppointments}`}
            icon={<Calendar className="h-4 w-4" />}
          />
          <Kpi
            label="Devis"
            value={aggs.totalQuotes.toString()}
            icon={<FileText className="h-4 w-4" />}
          />
          <Kpi
            label="No-show"
            value={aggs.noShows.toString()}
            icon={<AlertTriangle className="h-4 w-4" />}
            tone={aggs.noShows >= 2 ? "danger" : undefined}
          />
        </div>
      )}

      {/* Historique RDV */}
      <Section title={`Rendez-vous (${apts.length})`} icon={<Calendar className="h-5 w-5" />}>
        {apts.length === 0 ? (
          <EmptyState icon={<Calendar className="h-8 w-8" />} title="Aucun RDV" />
        ) : (
          <ul className="space-y-2">
            {apts.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800"
              >
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{a.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {a.date} · {a.startTime}–{a.endTime}
                  </p>
                </div>
                <Badge variant={statusLabels[a.status]?.variant ?? "default"}>
                  {statusLabels[a.status]?.label ?? a.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Historique devis */}
      <Section title={`Devis (${qts.length})`} icon={<FileText className="h-5 w-5" />}>
        {qts.length === 0 ? (
          <EmptyState icon={<FileText className="h-8 w-8" />} title="Aucun devis" />
        ) : (
          <ul className="space-y-2">
            {qts.map((q) => (
              <li
                key={q.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800"
              >
                <div>
                  <Link
                    href={`/dashboard/quotes/${q.id}`}
                    className="font-medium text-slate-900 hover:underline dark:text-slate-100"
                  >
                    {q.quoteNumber} — {q.title}
                  </Link>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatPrice(Number(q.total))}
                  </p>
                </div>
                <Badge variant={statusLabels[q.status]?.variant ?? "default"}>
                  {statusLabels[q.status]?.label ?? q.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Historique paiements */}
      <Section title={`Paiements (${pmts.length})`} icon={<CreditCard className="h-5 w-5" />}>
        {pmts.length === 0 ? (
          <EmptyState icon={<CreditCard className="h-8 w-8" />} title="Aucun paiement" />
        ) : (
          <ul className="space-y-2">
            {pmts.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800"
              >
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {formatPrice(Number(p.amount))}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {p.type} · {new Date(p.createdAt).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <Badge variant={statusLabels[p.status]?.variant ?? "default"}>
                  {statusLabels[p.status]?.label ?? p.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Notes libres */}
      {(client.notes || nts.length > 0) && (
        <Section title="Notes" icon={<StickyNote className="h-5 w-5" />}>
          {client.notes && (
            <p className="whitespace-pre-line rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
              {client.notes}
            </p>
          )}
          {nts.length > 0 && (
            <ul className="mt-3 space-y-2">
              {nts.map((n) => (
                <li
                  key={n.id}
                  className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800"
                >
                  <p className="whitespace-pre-line text-slate-700 dark:text-slate-300">
                    {n.content}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {new Date(n.createdAt).toLocaleString("fr-FR")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {/* Modal édition */}
      <Modal
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        title="Modifier la fiche"
        size="md"
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Prénom"
              value={editForm.firstName}
              onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
            />
            <Input
              label="Nom"
              value={editForm.lastName}
              onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
            />
          </div>
          <Input
            label="Email"
            type="email"
            value={editForm.email}
            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
          />
          <Input
            label="Téléphone"
            value={editForm.phone}
            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
          />
          <Input
            label="Adresse"
            value={editForm.address}
            onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
          />
          <Textarea
            label="Notes internes"
            value={editForm.notes}
            onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowEdit(false)}>
              Annuler
            </Button>
            <Button onClick={saveEdit} loading={saving}>
              Enregistrer
            </Button>
          </div>
        </div>
      </Modal>

      {dialog}
    </div>
  );
}

function ContactRow({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-slate-400" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <p className="truncate font-medium text-slate-900 dark:text-slate-100">{value}</p>
      </div>
    </div>
  );
  return href ? (
    <a href={href} className="hover:underline">
      {content}
    </a>
  ) : (
    content
  );
}

function Kpi({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: "danger";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          {icon}
          <p className="text-xs">{label}</p>
        </div>
        <p
          className={`mt-1 text-xl font-bold ${
            tone === "danger"
              ? "text-red-600 dark:text-red-400"
              : "text-slate-900 dark:text-slate-100"
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
