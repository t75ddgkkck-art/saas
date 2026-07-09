"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import {
  FileText,
  Plus,
  Eye,
  Send,
  Check,
  X,
  MoreHorizontal,
  Download,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";

const statusConfig: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "info" | "purple" }> = {
  draft: { label: "Brouillon", variant: "default" },
  sent: { label: "Envoyé", variant: "warning" },
  accepted: { label: "Accepté", variant: "success" },
  rejected: { label: "Refusé", variant: "danger" },
  signed: { label: "Signé", variant: "success" },
  expired: { label: "Expiré", variant: "default" },
};

const mockQuotes = [
  { id: "DEV-2025-001", title: "Rénovation salle de bain", client: "Sophie Bernard", total: 4200, status: "sent" as const, date: "2025-01-12", validUntil: "2025-02-12", deposit: 1050 },
  { id: "DEV-2025-002", title: "Installation chauffe-eau", client: "Jean Martin", total: 890, status: "accepted" as const, date: "2025-01-11", validUntil: "2025-02-11", deposit: 222 },
  { id: "DEV-2025-003", title: "Réparation plomberie cuisine", client: "Marie Dupont", total: 350, status: "signed" as const, date: "2025-01-10", validUntil: "2025-02-10", deposit: 0 },
  { id: "DEV-2025-004", title: "Remplacement tuyaux", client: "Lucas Roux", total: 1800, status: "draft" as const, date: "2025-01-09", validUntil: "2025-02-09", deposit: 450 },
];

export default function QuotesPage() {
  const [showNewModal, setShowNewModal] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Devis</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Créez et gérez vos devis professionnels</p>
        </div>
        <Button onClick={() => setShowNewModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau devis
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Total</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{mockQuotes.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">En attente</p>
            <p className="text-2xl font-bold text-amber-600">{mockQuotes.filter((q) => q.status === "sent").length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Acceptés</p>
            <p className="text-2xl font-bold text-emerald-600">{mockQuotes.filter((q) => q.status === "accepted" || q.status === "signed").length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Montant total</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatPrice(mockQuotes.reduce((s, q) => s + q.total, 0))}</p>
          </CardContent>
        </Card>
      </div>

      {/* Quotes list */}
      <div className="space-y-3">
        {mockQuotes.map((quote) => (
          <Card key={quote.id}>
            <CardContent className="flex items-center gap-4 p-4 sm:p-6">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30">
                <FileText className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-slate-900 dark:text-slate-100">{quote.id}</h3>
                  <Badge variant={statusConfig[quote.status]?.variant}>{statusConfig[quote.status]?.label}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{quote.title} — {quote.client}</p>
              </div>
              <div className="hidden text-right sm:block">
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{formatPrice(quote.total)}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Valide jusqu&apos;au {quote.validUntil}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon"><Send className="h-4 w-4" /></Button>
                <a href={`/api/quote-pdf?quoteId=${quote.id}`} target="_blank">
                  <Button variant="ghost" size="icon"><Download className="h-4 w-4" /></Button>
                </a>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* New quote modal */}
      <Modal isOpen={showNewModal} onClose={() => setShowNewModal(false)} title="Nouveau devis" description="Créez un devis professionnel" size="lg">
        <div className="space-y-4">
          <Input label="Titre" placeholder="Ex: Rénovation salle de bain" />
          <Select label="Client" placeholder="Sélectionner un client" options={[
            { value: "1", label: "Marie Dupont" },
            { value: "2", label: "Jean Martin" },
            { value: "3", label: "Sophie Bernard" },
          ]} />
          <Input label="Catégorie" placeholder="Ex: Plomberie, Rénovation..." />
          <Textarea label="Description" placeholder="Détails du devis..." />

          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h4 className="mb-3 text-sm font-medium text-slate-900 dark:text-slate-100">Lignes du devis</h4>
            <div className="space-y-3">
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                <div className="col-span-6">Description</div>
                <div className="col-span-2">Qté</div>
                <div className="col-span-2">Prix unit.</div>
                <div className="col-span-2">Total</div>
              </div>
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-6"><Input placeholder="Description..." /></div>
                <div className="col-span-2"><Input type="number" defaultValue={1} /></div>
                <div className="col-span-2"><Input type="number" placeholder="0.00" /></div>
                <div className="col-span-2 flex items-center justify-end text-sm font-medium">0,00 €</div>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="mt-3">
              <Plus className="mr-1 h-3 w-3" /> Ajouter une ligne
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Acompte (€)" type="number" placeholder="0" />
            <Input label="Validité (jours)" type="number" placeholder="30" />
          </div>

          <Textarea label="Conditions" placeholder="Conditions générales..." />

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowNewModal(false)}>Enregistrer brouillon</Button>
            <Button>Créer et envoyer</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
