"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/contexts/AuthContext";
import {
  User, Globe, CreditCard, Trash2, Check, AlertTriangle, FileText, Lock, Download,
} from "lucide-react";

const PLANS = [
  {
    id: "free", name: "Gratuit", monthly: 0, yearly: 0,
    features: ["Page vitrine publique", "Boutons contact & WhatsApp", "Galerie photos", "QR Code", "3 articles de blog SEO"],
  },
  {
    id: "pro", name: "Pro", monthly: 29, yearly: 278, // -20%
    features: ["Tout du Gratuit", "Réservation en ligne", "Devis & signature électronique", "Paiements Stripe / Apple Pay", "CRM clients", "Articles de blog illimités", "Rappels email", "Export comptable CSV", "Récap hebdomadaire", "Réponse IA aux avis"],
  },
  {
    id: "premium", name: "Premium", monthly: 79, yearly: 758, // -20%
    features: ["Tout du Pro", "Assistant IA 24/7 (chatbot public)", "Programme de fidélité", "Marque blanche", "Rappels SMS / WhatsApp", "Statistiques avancées", "Support prioritaire", "Générateur de posts réseaux sociaux", "Rapport mensuel IA", "Multi-utilisateurs (équipe)", "Chatbot IA sur vitrine", "Demande d'avis automatique", "Domaine personnalisé", "7 templates exclusifs"],
  },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const plan = user?.subscription || "free";
  const [tab, setTab] = useState<"compte" | "langue" | "abonnement" | "domaine" | "danger">("compte");
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [language, setLanguage] = useState("fr");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [checkoutMsg, setCheckoutMsg] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const cancelSubscription = async () => {
    setCancelling(true);
    try {
      const res = await fetch("/api/subscribe/cancel", { method: "POST" });
      const data = await res.json();
      setCheckoutMsg(data.success ? `✅ ${data.message}` : (data.error || "Erreur"));
      setShowCancelModal(false);
      if (data.success && !data.endOfPeriod) {
        // Downgrade immédiat → recharger pour rafraîchir le plan affiché
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch {
      setCheckoutMsg("Erreur de connexion. Réessayez.");
    } finally {
      setCancelling(false);
    }
  };

  const subscribe = async (plan: string) => {
    setSubscribing(plan);
    setCheckoutMsg("");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, billing }),
      });
      const data = await res.json();
      if (data.url) {
        // Redirection vers Stripe Checkout
        window.location.href = data.url;
      } else {
        setCheckoutMsg(data.error || "Erreur lors de la création du paiement");
        setSubscribing(null);
      }
    } catch {
      setCheckoutMsg("Erreur de connexion. Réessayez.");
      setSubscribing(null);
    }
  };

  useEffect(() => {
    // Ouvrir directement l'onglet demandé via ?tab=abonnement
    const params = new URLSearchParams(window.location.search);
    const requestedTab = params.get("tab");
    const VALID_TABS = ["compte", "langue", "abonnement", "domaine", "danger"] as const;
    type ValidTab = (typeof VALID_TABS)[number];
    if (requestedTab && (VALID_TABS as readonly string[]).includes(requestedTab)) {
      setTab(requestedTab as ValidTab);
    }
    const checkout = params.get("checkout");
    if (checkout === "success") {
      setCheckoutMsg("🎉 Paiement réussi ! Votre abonnement sera actif dans quelques secondes (rechargez la page).");
    } else if (checkout === "cancelled") {
      setCheckoutMsg("Paiement annulé. Vous pouvez réessayer quand vous voulez.");
    }
    fetch("/api/my-business").then(r => r.json()).then(b => {
      if (b?.language) setLanguage(b.language);
    }).catch(() => {});
  }, []);

  const saveLanguage = async () => {
    await fetch("/api/my-business", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "SUPPRIMER") return;
    setDeleting(true);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (res.ok) window.location.href = "/";
    } finally {
      setDeleting(false);
    }
  };

  // Lot 15.5 : export RGPD (portabilité article 20)
  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/account/export");
      if (!res.ok) {
        alert("Erreur lors de l'export. Réessayez dans quelques minutes.");
        return;
      }
      // Télécharge le fichier via un lien blob (évite de repasser par le serveur)
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vitrix-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const currentPlan = user?.subscription || "free";

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Paramètres</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Compte, langue, abonnement</p>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {[
          { id: "compte" as const, label: "Mon compte", icon: User },
          { id: "langue" as const, label: "Langue", icon: Globe },
          { id: "abonnement" as const, label: "Abonnement", icon: CreditCard },
          { id: "domaine" as const, label: "Nom de domaine", icon: Globe },
          { id: "danger" as const, label: "Suppression", icon: Trash2 },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2.5 text-xs font-medium transition-all ${
              tab === t.id ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100" : "text-slate-600 dark:text-slate-400"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        {tab === "compte" && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-xl font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{user?.firstName} {user?.lastName}</p>
                <p className="text-sm text-slate-500">{user?.email}</p>
                <Badge variant={currentPlan === "premium" ? "purple" : currentPlan === "pro" ? "info" : "default"} className="mt-1 capitalize">
                  Plan {currentPlan}
                </Badge>
              </div>
            </div>
            <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Prénom" defaultValue={user?.firstName} />
                <Input label="Nom" defaultValue={user?.lastName} />
              </div>
              <div className="mt-4">
                <Input label="Email" type="email" defaultValue={user?.email} />
              </div>
              <Button className="mt-4" size="sm">Enregistrer</Button>
            </div>
            <div className="border-t border-slate-100 pt-4 dark:border-slate-800 flex flex-wrap gap-4 text-sm">
              <a href="/cgu" target="_blank" className="flex items-center gap-1 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"><FileText className="h-3.5 w-3.5" /> Conditions générales</a>
              <a href="/faq" target="_blank" className="flex items-center gap-1 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"><FileText className="h-3.5 w-3.5" /> FAQ Vitrix</a>
              <a href="/confidentialite" target="_blank" className="flex items-center gap-1 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"><FileText className="h-3.5 w-3.5" /> Confidentialité</a>
              <a href="/mentions-legales" target="_blank" className="flex items-center gap-1 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"><FileText className="h-3.5 w-3.5" /> Mentions légales</a>
            </div>
          </div>
        )}

        {tab === "langue" && (
          <div className="space-y-4">
            <Select
              label="Langue de votre compte et de votre vitrine"
              value={language}
              onChange={e => setLanguage(e.target.value)}
              options={[
                { value: "fr", label: "🇫🇷 Français" },
                { value: "en", label: "🇬🇧 English" },
                { value: "es", label: "🇪🇸 Español" },
                { value: "de", label: "🇩🇪 Deutsch" },
              ]}
            />
            <p className="text-xs text-slate-500">Les boutons et titres de votre vitrine publique s&apos;afficheront dans cette langue pour vos clients.</p>
            <Button size="sm" onClick={saveLanguage} variant={saved ? "success" : "primary"}>
              {saved ? <><Check className="mr-1 h-4 w-4" /> Enregistré — visible sur votre vitrine</> : "Enregistrer"}
            </Button>
          </div>
        )}

        {tab === "abonnement" && (
          <div className="space-y-4">
            {checkoutMsg && (
              <div className={`rounded-xl p-4 text-sm ${checkoutMsg.startsWith("🎉") ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"}`}>
                {checkoutMsg}
              </div>
            )}
            {/* Toggle mensuel / annuel */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setBilling("monthly")}
                className={`rounded-xl px-5 py-2 text-sm font-medium transition-all ${billing === "monthly" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"}`}
              >
                Mensuel
              </button>
              <button
                onClick={() => setBilling("yearly")}
                className={`flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-medium transition-all ${billing === "yearly" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"}`}
              >
                Annuel <Badge variant="success">-20%</Badge>
              </button>
            </div>

            {PLANS.map(plan => {
              const isCurrent = currentPlan === plan.id;
              const price = billing === "monthly" ? plan.monthly : plan.yearly;
              const suffix = plan.monthly === 0 ? "" : billing === "monthly" ? "/mois" : "/an";
              return (
                <div key={plan.id} className={`rounded-xl border p-5 ${isCurrent ? "border-slate-900 dark:border-white" : "border-slate-200 dark:border-slate-800"}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{plan.name}</p>
                        {isCurrent && <Badge variant="success">Plan actuel</Badge>}
                      </div>
                      <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                        {price === 0 ? "Gratuit" : `${price}€${suffix}`}
                      </p>
                      {billing === "yearly" && plan.monthly > 0 && (
                        <p className="text-xs text-emerald-600">soit {(plan.yearly / 12).toFixed(2)}€/mois — économisez {plan.monthly * 12 - plan.yearly}€/an</p>
                      )}
                    </div>
                    {!isCurrent && plan.id !== "free" && (
                      <Button
                        size="sm"
                        variant={plan.id === "premium" ? "primary" : "outline"}
                        loading={subscribing === plan.id}
                        onClick={() => subscribe(plan.id)}
                      >
                        Choisir {plan.name}
                      </Button>
                    )}
                  </div>
                  <ul className="mt-3 space-y-1">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <Check className="h-3.5 w-3.5 text-emerald-500" /> {f}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            <p className="text-center text-xs text-slate-400">Paiement sécurisé par Stripe · Sans engagement · Résiliable à tout moment</p>

            {/* Annulation de l'abonnement en cours */}
            {currentPlan !== "free" && (
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Annuler mon abonnement {currentPlan === "premium" ? "Premium" : "Pro"}</p>
                    <p className="text-xs text-slate-500">Vous conserverez vos avantages jusqu'à la fin de la période payée, puis passerez au plan Gratuit.</p>
                  </div>
                  <Button variant="outline" size="sm" className="shrink-0 text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-900 dark:hover:bg-red-900/20" onClick={() => setShowCancelModal(true)}>
                    Annuler l'abonnement
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "domaine" && plan === "premium" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Nom de domaine personnalisé</h3>
              <p className="mt-1 text-sm text-slate-500">Utilisez votre propre nom de domaine (ex: www.mon-entreprise.fr) pour votre vitrine Vitrix.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">Configuration DNS</p>
              <p className="text-xs text-slate-500 mb-4">Pour utiliser votre domaine, vous devez configurer un enregistrement CNAME chez votre registrar :</p>
              <div className="bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-700 dark:text-slate-300">
                Type: CNAME<br/>
                Nom: www (ou @)<br/>
                Valeur: cname.vitrix.fr
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Votre nom de domaine</label>
              <Input placeholder="www.mon-entreprise.fr" />
              <p className="mt-2 text-xs text-slate-500">Une fois configuré, contactez le support Vitrix pour activer le SSL et lier le domaine.</p>
            </div>
            <Button size="sm" disabled>Demander l&apos;activation (Support)</Button>
          </div>
        )}

        {tab === "domaine" && plan !== "premium" && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Lock className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Nom de domaine personnalisé</h3>
            <p className="mt-2 text-sm text-slate-500 max-w-md">
              Cette fonctionnalité est réservée au plan Premium. Elle vous permet d'utiliser votre propre nom de domaine (ex: www.mon-entreprise.fr) pour votre vitrine.
            </p>
            <Button className="mt-6" onClick={() => setTab("abonnement")}>Passer au plan Premium</Button>
          </div>
        )}

        {tab === "danger" && (
          <div className="space-y-4">
            {/* Lot 15.5 : export RGPD portabilité */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start gap-3">
                <Download className="h-5 w-5 shrink-0 text-slate-600 dark:text-slate-400" />
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    Exporter mes données (RGPD)
                  </p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Téléchargez toutes vos données personnelles (compte, vitrine,
                    clients, RDV, devis, blog…) dans un fichier JSON structuré.
                    Conforme à l&apos;article 20 du RGPD (droit à la portabilité).
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    loading={exporting}
                    onClick={handleExport}
                  >
                    <Download className="mr-2 h-4 w-4" /> Télécharger mes données
                  </Button>
                </div>
              </div>
            </div>

            {/* Suppression compte (Lot 14 soft delete + Lot 15 RGPD) */}
            <div className="rounded-xl border border-red-200 bg-red-50 p-5 dark:border-red-900 dark:bg-red-900/10">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
                <div>
                  <p className="font-semibold text-red-800 dark:text-red-400">Supprimer mon compte</p>
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    Votre vitrine devient invisible immédiatement. Toutes vos
                    données (clients, devis, RDV, blog) sont conservées pendant
                    <strong> 30 jours</strong> puis <strong>définitivement supprimées</strong>.
                    Pendant cette période, contactez le support pour restaurer.
                  </p>
                  <Button variant="destructive" size="sm" className="mt-3" onClick={() => setShowDeleteModal(true)}>
                    <Trash2 className="mr-2 h-4 w-4" /> Supprimer mon compte
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={showCancelModal} onClose={() => setShowCancelModal(false)} title="Annuler votre abonnement ?" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Vous perdrez l'accès aux fonctionnalités {currentPlan === "premium" ? "Premium (IA, fidélité, marque blanche, templates exclusifs...)" : "Pro (réservations, devis, paiements, CRM...)"} à la fin de votre période payée. Votre vitrine restera en ligne sur le plan Gratuit.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowCancelModal(false)}>Garder mon abonnement</Button>
            <Button variant="destructive" className="flex-1" loading={cancelling} onClick={cancelSubscription}>
              Confirmer l'annulation
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Supprimer définitivement votre compte ?" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Tapez <strong>SUPPRIMER</strong> pour confirmer.
          </p>
          <Input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="SUPPRIMER" />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowDeleteModal(false)}>Annuler</Button>
            <Button variant="destructive" className="flex-1" disabled={deleteConfirm !== "SUPPRIMER"} loading={deleting} onClick={handleDeleteAccount}>
              Supprimer définitivement
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
