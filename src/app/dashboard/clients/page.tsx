"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { MobileModal } from "@/components/ui/MobileModal";
import { MobileInput } from "@/components/ui/MobileInput";
import { MobileButton } from "@/components/ui/MobileButton";
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
} from "lucide-react";
import { formatPrice } from "@/lib/utils";

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
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  
  // Form state
  const [newClient, setNewClient] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [isSaving, setIsSaving] = useState(false);

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Clients</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Gérez votre base de clients (tous plans)</p>
        </div>
        <Button onClick={() => setShowNewModal(true)} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un client
        </Button>
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
                    {client.firstName[0]}{client.lastName[0]}
                  </div>
                  <div>
                    <h3 className="font-medium text-slate-900 dark:text-slate-100">{client.firstName} {client.lastName}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{client.email}</p>
                  </div>
                </div>
                <Badge variant={(client.totalSpent || 0) > 2000 ? "success" : (client.totalSpent || 0) > 500 ? "info" : "default"}>
                  {client.source || "Direct"}
                </Badge>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{formatPrice(client.totalSpent || 0)}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Dépensé</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{client.appointments || 0}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">RDV</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{client.quotes || 0}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Devis</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Client detail modal */}
      <MobileModal
        isOpen={!!selectedClient}
        onClose={() => setSelectedClient(null)}
        title={`${selectedClient?.firstName} ${selectedClient?.lastName}`}
      >
        {selectedClient && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-lg font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {selectedClient.firstName[0]}{selectedClient.lastName[0]}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{selectedClient.firstName} {selectedClient.lastName}</h3>
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
                <span>{formatPrice(selectedClient.totalSpent)}</span>
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
      </MobileModal>

      {/* New client modal */}
      <MobileModal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        title="Nouveau client"
      >
        <div className="space-y-4">
          <MobileInput 
            label="Prénom" 
            placeholder="Jean" 
            value={newClient.firstName}
            onChange={e => setNewClient({ ...newClient, firstName: e.target.value })}
          />
          <MobileInput 
            label="Nom" 
            placeholder="Dupont" 
            value={newClient.lastName}
            onChange={e => setNewClient({ ...newClient, lastName: e.target.value })}
          />
          <MobileInput 
            label="Email" 
            type="email" 
            placeholder="jean@email.fr" 
            value={newClient.email}
            onChange={e => setNewClient({ ...newClient, email: e.target.value })}
          />
          <MobileInput 
            label="Téléphone" 
            placeholder="+33612345678" 
            value={newClient.phone}
            onChange={e => setNewClient({ ...newClient, phone: e.target.value })}
          />
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowNewModal(false)} disabled={isSaving} className="flex-1">
              Annuler
            </Button>
            <MobileButton onClick={handleAddClient} loading={isSaving} className="flex-1">
              Ajouter le client
            </MobileButton>
          </div>
        </div>
      </MobileModal>
    </div>
  );
}
