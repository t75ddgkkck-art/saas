"use client";

/**
 * Lot 42 (F9) — Dashboard Factures.
 *
 * Liste toutes les factures générées auto post-signature devis.
 * Actions par ligne :
 *  - Télécharger PDF (pdfUrl direct)
 *  - Marquer payée (PATCH status=paid)
 *  - Annuler (PATCH status=cancelled) — figée après ça
 *
 * Gate : Pro+ via UpgradeGate wrapper (feature `invoices.auto_generation`).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/useConfirm";
import { PageTitle } from "@/components/layout/PageTitle";
import { UpgradeGate } from "@/components/entitlements/UpgradeGate";
import { EmptyState } from "@/components/ui/EmptyState";
import { FileText, Download, CheckCircle2, XCircle, Mail } from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string | null;
  total: string;
  currency: string;
  status: "draft" | "issued" | "paid" | "cancelled";
  pdfUrl: string | null;
  sentAt: string | null;
  paidAt: string | null;
  quoteNumber: string | null;
  clientFirstName: string | null;
  clientLastName: string | null;
  clientEmail: string | null;
  createdAt: string;
}

// Badge couleur par statut — cohérent avec la palette du reste du dashboard
// Variants Badge dispo : default | success | warning | danger | info | purple
const STATUS_BADGE: Record<
  InvoiceRow["status"],
  { label: string; variant: "default" | "success" | "warning" | "danger" | "info" | "purple" }
> = {
  draft: { label: "Brouillon", variant: "default" },
  issued: { label: "Envoyée", variant: "info" },
  paid: { label: "Payée", variant: "success" },
  cancelled: { label: "Annulée", variant: "danger" },
};

// Wrapper gate (Pro+) — les Free voient un CTA upgrade, pas la liste vide qui prête à confusion
export default function InvoicesPage() {
  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <UpgradeGate feature="invoices.auto_generation">
        <InvoicesInner />
      </UpgradeGate>
    </div>
  );
}

function InvoicesInner() {
  const [invoices, setInvoices] = useState<InvoiceRow[] | null>(null);
  const [filter, setFilter] = useState<"all" | "issued" | "paid">("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const toast = useToast();
  // useConfirm renvoie { confirm, dialog } — le dialog doit être RENDERED dans le JSX
  const { confirm, dialog } = useConfirm();

  const load = useCallback(async () => {
    try {
      const url = filter === "all" ? "/api/invoices" : `/api/invoices?status=${filter}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.ok) {
        setInvoices(data.invoices ?? []);
      } else {
        toast.error("Impossible de charger les factures");
      }
    } catch {
      toast.error("Erreur réseau");
    }
  }, [filter, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  // Total payé / en attente — affiché en haut de page pour donner un aperçu rapide
  const stats = useMemo(() => {
    if (!invoices) return { paid: 0, pending: 0, count: 0 };
    let paid = 0;
    let pending = 0;
    for (const inv of invoices) {
      const n = Number(inv.total);
      if (inv.status === "paid") paid += n;
      else if (inv.status === "issued") pending += n;
    }
    return { paid, pending, count: invoices.length };
  }, [invoices]);

  const markPaid = async (inv: InvoiceRow) => {
    const ok = await confirm({
      title: "Marquer comme payée",
      description: `Confirmer la réception du paiement pour ${inv.invoiceNumber} (${formatPrice(Number(inv.total))}) ?`,
      confirmLabel: "Marquer payée",
    });
    if (!ok) return;
    setBusyId(inv.id);
    try {
      const res = await fetch(`/api/invoices/${inv.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paid" }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success("Facture marquée payée");
        void load();
      } else {
        toast.error(data.error ?? "Échec");
      }
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (inv: InvoiceRow) => {
    const ok = await confirm({
      title: "Annuler la facture",
      description: `Une facture annulée ne peut plus être modifiée. Vous devrez émettre un avoir si nécessaire. Confirmer l'annulation de ${inv.invoiceNumber} ?`,
      confirmLabel: "Annuler la facture",
      variant: "danger",
    });
    if (!ok) return;
    setBusyId(inv.id);
    try {
      const res = await fetch(`/api/invoices/${inv.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success("Facture annulée");
        void load();
      } else {
        toast.error(data.error ?? "Échec");
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <PageTitle title="Factures" />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Factures</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Générées automatiquement à la signature des devis.
        </p>
      </div>

      {/* Stats en haut — visible en un coup d'œil */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Total factures</div>
            <div className="mt-1 text-2xl font-bold">{stats.count}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Encaissé</div>
            <div className="mt-1 text-2xl font-bold text-emerald-600">
              {formatPrice(stats.paid)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">En attente</div>
            <div className="mt-1 text-2xl font-bold text-amber-600">
              {formatPrice(stats.pending)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres — pas plus de 3 pour éviter le choice paralysis */}
      <div className="mb-4 flex gap-2">
        {(["all", "issued", "paid"] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "primary" : "outline"}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "Toutes" : f === "issued" ? "Envoyées" : "Payées"}
          </Button>
        ))}
      </div>

      {/* Liste */}
      {invoices === null ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-10 w-10" />}
          title="Aucune facture"
          description="Les factures sont générées automatiquement dès qu'un devis est signé par le client."
        />
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => {
            const badge = STATUS_BADGE[inv.status];
            const clientName =
              [inv.clientFirstName, inv.clientLastName].filter(Boolean).join(" ") ||
              inv.clientEmail ||
              "Client";
            return (
              <Card key={inv.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold">
                          {inv.invoiceNumber}
                        </span>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </div>
                      <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        {clientName}
                        {inv.quoteNumber ? ` · Devis ${inv.quoteNumber}` : ""}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Émise le {inv.issueDate}
                        {inv.dueDate ? ` · Échéance ${inv.dueDate}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="text-right">
                        <div className="text-lg font-bold">
                          {formatPrice(Number(inv.total))}
                        </div>
                        {inv.sentAt && (
                          <div className="flex items-center justify-end gap-1 text-xs text-slate-500">
                            <Mail className="h-3 w-3" /> envoyée
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {inv.pdfUrl && (
                          <a
                            href={inv.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Télécharger le PDF"
                          >
                            <Button size="sm" variant="ghost">
                              <Download className="h-4 w-4" />
                            </Button>
                          </a>
                        )}
                        {inv.status === "issued" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => markPaid(inv)}
                            disabled={busyId === inv.id}
                            aria-label="Marquer comme payée"
                          >
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          </Button>
                        )}
                        {inv.status !== "cancelled" && inv.status !== "paid" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => cancel(inv)}
                            disabled={busyId === inv.id}
                            aria-label="Annuler la facture"
                          >
                            <XCircle className="h-4 w-4 text-red-600" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {/* Dialog impératif du hook useConfirm — rendu inconditionnel */}
      {dialog}
    </>
  );
}
