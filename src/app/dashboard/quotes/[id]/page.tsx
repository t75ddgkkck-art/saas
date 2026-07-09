"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { SignaturePad, type SignatureMetadata } from "@/components/ui/SignaturePad";
import { formatPrice } from "@/lib/utils";
import { generateProfessionalPDF } from "@/lib/generate-pdf";
import {
  ArrowLeft, Eye, Download, Send, CheckCircle2, XCircle, Pen, FileText, DollarSign, Clock
} from "lucide-react";

const mockQuote = {
  id: "DEV-2025-001",
  title: "Rénovation salle de bain",
  client: "Sophie Bernard",
  clientEmail: "sophie@email.fr",
  clientPhone: "+33699887766",
  items: [
    { description: "Dépose ancienne installation", qty: 1, unitPrice: 500, total: 500 },
    { description: "Fourniture et pose tuyauterie cuivre", qty: 15, unitPrice: 85, total: 1275 },
    { description: "Installation douche italienne", qty: 1, unitPrice: 1200, total: 1200 },
    { description: "Pose meuble vasque + robinetterie", qty: 1, unitPrice: 525, total: 525 },
  ],
  subtotal: 3500,
  tax: 700,
  total: 4200,
  deposit: 1050,
  status: "sent" as "draft" | "sent" | "accepted" | "signed" | "rejected" | "expired",
  date: "2025-01-12",
  validUntil: "2025-02-15",
  signature: null as string | null,
  signedAt: null as string | null,
};

const statusConfig: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "info" | "purple"; color: string }> = {
  draft: { label: "Brouillon", variant: "default", color: "bg-slate-100 text-slate-600" },
  sent: { label: "Envoyé", variant: "warning", color: "bg-amber-100 text-amber-700" },
  accepted: { label: "Accepté", variant: "success", color: "bg-emerald-100 text-emerald-700" },
  signed: { label: "Signé", variant: "success", color: "bg-emerald-100 text-emerald-700" },
};

export default function QuoteDetailPage() {
  const [quote, setQuote] = useState(mockQuote);
  const [showSignModal, setShowSignModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleSignature = (dataUrl: string, metadata: SignatureMetadata) => {
    setQuote((prev) => ({ ...prev, signature: dataUrl, signedAt: metadata.signedAt, status: "signed" as const }));
    setShowSignModal(false);
  };

  const handleDownloadPDF = () => {
    generateProfessionalPDF({
      type: "devis",
      number: quote.id,
      date: quote.date,
      business: {
        name: "Ambiance Service", // TODO: Get from business context
        address: "12 Rue de la Paix, 75002 Paris",
        siret: "123 456 789 00012",
        phone: "+33 1 23 45 67 89",
        email: "contact@ambiance.fr"
      },
      client: {
        name: quote.client,
        email: quote.clientEmail,
        phone: quote.clientPhone
      },
      items: quote.items.map(item => ({
        description: item.description,
        quantity: item.qty,
        unitPrice: item.unitPrice,
        total: item.total
      })),
      totalHT: quote.subtotal,
      tva: quote.tax,
      totalTTC: quote.total
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{quote.id}</h1>
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
          <Button size="sm" onClick={() => setShowSignModal(true)}>
            <Pen className="mr-1 h-4 w-4" /> Signer
          </Button>
        </div>
      </div>

      {/* Status and info */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Statut", value: statusConfig[quote.status]?.label, icon: Clock, color: statusConfig[quote.status]?.color },
          { label: "Client", value: quote.client, icon: DollarSign, color: "" },
          { label: "Montant total", value: formatPrice(quote.total), icon: FileText, color: "" },
          { label: "Acompte", value: quote.deposit ? formatPrice(quote.deposit) : "—", icon: CheckCircle2, color: "" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">{stat.label}</p>
              <p className={`mt-1 text-lg font-semibold ${stat.color || "text-slate-900 dark:text-slate-100"}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quote items */}
      <Card>
        <CardHeader>
          <CardTitle>Détail du devis</CardTitle>
        </CardHeader>
        <CardContent>
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
              {quote.items.map((item, i) => (
                <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-3 text-slate-900 dark:text-slate-100">{item.description}</td>
                  <td className="py-3 text-right text-slate-600 dark:text-slate-400">{item.qty}</td>
                  <td className="py-3 text-right text-slate-600 dark:text-slate-400">{formatPrice(item.unitPrice)}</td>
                  <td className="py-3 text-right font-medium text-slate-900 dark:text-slate-100">{formatPrice(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-6 flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                <span>Sous-total</span><span>{formatPrice(quote.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                <span>TVA (20%)</span><span>{formatPrice(quote.tax)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-bold text-slate-900 dark:text-slate-100 dark:border-slate-800">
                <span>Total TTC</span><span>{formatPrice(quote.total)}</span>
              </div>
              {quote.deposit > 0 && (
                <div className="flex justify-between text-sm text-emerald-600">
                  <span>Acompte (25%)</span><span>{formatPrice(quote.deposit)}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Signature status */}
      {quote.signedAt ? (
        <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-900/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-emerald-800 dark:text-emerald-300">Devis signé électroniquement</h3>
                <p className="text-sm text-emerald-600 dark:text-emerald-400">
                  Signé le {new Date(quote.signedAt).toLocaleString("fr-FR")}
                </p>
              </div>
              {quote.signature && (
                <div className="ml-auto">
                  <img src={quote.signature} alt="Signature" className="h-16 rounded-lg border border-emerald-200 bg-white dark:border-emerald-800" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <Pen className="mx-auto mb-3 h-8 w-8 text-slate-300 dark:text-slate-700" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Ce devis n&apos;a pas encore été signé</p>
            <Button className="mt-3" size="sm" onClick={() => setShowSignModal(true)}>
              <Pen className="mr-2 h-4 w-4" /> Signer maintenant
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Signature Modal */}
      <Modal isOpen={showSignModal} onClose={() => setShowSignModal(false)} title="Signature du devis" description={`${quote.id} — ${quote.title}`} size="lg">
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              En signant ce devis, vous acceptez les conditions et autorisez le prestataire à réaliser les travaux décrits ci-dessus pour un montant de <strong>{formatPrice(quote.total)}</strong>.
            </p>
          </div>
          <SignaturePad onSave={handleSignature} onCancel={() => setShowSignModal(false)} />
        </div>
      </Modal>

      {/* Preview Modal */}
      <Modal isOpen={showPreview} onClose={() => setShowPreview(false)} title="Aperçu du devis" size="xl">
        <iframe src={`/api/quote-pdf?quoteId=1`} className="w-full h-[600px] rounded-xl" title="Aperçu devis" />
      </Modal>
    </div>
  );
}
