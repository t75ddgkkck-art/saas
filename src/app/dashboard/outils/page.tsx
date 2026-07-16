"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/contexts/AuthContext";
import { generateProfessionalPDF } from "@/lib/generate-pdf";
import {
  Download,
  Share2,
  Users,
  Star,
  Globe,
  MessageCircle,
  Lock,
  Loader2,
  Copy,
  Check,
  Trash2,
  Plus,
  FileText,
  FileCheck,
  Eye,
  Printer,
  Calendar,
  CreditCard,
} from "lucide-react";

export default function OutilsPage() {
  const { user } = useAuth();
  const plan = user?.subscription || "free";
  const isPro = plan === "pro" || plan === "premium";
  const isPremium = plan === "premium";

  // Données du business (à fetch en production)
  const [business, setBusiness] = useState<{
    name?: string;
    slug?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    postalCode?: string;
    siret?: string;
    iban?: string;
    bic?: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/my-business")
      .then((r) => r.json())
      .then((data) => setBusiness(data))
      .catch(() => {});
  }, []);

  const bizName = business?.name || user?.firstName || "Mon Entreprise";
  const bizAddress = business?.address || "Adresse non renseignée";
  const bizSiret = business?.siret || "000 000 000 00000";
  const bizPhone = business?.phone || "";
  const bizEmail = user?.email || "";
  const bizIban = business?.iban || "";
  const bizBic = business?.bic || "";

  // États pour le générateur de devis/facture
  const [docType, setDocType] = useState<"devis" | "facture">("devis");
  const [docNumber, setDocNumber] = useState("");
  const [docDate, setDocDate] = useState(new Date().toISOString().split("T")[0]);
  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [items, setItems] = useState([{ description: "", quantity: 1, unitPrice: 0, total: 0 }]);
  const [docTemplate, setDocTemplate] = useState("standard"); // standard, moderne, minimaliste

  // Calcul des totaux
  const totalHT = items.reduce((sum, item) => sum + item.total, 0);
  const tva = totalHT * 0.2;
  const totalTTC = totalHT + tva;

  type InvoiceItem = { description: string; quantity: number; unitPrice: number; total: number };
  const updateItem = <K extends keyof InvoiceItem>(
    index: number,
    field: K,
    value: InvoiceItem[K]
  ) => {
    const newItems = [...items] as InvoiceItem[];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === "quantity" || field === "unitPrice") {
      newItems[index].total = newItems[index].quantity * newItems[index].unitPrice;
    }
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { description: "", quantity: 1, unitPrice: 0, total: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const generatePDF = () => {
    generateProfessionalPDF({
      type: docType,
      number: docNumber || `${docType === "devis" ? "DEV" : "FAC"}-${new Date().getFullYear()}-001`,
      date: docDate,
      business: {
        name: bizName,
        address: bizAddress,
        siret: bizSiret,
        phone: bizPhone,
        email: bizEmail,
        iban: bizIban || undefined,
        bic: bizBic || undefined,
      },
      client: {
        name: clientName || "Client",
        address: clientAddress,
        phone: clientPhone,
        email: clientEmail,
      },
      items: items.filter((item) => item.description),
      totalHT,
      tva,
      totalTTC,
    });
  };

  const LockedCard = ({
    title,
    desc,
    planNeeded,
  }: {
    title: string;
    desc: string;
    planNeeded: string;
  }) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 opacity-70 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
            <Lock className="h-4 w-4" /> {title}
          </p>
          <p className="mt-1 text-sm text-slate-500">{desc}</p>
        </div>
        <Button
          size="sm"
          onClick={() => (window.location.href = "/dashboard/settings?tab=abonnement")}
        >
          Passer {planNeeded}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
          Outils Professionnels
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
          Générez des documents PDF professionnels, exportez vos données et automatisez votre
          activité
        </p>
      </div>

      {/* ===== GÉNÉRATEUR DE DEVIS/FACTURE ===== */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100 text-lg">
              <FileCheck className="h-5 w-5 text-blue-600" />
              Générateur de Devis & Factures
            </p>
            <p className="text-sm text-slate-500 mt-1">
              Créez des documents PDF professionnels avec aperçu en direct
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={docType === "devis" ? "primary" : "outline"}
              size="sm"
              onClick={() => setDocType("devis")}
            >
              Devis
            </Button>
            <Button
              variant={docType === "facture" ? "primary" : "outline"}
              size="sm"
              onClick={() => setDocType("facture")}
            >
              Facture
            </Button>
            {isPremium && (
              <select
                value={docTemplate}
                onChange={(e) => setDocTemplate(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <option value="standard">Style Standard</option>
                <option value="moderne">Style Moderne</option>
                <option value="minimaliste">Style Minimaliste</option>
              </select>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Formulaire */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Numéro du document"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                placeholder={`${docType === "devis" ? "DEV" : "FAC"}-2024-001`}
              />
              <Input
                label="Date"
                type="date"
                value={docDate}
                onChange={(e) => setDocDate(e.target.value)}
              />
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">
                Coordonnées bancaires (affichées sur le PDF)
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="IBAN"
                  value={bizIban}
                  onChange={(e) => {
                    setBusiness({ ...business, iban: e.target.value });
                  }}
                  placeholder="FR76 ...."
                />
                <Input
                  label="BIC"
                  value={bizBic}
                  onChange={(e) => {
                    setBusiness({ ...business, bic: e.target.value });
                  }}
                  placeholder="XXXXFRPP"
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                💡 Ces infos apparaîtront en bas de vos PDF. Sauvegardez-les dans Ma vitrine →
                Paiements pour les garder.
              </p>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">
                Informations client
              </h3>
              <div className="space-y-3">
                <Input
                  label="Nom du client"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Jean Dupont"
                />
                <Input
                  label="Email"
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="jean@exemple.fr"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Téléphone"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="+33 6 12 34 56 78"
                  />
                  <Input
                    label="Adresse"
                    value={clientAddress}
                    onChange={(e) => setClientAddress(e.target.value)}
                    placeholder="12 Rue de la Paix, Paris"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Prestations</h3>
                <Button variant="outline" size="sm" onClick={addItem}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Ajouter
                </Button>
              </div>
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div
                    key={index}
                    className="flex gap-2 items-start p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50"
                  >
                    <div className="flex-1 space-y-2">
                      <Input
                        placeholder="Description de la prestation"
                        value={item.description}
                        onChange={(e) => updateItem(index, "description", e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="Qté"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(index, "quantity", parseInt(e.target.value) || 0)
                          }
                          className="w-20"
                        />
                        <Input
                          type="number"
                          placeholder="Prix unitaire"
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateItem(index, "unitPrice", parseFloat(e.target.value) || 0)
                          }
                          className="w-32"
                        />
                        <div className="flex items-center px-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {item.total.toFixed(2)} €
                        </div>
                      </div>
                    </div>
                    {items.length > 1 && (
                      <button
                        onClick={() => removeItem(index)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Button className="w-full" size="lg" onClick={generatePDF}>
              <Printer className="mr-2 h-4 w-4" />
              Générer et Télécharger le PDF
            </Button>
          </div>

          {/* Aperçu en direct */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-6 bg-white dark:bg-slate-900">
            <div className="flex items-center gap-2 mb-4 text-sm text-slate-500">
              <Eye className="h-4 w-4" />
              Aperçu en direct ({docTemplate})
            </div>
            <div
              className={`border rounded-lg p-6 bg-white text-slate-900 min-h-[600px] transition-all ${
                docTemplate === "moderne"
                  ? "border-blue-500 shadow-lg shadow-blue-100"
                  : docTemplate === "minimaliste"
                    ? "border-slate-200"
                    : "border-slate-300 dark:border-slate-700"
              }`}
              style={{
                fontFamily:
                  docTemplate === "moderne"
                    ? "sans-serif"
                    : docTemplate === "minimaliste"
                      ? "monospace"
                      : "serif",
              }}
            >
              {/* En-tête */}
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{bizName}</h2>
                  <p className="text-sm text-slate-600 mt-1">{bizAddress}</p>
                  {bizSiret && bizSiret !== "000 000 000 00000" && (
                    <p className="text-xs text-slate-500 mt-1">SIRET: {bizSiret}</p>
                  )}
                </div>
                <div className="text-right">
                  <h3 className="text-3xl font-bold text-slate-900">
                    {docType === "devis" ? "DEVIS" : "FACTURE"}
                  </h3>
                  <p className="text-sm text-slate-600 mt-1">
                    N° {docNumber || `${docType === "devis" ? "DEV" : "FAC"}-2024-001`}
                  </p>
                  <p className="text-sm text-slate-600">Date: {docDate}</p>
                </div>
              </div>

              {/* Client */}
              <div className="mb-8 p-4 bg-slate-50 rounded-lg">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Facturé à :</p>
                <p className="font-semibold text-slate-900">{clientName || "Client"}</p>
                {clientAddress && <p className="text-sm text-slate-600">{clientAddress}</p>}
                {clientEmail && <p className="text-sm text-slate-600">{clientEmail}</p>}
                {clientPhone && <p className="text-sm text-slate-600">{clientPhone}</p>}
              </div>

              {/* Tableau */}
              <table className="w-full mb-8">
                <thead>
                  <tr className="border-b-2 border-slate-900">
                    <th className="text-left py-2 text-sm font-semibold">Description</th>
                    <th className="text-center py-2 text-sm font-semibold">Qté</th>
                    <th className="text-right py-2 text-sm font-semibold">Prix Unit.</th>
                    <th className="text-right py-2 text-sm font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items
                    .filter((item) => item.description)
                    .map((item, index) => (
                      <tr key={index} className="border-b border-slate-200">
                        <td className="py-3 text-sm">{item.description}</td>
                        <td className="py-3 text-sm text-center">{item.quantity}</td>
                        <td className="py-3 text-sm text-right">{item.unitPrice.toFixed(2)} €</td>
                        <td className="py-3 text-sm text-right font-semibold">
                          {item.total.toFixed(2)} €
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>

              {/* Totaux */}
              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Total HT:</span>
                    <span className="font-semibold">{totalHT.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">TVA (20%):</span>
                    <span className="font-semibold">{tva.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t-2 border-slate-900 pt-2">
                    <span>Total TTC:</span>
                    <span>{totalTTC.toFixed(2)} €</span>
                  </div>
                </div>
              </div>

              {/* Pied de page */}
              <div className="mt-12 pt-4 border-t border-slate-200 text-center text-xs text-slate-500">
                Document généré par Vitrix - www.vitrix.fr
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== EXPORTS PDF ===== */}
      {isPro ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
            <FileText className="h-5 w-5 text-emerald-600" /> Exports PDF Professionnels
            <Badge variant="info">Pro</Badge>
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Exportez vos données en PDF formatés professionnellement pour votre comptable.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { type: "payments", label: "Paiements", icon: CreditCard },
              { type: "clients", label: "Clients", icon: Users },
              { type: "quotes", label: "Devis", icon: FileText },
              { type: "appointments", label: "Rendez-vous", icon: Calendar },
            ].map((e) => (
              <Button
                key={e.type}
                variant="outline"
                size="sm"
                onClick={() => {
                  // Simulation d'export PDF - en production, fetch les vraies données
                  generateProfessionalPDF({
                    type: "facture",
                    number: `EXPORT-${e.type.toUpperCase()}`,
                    date: new Date().toISOString().split("T")[0],
                    business: {
                      name: bizName,
                      address: bizAddress,
                      siret: bizSiret,
                      phone: bizPhone,
                      email: bizEmail,
                    },
                    client: { name: `Export ${e.label}` },
                    items: [],
                    totalHT: 0,
                    tva: 0,
                    totalTTC: 0,
                  });
                }}
              >
                <e.icon className="mr-1.5 h-3.5 w-3.5" /> {e.label}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <LockedCard
          title="Exports PDF Professionnels"
          desc="Paiements, clients, devis et RDV exportés en PDF formatés pour votre comptable."
          planNeeded="Pro"
        />
      )}

      {/* Lot 49 : section "Automatisations Premium" retirée d'ici — c'était un
          DOUBLON avec /dashboard/vitrine > onglet "Automatisations" qui gère déjà
          les toggles publicChatEnabled + autoReviewRequest. Ces checkboxes-là
          n'étaient PAS câblées (pas de handler onChange, pas de state initial) →
          silencieusement inutiles + confusion UX. Le vrai éditeur reste dans vitrine. */}
    </div>
  );
}
