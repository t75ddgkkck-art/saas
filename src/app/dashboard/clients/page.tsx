"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import {
  Users,
  Search,
  Plus,
  Mail,
  Phone,
  FileText,
  CalendarDays,
  DollarSign,
  MoreHorizontal,
  User,
  Loader2,
  Upload,
  Download,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { formatPrice } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { PageTitle } from "@/components/layout/PageTitle";

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  totalSpent?: number;
  appointments?: number;
  quotes?: number;
  lastContact?: string;
  source?: string;
}

export default function ClientsPage() {
  const toast = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [importing, setImporting] = useState(false);

  // Form state
  const [newClient, setNewClient] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [isSaving, setIsSaving] = useState(false);

  // Lot 24 : import CSV via <input type="file"> caché (déclenché par bouton)
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/clients/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur d'import");
      toast.success(
        `Import terminé — ${data.imported} créés, ${data.updated} mis à jour, ${data.skipped} ignorés`
      );
      if (data.errors?.length > 0) {
        toast.warning(`${data.errors.length} lignes en erreur (voir console)`);
        // eslint-disable-next-line no-console
        console.warn("[import] erreurs:", data.errors);
      }
      fetchClients();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur d'import");
    } finally {
      setImporting(false);
      e.target.value = ""; // reset input pour ré-import du même fichier possible
    }
  }

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const res = await fetch("/api/clients");
      const data = await res.json();
      setClients(data.clients || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddClient = async () => {
    if (!newClient.firstName && !newClient.email) return;
    setIsSaving(true);
    try {
      await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newClient),
      });
      setShowNewModal(false);
      setNewClient({ firstName: "", lastName: "", email: "", phone: "" });
      fetchClients();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = clients.filter(
    (c) =>
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageTitle title="Clients" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Clients</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Gérez votre base de clients — importez / exportez au format CSV
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Lot 24 : import CSV (input file caché + label) */}
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleImport}
              className="hidden"
              disabled={importing}
            />
            <span className="inline-flex h-11 items-center rounded-xl border-2 border-slate-200 bg-transparent px-5 text-sm font-medium text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800">
              {importing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Importer CSV
            </span>
          </label>
          <a
            href="/api/clients/export"
            className="inline-flex h-11 items-center rounded-xl border-2 border-slate-200 bg-transparent px-5 text-sm font-medium text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            Exporter CSV
          </a>
          <Button onClick={() => setShowNewModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Ajouter
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Rechercher un client..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>

      {/* Client cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((client) => (
          <Card
            key={client.id}
            className="cursor-pointer transition-all hover:shadow-md"
            onClick={() => setSelectedClient(client)}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {client.firstName[0]}
                    {client.lastName[0]}
                  </div>
                  <div>
                    <h3 className="font-medium text-slate-900 dark:text-slate-100">
                      {client.firstName} {client.lastName}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{client.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      (client.totalSpent || 0) > 2000
                        ? "success"
                        : (client.totalSpent || 0) > 500
                          ? "info"
                          : "default"
                    }
                  >
                    {client.source || "Direct"}
                  </Badge>
                  {/* Lot 24 : lien direct vers la fiche détaillée (stopPropagation
                      pour ne pas ouvrir aussi le modal recap) */}
                  <Link
                    href={`/dashboard/clients/${client.id}`}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Voir la fiche de ${client.firstName} ${client.lastName}`}
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {formatPrice(client.totalSpent || 0)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Dépensé</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {client.appointments || 0}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">RDV</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {client.quotes || 0}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Devis</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Client detail modal */}
      <Modal
        isOpen={!!selectedClient}
        onClose={() => setSelectedClient(null)}
        title={`${selectedClient?.firstName} ${selectedClient?.lastName}`}
      >
        {selectedClient && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-lg font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {selectedClient.firstName[0]}
                {selectedClient.lastName[0]}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {selectedClient.firstName} {selectedClient.lastName}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{selectedClient.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-slate-400" />
                <span>{selectedClient.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-slate-400" />
                <span>{selectedClient.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CalendarDays className="h-4 w-4 text-slate-400" />
                <span>{selectedClient.appointments} rendez-vous</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-slate-400" />
                <span>{formatPrice(selectedClient.totalSpent ?? 0)}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <a href={`tel:${selectedClient.phone}`} className="flex-1">
                <Button variant="outline" className="w-full">
                  <Phone className="mr-2 h-4 w-4" /> Appeler
                </Button>
              </a>
              <a href={`mailto:${selectedClient.email}`} className="flex-1">
                <Button variant="outline" className="w-full">
                  <Mail className="mr-2 h-4 w-4" /> Email
                </Button>
              </a>
            </div>
          </div>
        )}
      </Modal>

      {/* New client modal */}
      <Modal isOpen={showNewModal} onClose={() => setShowNewModal(false)} title="Nouveau client">
        <div className="space-y-4">
          <Input
            label="Prénom"
            placeholder="Jean"
            value={newClient.firstName}
            onChange={(e) => setNewClient({ ...newClient, firstName: e.target.value })}
          />
          <Input
            label="Nom"
            placeholder="Dupont"
            value={newClient.lastName}
            onChange={(e) => setNewClient({ ...newClient, lastName: e.target.value })}
          />
          <Input
            label="Email"
            type="email"
            placeholder="jean@email.fr"
            value={newClient.email}
            onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
          />
          <Input
            label="Téléphone"
            placeholder="+33612345678"
            value={newClient.phone}
            onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
          />
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowNewModal(false)}
              disabled={isSaving}
              className="flex-1"
            >
              Annuler
            </Button>
            <Button onClick={handleAddClient} loading={isSaving} className="flex-1">
              Ajouter le client
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
