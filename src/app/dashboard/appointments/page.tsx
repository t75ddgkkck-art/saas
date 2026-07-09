"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import {
  Calendar,
  Clock,
  Plus,
  CheckCircle2,
  XCircle,
  MoreHorizontal,
  User,
} from "lucide-react";

const statusConfig: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "info" | "purple" }> = {
  pending: { label: "En attente", variant: "warning" },
  confirmed: { label: "Confirmé", variant: "success" },
  cancelled: { label: "Annulé", variant: "danger" },
  completed: { label: "Terminé", variant: "info" },
};

const mockAppointments = [
  { id: 1, client: "Marie Dupont", title: "Réparation fuite", date: "2025-01-15", startTime: "09:00", endTime: "10:00", status: "confirmed", phone: "+33612345678" },
  { id: 2, client: "Jean Martin", title: "Installation chauffe-eau", date: "2025-01-15", startTime: "14:00", endTime: "16:00", status: "pending", phone: "+33623456789" },
  { id: 3, client: "Sophie Bernard", title: "Devis rénovation SdB", date: "2025-01-16", startTime: "10:30", endTime: "11:30", status: "confirmed", phone: "+33634567890" },
  { id: 4, client: "Lucas Roux", title: "Urgence fuite garage", date: "2025-01-14", startTime: "16:00", endTime: "17:00", status: "completed", phone: "+33645678901" },
  { id: 5, client: "Claire Petit", title: "Entretien annuel", date: "2025-01-13", startTime: "11:00", endTime: "12:00", status: "completed", phone: "+33656789012" },
];

export default function AppointmentsPage() {
  const [showNewModal, setShowNewModal] = useState(false);
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all" ? mockAppointments : mockAppointments.filter((a) => a.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Rendez-vous</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Gérez vos rendez-vous et disponibilités</p>
        </div>
        <Button onClick={() => setShowNewModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau RDV
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto">
        {["all", "pending", "confirmed", "completed", "cancelled"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              filter === f
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
            }`}
          >
            {f === "all" ? "Tous" : statusConfig[f]?.label}
          </button>
        ))}
      </div>

      {/* Appointments list */}
      <div className="space-y-3">
        {filtered.map((apt) => (
          <Card key={apt.id}>
            <CardContent className="flex items-center gap-4 p-4 sm:p-6">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30">
                <Calendar className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-slate-900 dark:text-slate-100">{apt.title}</h3>
                  <Badge variant={statusConfig[apt.status]?.variant}>{statusConfig[apt.status]?.label}</Badge>
                </div>
                <p className="mt-1 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <User className="h-3.5 w-3.5" />
                  {apt.client}
                </p>
              </div>
              <div className="hidden text-right text-sm sm:block">
                <p className="text-slate-900 dark:text-slate-100">{apt.date}</p>
                <p className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                  <Clock className="h-3.5 w-3.5" />
                  {apt.startTime} - {apt.endTime}
                </p>
              </div>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* New Appointment Modal */}
      <Modal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        title="Nouveau rendez-vous"
        description="Planifiez un rendez-vous avec un client"
        size="lg"
      >
        <div className="space-y-4">
          <Input label="Titre" placeholder="Ex: Réparation fuite" />
          <Select label="Client" placeholder="Sélectionner un client" options={[
            { value: "1", label: "Marie Dupont" },
            { value: "2", label: "Jean Martin" },
            { value: "3", label: "Sophie Bernard" },
          ]} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Date" type="date" />
            <Select label="Créneau" options={[
              { value: "09:00", label: "09:00 - 10:00" },
              { value: "10:00", label: "10:00 - 11:00" },
              { value: "14:00", label: "14:00 - 15:00" },
              { value: "15:00", label: "15:00 - 16:00" },
            ]} />
          </div>
          <Textarea label="Notes" placeholder="Détails du rendez-vous..." />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowNewModal(false)}>Annuler</Button>
            <Button>Créer le rendez-vous</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
