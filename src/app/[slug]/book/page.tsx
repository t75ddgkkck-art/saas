"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { getBookingConfig } from "@/lib/booking-configs";
import { CheckCircle2, CreditCard, Banknote, Apple } from "lucide-react";

export default function BookPage() {
  const params = useParams<{ slug: string }>();
  interface Slot { id: string; date: string; startTime: string; endTime: string }
  const [step, setStep] = useState(1);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [form, setForm] = useState<Record<string, string>>({ firstName: "", lastName: "", phone: "", email: "", payment: "stripe" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const bookingConfig = getBookingConfig("plombier"); // À rendre dynamique plus tard

  useEffect(() => {
    if (params.slug) {
      fetch(`/api/availability?business=${params.slug}`)
        .then(r => r.json())
        .then(data => setSlots(data.slots || []));
    }
  }, [params.slug]);

  const groupedSlots: Record<string, any[]> = {};
  slots.forEach(slot => {
    if (!groupedSlots[slot.date]) groupedSlots[slot.date] = [];
    groupedSlots[slot.date].push(slot);
  });

  const handleBook = async () => {
    if (!selectedSlot || !form.firstName || !form.phone) return;
    setLoading(true);

    try {
      const res = await fetch("/api/book-appointment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessSlug: params.slug,
          ...form,
          date: selectedSlot.date,
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime,
        }),
      });

      if (res.ok) {
        setSuccess(true);
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-12 pb-12">
            <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500" />
            <h1 className="mt-6 text-2xl font-bold text-slate-900 dark:text-slate-100">Réservation confirmée !</h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              {form.firstName}, votre rendez-vous du {selectedSlot?.date} à {selectedSlot?.startTime} est confirmé.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Réserver un créneau</h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400">Choisissez votre date, heure et mode de paiement</p>
        </div>

        {/* Étape 1 : Créneaux */}
        {step === 1 && (
          <div>
            <h2 className="font-semibold mb-4">Choisissez un créneau</h2>
            <div className="space-y-6">
              {Object.entries(groupedSlots).slice(0, 7).map(([date, daySlots]) => (
                <div key={date}>
                  <p className="text-sm font-medium text-slate-500 mb-2">{date}</p>
                  <div className="flex flex-wrap gap-2">
                    {daySlots.map((slot, i) => (
                      <button
                        key={i}
                        onClick={() => { setSelectedSlot(slot); setStep(2); }}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-sm hover:border-slate-900 dark:border-slate-700 dark:hover:border-white"
                      >
                        {slot.startTime}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Étape 2 : Infos dynamiques + Paiement */}
        {step === 2 && selectedSlot && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Créneau sélectionné</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">{selectedSlot.date} à {selectedSlot.startTime}</p>
              </CardContent>
            </Card>

            {/* Champs dynamiques selon le métier */}
            <Card>
              <CardHeader>
                <CardTitle>Vos informations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Prénom" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
                  <Input label="Nom" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
                </div>
                <Input label="Téléphone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                <Input label="Email (pour recevoir votre confirmation)" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="vous@email.fr" required />

                {/* Champs dynamiques */}
                {bookingConfig.fields.map((field) => (
                  <div key={field.id}>
                    {field.type === "select" && (
                      <Select
                        label={field.label}
                        options={field.options || []}
                        value={form[field.id] || ""}
                        onChange={(e) => setForm({ ...form, [field.id]: e.target.value })}
                      />
                    )}
                    {field.type === "textarea" && (
                      <Textarea
                        label={field.label}
                        value={form[field.id] || ""}
                        onChange={(e) => setForm({ ...form, [field.id]: e.target.value })}
                      />
                    )}
                    {field.type === "text" && (
                      <Input
                        label={field.label}
                        value={form[field.id] || ""}
                        onChange={(e) => setForm({ ...form, [field.id]: e.target.value })}
                      />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Paiement */}
            <Card>
              <CardHeader>
                <CardTitle>Mode de paiement</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: "stripe", label: "Carte", icon: CreditCard },
                    { value: "apple", label: "Apple Pay", icon: Apple },
                    { value: "cash", label: "Espèces", icon: Banknote },
                  ].map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setForm({ ...form, payment: p.value })}
                      className={`p-4 rounded-xl border flex flex-col items-center gap-2 ${form.payment === p.value ? "border-slate-900 bg-slate-50 dark:border-white dark:bg-slate-800" : "border-slate-200 dark:border-slate-700"}`}
                    >
                      <p.icon className="h-6 w-6" />
                      <span className="text-sm">{p.label}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Retour</Button>
              <Button className="flex-1" loading={loading} onClick={handleBook}>Confirmer la réservation</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
