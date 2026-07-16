"use client";

/**
 * Dashboard "Devis" (Lot 18 - fix B15 : 404 devis).
 *
 * Avant : 100% mock (Marie Dupont, DEV-2025-001 hardcodés), le clic "Nouveau
 * devis" ouvrait une modal qui ne postait nulle part, et le PDF tapait sur
 * /api/quote-pdf?quoteId=DEV-2025-001 → 404 car ces IDs n'existent pas en DB.
 *
 * Maintenant : liste réelle via GET /api/quotes, création via POST /api/quotes,
 * détail via /dashboard/quotes/[id] (page câblée aussi), PDF via un vrai UUID.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { PageTitle } from "@/components/layout/PageTitle";
import { FileText, Plus, Eye, Download, Trash2, Sparkles } from "lucide-react";
// Lot 45 : modal IA de génération de lignes de devis.
// Elle embarque son propre <UpgradeGate feature="quotes.ai_generation"> :
// - Free/Pro voient un CTA Premium
// - Premium voient le formulaire
import { AiGenerateModal, type AiGenerateResult } from "@/components/quotes/AiGenerateModal";
import { formatPrice } from "@/lib/utils";

// Types miroir de la réponse GET /api/quotes
interface QuoteRow {
  id: string;
  quoteNumber: string;
  title: string;
  status: "draft" | "sent" | "accepted" | "rejected" | "signed" | "expired";
  subtotal: string;
  tax: string;
  total: string;
  depositAmount: string | null;
  validUntil: string | null;
  signedAt: string | null;
  createdAt: string;
  clientFirstName: string | null;
  clientLastName: string | null;
}

const statusConfig: Record<
  QuoteRow["status"],
  { label: string; variant: "default" | "success" | "warning" | "danger" | "info" | "purple" }
> = {
  draft: { label: "Brouillon", variant: "default" },
  sent: { label: "Envoyé", variant: "warning" },
  accepted: { label: "Accepté", variant: "success" },
  rejected: { label: "Refusé", variant: "danger" },
  signed: { label: "Signé", variant: "success" },
  expired: { label: "Expiré", variant: "default" },
};

interface NewQuoteItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

const EMPTY_ITEM: NewQuoteItem = { description: "", quantity: 1, unitPrice: 0 };

/**
 * Lot 45 : fusion prudente de la description existante avec les notes IA.
 * Priorité au texte du pro. Les notes IA sont juste appended en séparateur.
 */
function mergeDescription(existing: string, aiNotes: string | null): string {
  const trimmed = existing.trim();
  if (!aiNotes) return existing;
  if (!trimmed) return aiNotes;
  return `${trimmed}\n\n---\n${aiNotes}`;
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<QuoteRow[] | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Lot 45 : modal IA — indépendante de la modal création (peut être ouverte
  // par-dessus pour "boost" un devis en cours de rédaction).
  const [showAiModal, setShowAiModal] = useState(false);
  const toast = useToast();

  // Form state (création)
  const [form, setForm] = useState({
    title: "",
    description: "",
    clientFirstName: "",
    clientLastName: "",
    clientPhone: "",
    clientEmail: "",
    validityDays: 30,
    depositAmount: 0,
    items: [{ ...EMPTY_ITEM }] as NewQuoteItem[],
  });

  const resetForm = () => {
    setForm({
      title: "",
      description: "",
      clientFirstName: "",
      clientLastName: "",
      clientPhone: "",
      clientEmail: "",
      validityDays: 30,
      depositAmount: 0,
      items: [{ ...EMPTY_ITEM }],
    });
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/quotes", { cache: "no-store" });
      if (!res.ok) throw new Error("Erreur de chargement");
      const data = await res.json();
      setQuotes(data.quotes || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur inattendue");
      setQuotes([]);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  // Sous-total pour affichage live dans le modal
  const liveSubtotal = useMemo(
    () =>
      form.items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0),
    [form.items]
  );

  /**
   * Lot 45 : injecte le résultat IA dans le form courant.
   *
   * - `mode = "replace"` → écrase les lignes existantes (ainsi que le titre si vide)
   * - `mode = "append"` → ajoute à la suite, garde les lignes actuelles
   *
   * Les notes IA sont MERGED : si le pro a déjà mis une description, on la
   * conserve et on ajoute les notes IA en dessous. Sinon on les met direct.
   * Le montant d'acompte n'est PAS touché (décision commerciale du pro).
   */
  function applyAiGenerated(result: AiGenerateResult, mode: "replace" | "append") {
    setForm((prev) => {
      // Convertit AiGeneratedItem → NewQuoteItem (nom de champ diff : unit_price → unitPrice)
      const newItems: NewQuoteItem[] = result.items.map((it) => ({
        description: it.description + (it.unit ? ` (${it.unit})` : ""),
        quantity: it.quantity,
        unitPrice: it.unit_price,
      }));

      const items =
        mode === "replace"
          ? newItems.length > 0
            ? newItems
            : [{ ...EMPTY_ITEM }] // safety : au moins 1 ligne vide sinon le form casse
          : [
              // Filtre les lignes vides existantes avant append (évite les "trous")
              ...prev.items.filter((it) => it.description.trim() || it.unitPrice > 0),
              ...newItems,
            ];

      return {
        ...prev,
        // Titre : ne remplace QUE si vide (protège le user qui a déjà tapé)
        title: prev.title.trim() || result.title,
        description: mergeDescription(prev.description, result.notes),
        items,
      };
    });
    // Ouvre la modal création si elle ne l'est pas déjà (cas où le user
    // a cliqué directement sur "Générer IA" depuis la page liste)
    setShowNewModal(true);
  }

  async function createQuote() {
    // Validation client avant de spammer l'API
    if (!form.title.trim()) {
      toast.error("Le titre est requis");
      return;
    }
    if (!form.clientFirstName.trim() || !form.clientLastName.trim() || !form.clientPhone.trim()) {
      toast.error("Nom, prénom et téléphone du client requis");
      return;
    }
    const validItems = form.items.filter((it) => it.description.trim() && it.unitPrice > 0);
    if (validItems.length === 0) {
      toast.error("Ajoutez au moins une ligne avec description et prix");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description || undefined,
          client: {
            firstName: form.clientFirstName,
            lastName: form.clientLastName,
            phone: form.clientPhone,
            email: form.clientEmail || undefined,
          },
          items: validItems,
          validityDays: form.validityDays,
          depositAmount: form.depositAmount || undefined,
          taxRate: 20,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de création");

      toast.success(`Devis ${data.quote.quoteNumber} créé`);
      setShowNewModal(false);
      resetForm();
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setSubmitting(false);
    }
  }

  // KPIs dérivés (calculés à la volée, cheap)
  const kpi = useMemo(() => {
    if (!quotes) return { total: 0, pending: 0, signed: 0, sum: 0 };
    return {
      total: quotes.length,
      pending: quotes.filter((q) => q.status === "sent").length,
      signed: quotes.filter((q) => q.status === "accepted" || q.status === "signed").length,
      sum: quotes.reduce((s, q) => s + Number(q.total), 0),
    };
  }, [quotes]);

  return (
    <div className="space-y-6">
      <PageTitle title="Devis" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Devis</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Créez et gérez vos devis professionnels
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {/* Lot 45 : entrée directe IA — la modal gère elle-même le gate Premium.
              Visible pour tous, le CTA Premium apparaît dans la modal si besoin.
              Icône Sparkles + variant secondary pour ne pas voler la vedette au
              bouton principal "Nouveau devis" (workflow classique reste central). */}
          <Button variant="secondary" onClick={() => setShowAiModal(true)}>
            <Sparkles className="mr-2 h-4 w-4" />
            Générer avec l&apos;IA
          </Button>
          <Button onClick={() => setShowNewModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau devis
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Total" value={kpi.total.toString()} />
        <Kpi label="En attente" value={kpi.pending.toString()} color="text-amber-600" />
        <Kpi label="Acceptés" value={kpi.signed.toString()} color="text-emerald-600" />
        <Kpi label="Montant total" value={formatPrice(kpi.sum)} />
      </div>

      {/* Liste */}
      <div className="space-y-3">
        {quotes === null ? (
          // Skeleton pendant le chargement
          <>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </>
        ) : quotes.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-slate-900 dark:text-slate-100">
                Aucun devis pour le moment
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Créez votre premier devis pour l&apos;envoyer à un client.
              </p>
              <Button className="mt-4" onClick={() => setShowNewModal(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Créer un devis
              </Button>
            </CardContent>
          </Card>
        ) : (
          quotes.map((q) => {
            const clientLabel =
              q.clientFirstName || q.clientLastName
                ? `${q.clientFirstName ?? ""} ${q.clientLastName ?? ""}`.trim()
                : "Client supprimé";
            return (
              <Card key={q.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-6">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-slate-900 dark:text-slate-100">
                        {q.quoteNumber}
                      </h3>
                      <Badge variant={statusConfig[q.status]?.variant}>
                        {statusConfig[q.status]?.label}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">
                      {q.title} — {clientLabel}
                    </p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {formatPrice(Number(q.total))}
                    </p>
                    {q.validUntil && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Valide jusqu&apos;au {q.validUntil}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Link href={`/dashboard/quotes/${q.id}`} aria-label={`Ouvrir ${q.quoteNumber}`}>
                      <Button variant="ghost" size="icon">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                    <a
                      href={`/api/quote-pdf?quoteId=${q.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Télécharger PDF ${q.quoteNumber}`}
                    >
                      <Button variant="ghost" size="icon">
                        <Download className="h-4 w-4" />
                      </Button>
                    </a>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Modal création */}
      <Modal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        title="Nouveau devis"
        description="Un numéro sera généré automatiquement (DEV-YYYY-NNNN)"
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Titre du devis"
            placeholder="Ex: Rénovation salle de bain"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <Textarea
            label="Description (optionnelle)"
            placeholder="Détails du projet…"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h4 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
              Client
            </h4>
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
                required
                placeholder="+33 6 12 34 56 78"
              />
              <Input
                label="Email (optionnel)"
                type="email"
                value={form.clientEmail}
                onChange={(e) => setForm({ ...form, clientEmail: e.target.value })}
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Lignes du devis
              </h4>
              <div className="flex gap-1">
                {/* Lot 45 : raccourci IA depuis l'intérieur de la modal création
                    → utile quand le pro est en train de rédiger et se dit
                    "en fait je veux que l'IA fasse le gros du travail". */}
                <Button variant="ghost" size="sm" onClick={() => setShowAiModal(true)}>
                  <Sparkles className="mr-1 h-3 w-3" /> IA
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setForm({ ...form, items: [...form.items, { ...EMPTY_ITEM }] })}
                >
                  <Plus className="mr-1 h-3 w-3" /> Ajouter
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {form.items.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <div className="col-span-12 sm:col-span-6">
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => {
                        const items = [...form.items];
                        items[i] = { ...items[i], description: e.target.value };
                        setForm({ ...form, items });
                      }}
                    />
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    <Input
                      type="number"
                      min={1}
                      placeholder="Qté"
                      value={item.quantity}
                      onChange={(e) => {
                        const items = [...form.items];
                        items[i] = { ...items[i], quantity: Number(e.target.value) || 1 };
                        setForm({ ...form, items });
                      }}
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="Prix unit. (€ HT)"
                      value={item.unitPrice || ""}
                      onChange={(e) => {
                        const items = [...form.items];
                        items[i] = { ...items[i], unitPrice: Number(e.target.value) || 0 };
                        setForm({ ...form, items });
                      }}
                    />
                  </div>
                  <div className="col-span-3 sm:col-span-1 flex items-center justify-end">
                    {form.items.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Supprimer la ligne ${i + 1}`}
                        onClick={() =>
                          setForm({
                            ...form,
                            items: form.items.filter((_, idx) => idx !== i),
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 text-sm dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400">Sous-total HT</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {formatPrice(liveSubtotal)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>TVA 20%</span>
              <span>{formatPrice(liveSubtotal * 0.2)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-sm font-semibold">
              <span>Total TTC</span>
              <span>{formatPrice(liveSubtotal * 1.2)}</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Acompte (€ TTC, optionnel)"
              type="number"
              min={0}
              value={form.depositAmount || ""}
              onChange={(e) => setForm({ ...form, depositAmount: Number(e.target.value) || 0 })}
            />
            <Input
              label="Validité (jours)"
              type="number"
              min={1}
              max={365}
              value={form.validityDays}
              onChange={(e) => setForm({ ...form, validityDays: Number(e.target.value) || 30 })}
            />
          </div>

          <div className="flex flex-col justify-end gap-2 sm:flex-row sm:gap-3">
            <Button variant="outline" onClick={() => setShowNewModal(false)}>
              Annuler
            </Button>
            <Button onClick={createQuote} loading={submitting}>
              Créer le devis
            </Button>
          </div>
        </div>
      </Modal>

      {/* Lot 45 : Modal génération IA — indépendante, mais son callback
          onGenerated ouvre AUSSI la modal création (setShowNewModal(true))
          pour que le pro atterrisse directement sur le form pré-rempli.
          Le gate Premium est géré à l'intérieur du composant. */}
      <AiGenerateModal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        onGenerated={applyAiGenerated}
        existingItemsCount={form.items.filter((it) => it.description.trim().length > 0).length}
      />
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
        <p className={`text-2xl font-bold text-slate-900 dark:text-slate-100 ${color ?? ""}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
