"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { useAuth } from "@/contexts/AuthContext";
import { CATEGORIES, slugify } from "@/lib/utils";
// Lot 46 (F11) : gate multi-vitrines côté UI.
// L'user Free/Pro qui a déjà 1 vitrine voit un CTA upgrade au lieu du bouton "+".
import { useEntitlement } from "@/hooks/useEntitlement";
import { useToast } from "@/components/ui/Toast";
import Link from "next/link";
import { Sparkles, Lock } from "lucide-react";
import {
  Store,
  Plus,
  Settings,
  ExternalLink,
  MapPin,
  Phone,
  CheckCircle2,
  Loader2,
  Building2,
  BarChart3,
} from "lucide-react";

interface Business {
  id: string;
  name: string;
  slug: string;
  category: string;
  city: string | null;
  phone: string | null;
  address: string | null;
  createdAt: Date;
}

export default function MyBusinessesPage() {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const toast = useToast();
  // Lot 46 : gate `business.multi` — allowed=false pour Free/Pro
  const { allowed: canMulti } = useEntitlement("business.multi");
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    siret: "",
    address: "",
    city: "",
    postalCode: "",
    phone: "",
    description: "",
  });

  useEffect(() => {
    fetchBusinesses();
  }, []);

  const fetchBusinesses = async () => {
    try {
      const res = await fetch("/api/my-businesses");
      const data = await res.json();
      setBusinesses(data.businesses || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.category) return;
    setIsCreating(true);
    try {
      const res = await fetch("/api/my-businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        fetchBusinesses();
        setShowModal(false);
        setFormData({
          name: "",
          category: "",
          siret: "",
          address: "",
          city: "",
          postalCode: "",
          phone: "",
          description: "",
        });
        toast.success("Vitrine créée avec succès");
      } else {
        // Lot 46 : gestion des erreurs plan/quota renvoyées par l'API
        if (res.status === 402) {
          toast.error(
            data.error ?? "Fonctionnalité Premium requise pour créer une 2e vitrine"
          );
        } else if (res.status === 403 && data.limit) {
          toast.error(
            `Quota atteint : ${data.current}/${data.limit} vitrines. Upgrade Premium pour plus.`
          );
        } else {
          toast.error(data.error ?? "Impossible de créer la vitrine");
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Erreur réseau");
    } finally {
      setIsCreating(false);
    }
  };

  // Lot 46 : true si l'user peut créer UNE VITRINE DE PLUS (0 → toujours OK,
  // 1+ → nécessite Premium avec quota disponible)
  const canCreateMore = businesses.length === 0 || canMulti;

  const categoryInfo = (cat: string) => CATEGORIES.find((c) => c.id === cat);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Mes établissements
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Gérez toutes vos pages professionnelles
          </p>
        </div>
        {/* Lot 46 : bouton adaptatif selon plan + count actuel.
            - 0 vitrine → toujours autorisé (onboarding)
            - 1+ vitrine + plan Premium → OK
            - 1+ vitrine + plan Free/Pro → CTA upgrade au lieu du bouton */}
        {canCreateMore ? (
          <Button onClick={() => setShowModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle vitrine
          </Button>
        ) : (
          <Link href="/#pricing">
            <Button variant="secondary">
              <Sparkles className="mr-2 h-4 w-4" />
              Passer Premium
            </Button>
          </Link>
        )}
      </div>

      {/* Lot 46 : bandeau info si l'user est bloqué au quota — pédagogique */}
      {!canCreateMore && businesses.length >= 1 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900/40 dark:bg-amber-950/30">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
          <div className="flex-1">
            <p className="font-medium text-amber-900 dark:text-amber-100">
              Gérez plusieurs vitrines avec Premium
            </p>
            <p className="mt-1 text-amber-800 dark:text-amber-200">
              Idéal si vous avez plusieurs points de vente, plusieurs marques ou plusieurs
              métiers. Jusqu&apos;à 3 vitrines simultanées, un seul abonnement.
            </p>
            <Link
              href="/#pricing"
              className="mt-2 inline-block font-semibold text-amber-900 underline dark:text-amber-100"
            >
              Voir les tarifs Premium →
            </Link>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : businesses.length === 0 ? (
        <Card>
          <CardContent className="py-20 text-center">
            <Building2 className="mx-auto mb-4 h-12 w-12 text-slate-300 dark:text-slate-700" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Aucun établissement
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              Créez votre premier établissement pour commencer.
            </p>
            <Button className="mt-4" onClick={() => setShowModal(true)}>
              <Plus className="mr-2 h-4 w-4" /> Créer mon établissement
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {businesses.map((biz) => {
            const cat = categoryInfo(biz.category);
            return (
              <Card key={biz.id} className="group hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-xl dark:bg-white">
                      {cat?.icon || "🏪"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {biz.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                        {cat?.name || biz.category}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-slate-500 dark:text-slate-400">
                    {biz.city && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{biz.city}</span>
                      </div>
                    )}
                    {biz.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 flex-shrink-0" />
                        <span>{biz.phone}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <a href={`/${biz.slug}`} target="_blank" className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        <ExternalLink className="mr-1 h-3 w-3" /> Voir
                      </Button>
                    </a>
                    <Button variant="ghost" size="sm" className="flex-1">
                      <BarChart3 className="mr-1 h-3 w-3" /> Stats
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Add new card — Lot 46 : visible SEULEMENT si plan autorise ajout */}
          {canCreateMore && (
            <button
              onClick={() => setShowModal(true)}
              className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 p-8 transition-colors hover:border-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-white dark:hover:bg-slate-800"
            >
              <Plus className="h-8 w-8 text-slate-400" />
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Ajouter
              </span>
            </button>
          )}
        </div>
      )}

      {/* Create modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Nouvel établissement"
        description="Créez une nouvelle page professionnelle"
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Nom de l'établissement"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ex: Dupont Plomberie Paris 15"
          />
          <Select
            label="Type d'activité"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            placeholder="Sélectionnez..."
            options={CATEGORIES.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` }))}
          />
          <Input
            label="SIRET"
            value={formData.siret}
            onChange={(e) => setFormData({ ...formData, siret: e.target.value })}
            placeholder="123 456 789 01234"
          />
          <Input
            label="Adresse"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="12 Rue de la Paix"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Code postal"
              value={formData.postalCode}
              onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
              placeholder="75001"
            />
            <Input
              label="Ville"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="Paris"
            />
          </div>
          <Input
            label="Téléphone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+331 45 67 89 01"
          />
          <Textarea
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Décrivez cet établissement..."
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreate} loading={isCreating}>
              Créer l&apos;établissement
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
