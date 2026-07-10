"use client";

/**
 * Dashboard "Paiements" (Lot 20 fix B6).
 *
 * Avant : mockPayments 4 lignes hardcodées.
 * Maintenant : GET /api/payments (avec ?fromDays=), POST pour paiements manuels
 * (espèces, virement, chèque). Les paiements Stripe arrivent automatiquement
 * via le webhook (Lot 11).
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
import { PageTitle } from "@/components/layout/PageTitle";
import { CreditCard, DollarSign, TrendingUp, Plus, Receipt, User } from "lucide-react";
import { formatPrice } from "@/lib/utils";

type Status = "pending" | "completed" | "failed" | "refunded";
type PayType = "deposit" | "full" | "subscription";

interface PaymentRow {
  id: string;
  amount: string;
  currency: string | null;
  type: PayType;
  status: Status;
  stripePaymentId: string | null;
  invoiceGenerated: boolean | null;
  invoiceUrl: string | null;
  metadata: { method?: string; note?: string } | null;
  createdAt: string;
  clientId: string | null;
  clientFirstName: string | null;
  clientLastName: string | null;
  quoteId: string | null;
  quoteNumber: string | null;
}

const statusConfig: Record<
  Status,
  { label: string; variant: "default" | "success" | "warning" | "danger" | "info" | "purple" }
> = {
  pending: { label: "En attente", variant: "warning" },
  completed: { label: "Encaissé", variant: "success" },
  failed: { label: "Échoué", variant: "danger" },
  refunded: { label: "Remboursé", variant: "info" },
};

const typeConfig: Record<PayType, string> = {
  deposit: "Acompte",
  full: "Paiement total",
  subscription: "Abonnement",
};

/** YYYY-MM du mois courant, pour "encaissé ce mois". */
function currentMonthPrefix(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function PaymentsPage() {
  const toast = useToast();
  const [items, setItems] = useState<PaymentRow[] | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    amount: "",
    type: "full" as PayType,
    method: "cash",
    note: "",
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/payments", { cache: "no-store" });
      if (!res.ok) throw new Error("Erreur de chargement");
      const data = await res.json();
      setItems(data.payments || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
      setItems([]);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  // KPIs calculés à la volée : total encaissé (completed), ce mois, en attente
  const kpi = useMemo(() => {
    if (!items) return { total: 0, monthTotal: 0, pending: 0, count: 0 };
    const monthPrefix = currentMonthPrefix();
    let total = 0,
      monthTotal = 0,
      pending = 0;
    for (const p of items) {
      const amt = Number(p.amount) || 0;
      if (p.status === "completed") {
        total += amt;
        if (p.createdAt.startsWith(monthPrefix)) monthTotal += amt;
      }
      if (p.status === "pending") pending += amt;
    }
    return { total, monthTotal, pending, count: items.length };
  }, [items]);

  async function createPayment() {
    const amount = Number(form.amount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Montant invalide");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          type: form.type,
          status: "completed",
          method: form.method,
          note: form.note || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      toast.success("Paiement enregistré");
      setShowNewModal(false);
      setForm({ amount: "", type: "full", method: "cash", note: "" });
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Paiements" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Paiements</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Suivez vos encaissements Stripe et enregistrez les paiements manuels
          </p>
        </div>
        <Button onClick={() => setShowNewModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Paiement manuel
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total encaissé"
          value={formatPrice(kpi.total)}
          icon={<DollarSign className="h-5 w-5" />}
          tone="emerald"
        />
        <KpiCard
          label="Ce mois"
          value={formatPrice(kpi.monthTotal)}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="blue"
        />
        <KpiCard
          label="En attente"
          value={formatPrice(kpi.pending)}
          icon={<Receipt className="h-5 w-5" />}
          tone="amber"
        />
        <KpiCard
          label="Nombre de paiements"
          value={kpi.count.toString()}
          icon={<CreditCard className="h-5 w-5" />}
          tone="slate"
        />
      </div>

      {/* Liste */}
      {items === null ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="h-10 w-10" />}
          title="Aucun paiement enregistré"
          description="Les paiements Stripe arrivent automatiquement. Vous pouvez aussi enregistrer manuellement un règlement en espèces, virement ou chèque."
          action={
            <Button onClick={() => setShowNewModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Enregistrer un paiement
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((p) => {
            const clientLabel =
              p.clientFirstName || p.clientLastName
                ? `${p.clientFirstName ?? ""} ${p.clientLastName ?? ""}`.trim()
                : "Sans client";
            const method = p.metadata?.method ?? (p.stripePaymentId ? "Stripe" : "manuel");
            return (
              <Card key={p.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-6">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30">
                    <CreditCard className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {formatPrice(Number(p.amount))}
                      </p>
                      <Badge variant={statusConfig[p.status].variant}>
                        {statusConfig[p.status].label}
                      </Badge>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {typeConfig[p.type]}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" aria-hidden="true" />
                        {clientLabel}
                      </span>
                      {p.quoteNumber && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">
                          {p.quoteNumber}
                        </span>
                      )}
                      <span className="text-xs">via {method}</span>
                      <span className="text-xs">
                        {new Date(p.createdAt).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                    {p.metadata?.note && (
                      <p className="mt-1 text-xs italic text-slate-500 dark:text-slate-400">
                        « {p.metadata.note} »
                      </p>
                    )}
                  </div>
                  {p.invoiceUrl && (
                    <a
                      href={p.invoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Facture PDF
                    </a>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal création manuelle */}
      <Modal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        title="Enregistrer un paiement"
        description="Espèces, virement, chèque ou tout autre moyen non-Stripe."
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Montant (€)"
            type="number"
            step="0.01"
            min="0"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
          />
          <Select
            label="Type"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as PayType })}
            options={[
              { value: "full", label: "Paiement total" },
              { value: "deposit", label: "Acompte" },
              { value: "subscription", label: "Abonnement" },
            ]}
          />
          <Select
            label="Méthode"
            value={form.method}
            onChange={(e) => setForm({ ...form, method: e.target.value })}
            options={[
              { value: "cash", label: "Espèces" },
              { value: "transfer", label: "Virement" },
              { value: "cheque", label: "Chèque" },
              { value: "card_terminal", label: "CB terminal" },
              { value: "other", label: "Autre" },
            ]}
          />
          <Textarea
            label="Note (optionnelle)"
            placeholder="Ex: acompte 30% chantier Dupuis"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
          <div className="flex flex-col justify-end gap-2 sm:flex-row sm:gap-3">
            <Button variant="outline" onClick={() => setShowNewModal(false)}>
              Annuler
            </Button>
            <Button onClick={createPayment} loading={submitting}>
              Enregistrer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: "emerald" | "blue" | "amber" | "slate";
}) {
  const bg = {
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30",
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/30",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-900/30",
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  }[tone];
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>
            {icon}
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
