"use client";

/**
 * Détail d'un devis (Lot 18 - fix B15 / B7).
 *
 * Avant : 100% mock (Ambiance Service, DEV-2025-001 en dur), aperçu PDF
 * pointant sur `?quoteId=1` → 404 immédiat.
 *
 * Maintenant : vraie requête `GET /api/quotes/[id]`, business context lu
 * via `/api/my-business` pour le PDF, notFound() si le devis n'existe pas.
 */

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { SignaturePad, type SignatureMetadata } from "@/components/ui/SignaturePad";
import { formatPrice } from "@/lib/utils";
import { generateProfessionalPDF } from "@/lib/generate-pdf";
import NextImage from "next/image";
import { ArrowLeft, Eye, Download, CheckCircle2, Pen, FileText, Clock } from "lucide-react";

interface QuoteDetail {
  id: string;
  quoteNumber: string;
  title: string;
  description: string | null;
  status: "draft" | "sent" | "accepted" | "rejected" | "signed" | "expired";
  subtotal: string;
  tax: string;
  total: string;
  depositAmount: string | null;
  validUntil: string | null;
  signedAt: string | null;
  signatureUrl: string | null;
  termsAndConditions: string | null;
  createdAt: string;
}

interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: string;
  total: string;
}

interface QuoteClient {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
}

interface BusinessLite {
  id: string;
  name: string;
  address: string | null;
  siret: string | null;
  phone: string | null;
  email: string | null;
}

const statusConfig: Record<
  QuoteDetail["status"],
  { label: string; variant: "default" | "success" | "warning" | "danger" | "info" | "purple" }
> = {
  draft: { label: "Brouillon", variant: "default" },
  sent: { label: "Envoyé", variant: "warning" },
  accepted: { label: "Accepté", variant: "success" },
  rejected: { label: "Refusé", variant: "danger" },
  signed: { label: "Signé", variant: "success" },
  expired: { label: "Expiré", variant: "default" },
};

export default function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // Next 15+ : params est une Promise. `use()` la unwrap côté client.
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();

  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [client, setClient] = useState<QuoteClient | null>(null);
  const [business, setBusiness] = useState<BusinessLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState<string | null>(null);
  const [showSignModal, setShowSignModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  // Lot 58 MAJ2 : nom du client tapé lors de la signature présentiel (preuve légale)
  const [presentielName, setPresentielName] = useState("");
  const [signSaving, setSignSaving] = useState(false);
  const [sendingToClient, setSendingToClient] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErrored(null);
    try {
      // On parallélise les 2 requêtes (indépendantes)
      const [qRes, bRes] = await Promise.all([
        fetch(`/api/quotes/${id}`, { cache: "no-store" }),
        fetch("/api/my-business", { cache: "no-store" }),
      ]);

      if (qRes.status === 404) {
        setErrored("Ce devis n'existe pas ou vous n'y avez pas accès.");
        return;
      }
      if (!qRes.ok) {
        setErrored("Impossible de charger ce devis.");
        return;
      }

      const qData = await qRes.json();
      setQuote(qData.quote);
      setItems(qData.items || []);
      setClient(qData.client || null);

      if (bRes.ok) {
        const bData = await bRes.json();
        if (bData?.id) setBusiness(bData);
      }
    } catch {
      setErrored("Erreur réseau. Réessayez.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Lot 58 MAJ2 — Signature EN PRÉSENTIEL par le client sur la tablette du pro.
   *
   * Avant : le bouton "Signer" ouvrait le SignaturePad puis update optimiste local
   * SANS jamais persister → bug MAJ2 (signature perdue au refresh). Maintenant on
   * appelle POST /api/quotes/[id]/mark-signed qui écrit en DB avec :
   *  - nom tapé (preuve légale)
   *  - signature dessinée (data URL PNG)
   *  - hash de preuve + IP + user-agent
   *  - facture auto générée (fire-and-forget)
   */
  const handleSignature = async (dataUrl: string, _metadata: SignatureMetadata) => {
    if (!quote) return;
    const typedName = presentielName.trim();
    if (typedName.length < 2) {
      toast.error("Saisissez le nom du signataire avant de valider.");
      return;
    }
    setSignSaving(true);
    try {
      const res = await fetch(`/api/quotes/${quote.id}/mark-signed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          typedName,
          email: client?.email ?? undefined,
          signatureDataUrl: dataUrl,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? "Impossible d'enregistrer la signature.");
        return;
      }
      toast.success("Devis signé — facture générée automatiquement.");
      setShowSignModal(false);
      setPresentielName("");
      // Reload plutôt qu'update optimiste : on veut voir la vraie signatureUrl/signedAt
      // renvoyés par le serveur (hash de preuve etc.)
      await load();
    } catch {
      toast.error("Erreur réseau. Réessayez.");
    } finally {
      setSignSaving(false);
    }
  };

  /**
   * Lot 58 MAJ2 — Envoie le devis au client par email pour signature à distance
   * (magic-link avec token). Endpoint existant depuis Lot 38.
   */
  const handleSendForSignature = async () => {
    if (!quote) return;
    if (!client?.email) {
      toast.error(
        "Le client n'a pas d'email — ajoutez-en un ou faites signer en présentiel."
      );
      return;
    }
    setSendingToClient(true);
    try {
      const res = await fetch(`/api/quotes/${quote.id}/send-signature`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? "Envoi impossible.");
        return;
      }
      toast.success(`Devis envoyé à ${client.email} pour signature.`);
      await load();
    } catch {
      toast.error("Erreur réseau. Réessayez.");
    } finally {
      setSendingToClient(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!quote) return;
    // Lot 18 B7 : business context RÉEL au lieu de "Ambiance Service" hardcodé.
    // Fallback safe si le business n'est pas encore chargé (rare).
    generateProfessionalPDF({
      type: "devis",
      number: quote.quoteNumber,
      date: quote.createdAt.slice(0, 10),
      business: {
        name: business?.name ?? "Mon entreprise",
        address: business?.address ?? "",
        siret: business?.siret ?? "",
        phone: business?.phone ?? "",
        email: business?.email ?? "",
      },
      client: {
        name: client ? `${client.firstName} ${client.lastName}` : "Client",
        email: client?.email ?? "",
        phone: client?.phone ?? "",
      },
      items: items.map((it) => ({
        description: it.description,
        quantity: it.quantity,
        unitPrice: Number(it.unitPrice),
        total: Number(it.total),
      })),
      totalHT: Number(quote.subtotal),
      tva: Number(quote.tax),
      totalTTC: Number(quote.total),
    });
  };

  // --- États UI ---

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (errored || !quote) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <FileText className="mx-auto h-12 w-12 text-slate-400" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-semibold text-slate-900 dark:text-slate-100">
          Devis introuvable
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {errored ?? "Ce devis n'existe pas ou vous n'y avez pas accès."}
        </p>
        <Button className="mt-6" onClick={() => router.push("/dashboard/quotes")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux devis
        </Button>
      </div>
    );
  }

  const total = Number(quote.total);
  const deposit = quote.depositAmount ? Number(quote.depositAmount) : 0;
  const clientLabel = client ? `${client.firstName} ${client.lastName}` : "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard/quotes")}
            aria-label="Retour"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {quote.quoteNumber}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{quote.title}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
            <Eye className="mr-1 h-4 w-4" /> Aperçu
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
            <Download className="mr-1 h-4 w-4" /> PDF
          </Button>
          {/* Lot 58 MAJ2 : ex-bouton "Signer" (fake) remplacé par 2 vrais boutons.
              Le devis est signé PAR LE CLIENT — soit à distance via email/lien,
              soit en présentiel sur la tablette du pro. */}
          {quote.status !== "signed" && quote.status !== "accepted" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSendForSignature}
                loading={sendingToClient}
                disabled={!client?.email}
                title={!client?.email ? "Le client doit avoir un email" : undefined}
              >
                <FileText className="mr-1 h-4 w-4" /> Envoyer pour signature
              </Button>
              <Button size="sm" onClick={() => setShowSignModal(true)}>
                <Pen className="mr-1 h-4 w-4" /> Signer en présentiel
              </Button>
            </>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Statut"
          value={
            <Badge variant={statusConfig[quote.status].variant}>
              {statusConfig[quote.status].label}
            </Badge>
          }
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard label="Client" value={clientLabel} icon={<FileText className="h-4 w-4" />} />
        <StatCard
          label="Total TTC"
          value={formatPrice(total)}
          icon={<FileText className="h-4 w-4" />}
        />
        <StatCard
          label="Acompte"
          value={deposit > 0 ? formatPrice(deposit) : "—"}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
      </div>

      {/* Détail */}
      <Card>
        <CardHeader>
          <CardTitle>Détail du devis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="pb-3 text-left font-medium text-slate-500">Description</th>
                  <th className="pb-3 text-right font-medium text-slate-500">Qté</th>
                  <th className="pb-3 text-right font-medium text-slate-500">Prix unit.</th>
                  <th className="pb-3 text-right font-medium text-slate-500">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800/60">
                    <td className="py-3 text-slate-900 dark:text-slate-100">{item.description}</td>
                    <td className="py-3 text-right text-slate-600 dark:text-slate-400">
                      {item.quantity}
                    </td>
                    <td className="py-3 text-right text-slate-600 dark:text-slate-400">
                      {formatPrice(Number(item.unitPrice))}
                    </td>
                    <td className="py-3 text-right font-medium text-slate-900 dark:text-slate-100">
                      {formatPrice(Number(item.total))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex justify-end">
            <div className="w-full max-w-xs space-y-2">
              <Row label="Sous-total HT" value={formatPrice(Number(quote.subtotal))} />
              <Row label="TVA" value={formatPrice(Number(quote.tax))} />
              <div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-bold text-slate-900 dark:text-slate-100 dark:border-slate-800">
                <span>Total TTC</span>
                <span>{formatPrice(total)}</span>
              </div>
              {deposit > 0 && (
                <Row label="Acompte" value={formatPrice(deposit)} color="text-emerald-600" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Signature */}
      {quote.signedAt ? (
        <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-900/20">
          <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-emerald-800 dark:text-emerald-300">
                Devis signé électroniquement
              </h3>
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                Signé le {new Date(quote.signedAt).toLocaleString("fr-FR")}
              </p>
            </div>
            {quote.signatureUrl && (
              // Signature = data-URL SVG/PNG → NextImage l'accepte via `unoptimized`.
              <div className="relative h-16 w-40 rounded-lg border border-emerald-200 bg-white dark:border-emerald-800">
                <NextImage
                  src={quote.signatureUrl}
                  alt="Signature"
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <Pen className="mx-auto mb-3 h-8 w-8 text-slate-300 dark:text-slate-700" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Ce devis n&apos;a pas encore été signé
            </p>
            {/* Lot 58 MAJ2 : idem — 2 vraies actions au lieu du bouton fake */}
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSendForSignature}
                loading={sendingToClient}
                disabled={!client?.email}
              >
                <FileText className="mr-2 h-4 w-4" /> Envoyer au client
              </Button>
              <Button size="sm" onClick={() => setShowSignModal(true)}>
                <Pen className="mr-2 h-4 w-4" /> Signer en présentiel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal signature — Lot 58 MAJ2 : signature EN PRÉSENTIEL par le client.
          Le pro passe sa tablette au client, celui-ci saisit son nom + signe.
          Preuve légale FR : nom tapé + dessin + IP + user-agent + hash SHA-256. */}
      <Modal
        isOpen={showSignModal}
        onClose={() => {
          setShowSignModal(false);
          setPresentielName("");
        }}
        title="Signature en présentiel"
        description={`${quote.quoteNumber} — ${quote.title}`}
        size="lg"
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-amber-50 p-4 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <p className="text-sm">
              👉 <strong>Passez la tablette au client.</strong> Cette signature vaut acceptation
              du devis pour un montant de <strong>{formatPrice(total)}</strong>. Une facture
              sera automatiquement générée.
            </p>
          </div>
          <div>
            <label
              htmlFor="presentiel-name"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Nom complet du signataire <span className="text-red-500">*</span>
            </label>
            <input
              id="presentiel-name"
              type="text"
              value={presentielName}
              onChange={(e) => setPresentielName(e.target.value)}
              placeholder="Prénom Nom"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900"
              maxLength={100}
              disabled={signSaving}
            />
          </div>
          <SignaturePad
            onSave={handleSignature}
            onCancel={() => {
              setShowSignModal(false);
              setPresentielName("");
            }}
          />
          {signSaving && (
            <p className="text-center text-xs text-slate-500 dark:text-slate-400">
              Enregistrement en cours…
            </p>
          )}
        </div>
      </Modal>

      {/* Modal aperçu PDF — VRAIE URL */}
      <Modal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        title="Aperçu du devis"
        size="xl"
      >
        <iframe
          src={`/api/quote-pdf?quoteId=${quote.id}`}
          className="h-[600px] w-full rounded-xl"
          title={`Aperçu ${quote.quoteNumber}`}
        />
      </Modal>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-slate-500">
          {icon}
          <p className="text-xs">{label}</p>
        </div>
        <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{value}</div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      className={`flex justify-between text-sm ${color ?? "text-slate-600 dark:text-slate-400"}`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
