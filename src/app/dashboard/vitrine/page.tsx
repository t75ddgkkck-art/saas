"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/contexts/AuthContext";
import { vitrineTemplates, templatesForPlan, getTemplate } from "@/lib/vitrine-templates";
import type { Business } from "@/db/types";
// F2 (Lot 30) : éditeur inline d'acompte, gaté sur `payments.stripe`
import { ServiceDepositEditor } from "@/components/deposit/ServiceDepositEditor";
import {
  Palette,
  Globe,
  Clock,
  CreditCard,
  Gift,
  Save,
  Eye,
  Upload,
  HelpCircle,
  QrCode,
  Download,
  Plus,
  Trash2,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Link2,
  Phone,
  Star,
  Lock,
  Calendar,
  Sparkles,
} from "lucide-react";

type Section =
  | "design"
  | "personnalisation"
  | "infos"
  | "horaires"
  | "paiements"
  | "fidelite"
  | "faqsec"
  | "qrcode"
  | "devis"
  | "rdv"
  | "automations"
  | "menu";

// Types locaux pour l'éditeur de menu restaurant (jsonb côté DB)
interface MenuItem {
  name: string;
  price: string;
  description?: string;
  image?: string;
}
interface MenuCategory {
  category: string;
  items: MenuItem[];
}

export default function VitrinePage() {
  const { user } = useAuth();
  const [section, setSection] = useState<Section>("design");
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // FAQ éditable
  const [faqList, setFaqList] = useState<{ question: string; answer: string }[]>([]);
  const [savingFaqs, setSavingFaqs] = useState(false);
  const [faqsSaved, setFaqsSaved] = useState(false);

  // Avantages / highlights personnalisables
  const [highlightsList, setHighlightsList] = useState<
    Array<{ icon: string; title: string; subtitle: string }>
  >([
    { icon: "⚡", title: "Intervention rapide", subtitle: "Sous 2h" },
    { icon: "🛡️", title: "Garantie décennale", subtitle: "Travaux couverts" },
    { icon: "💬", title: "Conseil personnalisé", subtitle: "Devis gratuit" },
  ]);

  // Horaires de travail
  const [workingHoursState, setWorkingHoursState] = useState<
    Array<{ dayOfWeek: number; start: string; end: string; isOpen: boolean }>
  >(
    Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i,
      start: "09:00",
      end: "18:00",
      isOpen: i >= 1 && i <= 5,
    }))
  );
  const [savingHours, setSavingHours] = useState(false);
  const [hoursSaved, setHoursSaved] = useState(false);

  // Créneaux de RDV
  const [daysAhead, setDaysAhead] = useState(30);
  const [slotDuration, setSlotDuration] = useState(60);
  const [generatingSlots, setGeneratingSlots] = useState(false);
  const [slotsGenerated, setSlotsGenerated] = useState(0);

  // Automatisations Premium
  const [automations, setAutomations] = useState({
    publicChatEnabled: false,
    autoReviewRequest: false,
    customDomain: "",
  });

  // QR code de la vitrine
  const [vitrineQr, setVitrineQr] = useState<string>("");
  const [quoteFields, setQuoteFields] = useState<
    { label: string; type: string; options: string; required: boolean }[]
  >([
    {
      label: "Type de prestation",
      type: "select",
      options: "Réparation,Installation,Rénovation",
      required: true,
    },
    { label: "Description du projet", type: "textarea", options: "", required: true },
  ]);
  // F2 (Lot 30) : les services portent maintenant AUSSI un prix numérique en
  // centimes (`priceCents`) et une config d'acompte optionnelle (`depositType`
  // + `depositAmount`). Tous nullable pour rétro-compat totale : les services
  // existants qui n'ont pas rempli ces champs continuent de fonctionner comme
  // avant (juste le champ `price` varchar affiché).
  const [servicesList, setServicesList] = useState<
    {
      name: string;
      description: string;
      price: string;
      priceCents?: number | null;
      depositType?: "fixed" | "percent" | null;
      depositAmount?: number | null;
    }[]
  >([]);

  useEffect(() => {
    // Charger la FAQ existante
    fetch("/api/my-faqs")
      .then((r) => r.json())
      .then((d) => {
        if (d.faqs)
          setFaqList(
            d.faqs.map((f: { question: string; answer: string }) => ({
              question: f.question,
              answer: f.answer,
            }))
          );
      })
      .catch(() => {});
    fetch("/api/quote-form-fields")
      .then((r) => r.json())
      .then((d) => {
        if (d.fields && d.fields.length > 0) setQuoteFields(d.fields);
      })
      .catch(() => {});
    fetch("/api/services")
      .then((r) => r.json())
      .then((d) => {
        if (d.services && d.services.length > 0) setServicesList(d.services);
      })
      .catch(() => {});
    // Charger les horaires
    fetch("/api/my-availability")
      .then((r) => r.json())
      .then((d) => {
        if (d.hours && d.hours.length > 0) {
          const newHours = Array.from({ length: 7 }, (_, i) => {
            const existing = d.hours.find(
              (h: {
                dayOfWeek: number;
                startTime: string | null;
                endTime: string | null;
                isClosed: boolean;
              }) => h.dayOfWeek === i
            );
            return existing
              ? {
                  dayOfWeek: i,
                  start: existing.startTime || "09:00",
                  end: existing.endTime || "18:00",
                  isOpen: !existing.isClosed,
                }
              : { dayOfWeek: i, start: "09:00", end: "18:00", isOpen: i >= 1 && i <= 5 };
          });
          setWorkingHoursState(newHours);
        }
      })
      .catch(() => {});
    // Charger les automatisations
    fetch("/api/my-business")
      .then((r) => r.json())
      .then((b) => {
        if (b)
          setAutomations({
            publicChatEnabled: b.publicChatEnabled || false,
            autoReviewRequest: b.autoReviewRequest || false,
            customDomain: b.customDomain || "",
          });
      })
      .catch(() => {});
  }, []);

  const saveFaqs = async () => {
    setSavingFaqs(true);
    try {
      await fetch("/api/my-faqs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ faqs: faqList }),
      });
      setFaqsSaved(true);
      setTimeout(() => setFaqsSaved(false), 2500);
    } finally {
      setSavingFaqs(false);
    }
  };

  const saveWorkingHours = async () => {
    setSavingHours(true);
    try {
      await fetch("/api/my-availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hours: workingHoursState.map((h) => ({
            dayOfWeek: h.dayOfWeek,
            startTime: h.start,
            endTime: h.end,
            isClosed: !h.isOpen,
          })),
        }),
      });
      setHoursSaved(true);
      setTimeout(() => setHoursSaved(false), 2500);
    } finally {
      setSavingHours(false);
    }
  };

  const generateSlots = async () => {
    setGeneratingSlots(true);
    try {
      const res = await fetch("/api/my-availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daysAhead, slotDuration }),
      });
      const data = await res.json();
      if (data.slotsGenerated) {
        setSlotsGenerated(data.slotsGenerated);
        setTimeout(() => setSlotsGenerated(0), 5000);
      }
    } finally {
      setGeneratingSlots(false);
    }
  };

  const plan = user?.subscription || "free";
  const canStripe = plan === "pro" || plan === "premium";
  const canLoyalty = plan === "premium";

  const [form, setForm] = useState({
    slug: "",
    name: "",
    description: "",
    address: "",
    city: "",
    postalCode: "",
    category: "",
    phone: "",
    whatsapp: "",
    email: "",
    website: "",
    primaryColor: "#0f172a",
    // Lot 37 : personnalisation étendue
    secondaryColor: "" as string,
    accentColor: "" as string,
    fontFamily: "inter",
    sectionOrder: null as string[] | null,
    customCss: "" as string,
    hideBranding: false,
    profileImage: "",
    coverImage: "",
    enableStripe: false,
    stripeAccountId: "",
    acceptCash: true,
    acceptApplePay: false,
    // F2 (Lot 30) : politique remboursement acompte (heures avant le RDV
    // où le remboursement automatique s'applique). null = jamais auto,
    // 0 = toujours remboursé, 24/48 = fenêtre classique.
    depositRefundHours: null as number | null,
    iban: "",
    bic: "",
    loyaltyEnabled: false,
    loyaltyPointsPerEuro: 1,
    loyaltyReward: "10% de réduction après 200 points",
    emergencyPhone: "",
    showEmergency: false,
    template: "classique",
    showQrOnPage: true,
    showReviewsOnPage: true,
    highlightsEnabled: true,
    menuData: [] as MenuCategory[],
  });

  useEffect(() => {
    // Générer le QR quand le slug est chargé
    if (form.slug && typeof window !== "undefined") {
      fetch("/api/qr-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: `${window.location.origin}/${form.slug}` }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.qrCode) setVitrineQr(d.qrCode);
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.slug]);

  useEffect(() => {
    fetch("/api/my-business")
      .then((r) => r.json())
      .then((b) => {
        if (b?.id) {
          setBusiness(b);
          setForm({
            slug: b.slug || "",
            name: b.name || "",
            description: b.description || "",
            address: b.address || "",
            city: b.city || "",
            postalCode: b.postalCode || "",
            category: b.category || "",
            phone: b.phone || "",
            whatsapp: b.whatsapp || "",
            email: b.email || "",
            website: b.website || "",
            primaryColor: b.primaryColor || "#0f172a",
            secondaryColor: b.secondaryColor || "",
            accentColor: b.accentColor || "",
            fontFamily: b.fontFamily || "inter",
            sectionOrder: b.sectionOrder ?? null,
            customCss: b.customCss || "",
            hideBranding: b.hideBranding || false,
            profileImage: b.profileImage || "",
            coverImage: b.coverImage || "",
            enableStripe: b.enableStripe || false,
            stripeAccountId: b.stripeAccountId || "",
            acceptCash: b.acceptCash ?? true,
            acceptApplePay: b.acceptApplePay || false,
            depositRefundHours: b.depositRefundHours ?? null,
            iban: b.iban || "",
            bic: b.bic || "",
            loyaltyEnabled: b.loyaltyEnabled || false,
            loyaltyPointsPerEuro: b.loyaltyPointsPerEuro || 1,
            loyaltyReward: b.loyaltyReward || "10% de réduction après 200 points",
            emergencyPhone: b.emergencyPhone || "",
            showEmergency: b.showEmergency || false,
            template: b.template || "classique",
            showQrOnPage: b.showQrOnPage !== false,
            showReviewsOnPage: b.showReviewsOnPage !== false,
            highlightsEnabled: b.highlightsEnabled !== false,
            menuData: b.menuData || [],
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "profileImage" | "coverImage"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("L'image ne doit pas dépasser 2 Mo");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, [field]: reader.result as string }));
      setError("");
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      // Sauvegarder les configs générales
      const res = await fetch("/api/my-business", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, ...automations }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de sauvegarde");
      if (data.slug && data.slug !== form.slug) setForm((prev) => ({ ...prev, slug: data.slug }));

      // Sauvegarder les champs de devis
      await fetch("/api/quote-form-fields", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: quoteFields }),
      });
      // Sauvegarder les highlights + options FAQ/avis
      await fetch("/api/my-business", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          highlightsData: highlightsList,
          highlightsEnabled: form.highlightsEnabled,
          showReviewsOnPage: form.showReviewsOnPage,
        }),
      });
      // Sauvegarder la FAQ
      await fetch("/api/my-faqs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ faqs: faqList }),
      });
      // Sauvegarder les services
      await fetch("/api/services", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ services: servicesList }),
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const sections = [
    { id: "design" as Section, label: "Design", icon: Palette },
    // Lot 37 : personnalisation étendue (fonts, presets métier, ordre sections, custom CSS)
    { id: "personnalisation" as Section, label: "Personnalisation", icon: Sparkles },
    { id: "infos" as Section, label: "Infos & URL", icon: Globe },
    { id: "horaires" as Section, label: "Horaires & RDV", icon: Calendar },
    { id: "paiements" as Section, label: "Paiements", icon: CreditCard },
    { id: "fidelite" as Section, label: "Fidélité", icon: Gift },
    { id: "faqsec" as Section, label: "FAQ", icon: HelpCircle },
    { id: "qrcode" as Section, label: "QR Code", icon: QrCode },
    { id: "devis" as Section, label: "Formulaire Devis", icon: FileText },
    { id: "automations" as Section, label: "Automatisations", icon: Sparkles },
    ...(form.category === "restaurant"
      ? [{ id: "menu" as Section, label: "Carte / Menu", icon: FileText }]
      : []),
  ];

  const publicUrl =
    typeof window !== "undefined" ? `${window.location.origin}/${form.slug}` : `/${form.slug}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Ma vitrine</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Personnalisez tout, avec aperçu en direct
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open(publicUrl, "_blank")}>
            <Eye className="mr-2 h-4 w-4" /> Voir en ligne
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            loading={saving}
            variant={saved ? "success" : "primary"}
          >
            {saved ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
            {saved ? "Enregistré !" : "Enregistrer"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ==================== ÉDITEUR ==================== */}
        <div className="space-y-4">
          {/* Onglets */}
          <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap transition-all ${
                  section === s.id
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                <s.icon className="h-3.5 w-3.5" /> {s.label}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 space-y-5">
            {/* DESIGN */}
            {section === "design" && (
              <>
                {/* Choix du template (gated par plan) */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Template de votre vitrine
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {vitrineTemplates.map((tp) => {
                      const allowed = templatesForPlan(plan).some((x) => x.id === tp.id);
                      const active = form.template === tp.id;
                      return (
                        <button
                          key={tp.id}
                          onClick={() => {
                            if (allowed) setForm({ ...form, template: tp.id });
                            else window.location.href = "/dashboard/settings?tab=abonnement";
                          }}
                          className={`relative rounded-xl border-2 p-3 text-left transition-all ${
                            active
                              ? "border-slate-900 dark:border-white"
                              : "border-slate-200 dark:border-slate-800"
                          } ${!allowed ? "opacity-50" : "hover:border-slate-400"}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{tp.emoji}</span>
                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                              {tp.name}
                            </span>
                          </div>
                          <p className="mt-1 text-[10px] leading-tight text-slate-500 line-clamp-2">
                            {tp.description}
                          </p>
                          {!allowed && (
                            <span className="absolute right-2 top-2 rounded-full bg-slate-900 px-1.5 py-0.5 text-[8px] font-bold text-white dark:bg-white dark:text-slate-900">
                              {tp.plan === "premium" ? "PREMIUM" : "PRO"}
                            </span>
                          )}
                          {active && (
                            <CheckCircle2 className="absolute right-2 top-2 h-4 w-4 text-emerald-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {plan === "free" && (
                    <p className="mt-2 text-xs text-slate-500">
                      🎨 Débloquez 3 templates avec le plan Pro et 6 avec le Premium.{" "}
                      <button
                        onClick={() =>
                          (window.location.href = "/dashboard/settings?tab=abonnement")
                        }
                        className="font-medium text-blue-600 hover:underline"
                      >
                        Voir les abonnements
                      </button>
                    </p>
                  )}
                </div>

                {/* Affichage du QR code sur la vitrine */}
                <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      Afficher le QR code sur ma vitrine
                    </p>
                    <p className="text-xs text-slate-500">
                      Vos visiteurs peuvent scanner le code pour partager votre page
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.showQrOnPage}
                    onChange={(e) => setForm({ ...form, showQrOnPage: e.target.checked })}
                    className="h-5 w-5"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Photo de profil / logo
                  </label>
                  <input
                    type="file"
                    ref={logoInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageUpload(e, "profileImage")}
                  />
                  <div className="flex items-center gap-4">
                    <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                      {form.profileImage ? (
                        <img
                          src={form.profileImage}
                          alt="Logo"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Upload className="h-6 w-6 text-slate-400" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => logoInputRef.current?.click()}
                      >
                        <Upload className="mr-2 h-4 w-4" /> Importer une image
                      </Button>
                      {form.profileImage && (
                        <button
                          onClick={() => setForm({ ...form, profileImage: "" })}
                          className="block text-xs text-red-500 hover:underline"
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Photo de couverture
                  </label>
                  <input
                    type="file"
                    ref={coverInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageUpload(e, "coverImage")}
                  />
                  <div
                    onClick={() => coverInputRef.current?.click()}
                    className="flex h-28 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-800"
                  >
                    {form.coverImage ? (
                      <img
                        src={form.coverImage}
                        alt="Couverture"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="text-center text-slate-400">
                        <Upload className="mx-auto h-6 w-6" />
                        <p className="mt-1 text-xs">Cliquez pour importer</p>
                      </div>
                    )}
                  </div>
                  {form.coverImage && (
                    <button
                      onClick={() => setForm({ ...form, coverImage: "" })}
                      className="mt-1 text-xs text-red-500 hover:underline"
                    >
                      Supprimer la couverture
                    </button>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Couleur principale
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "#0f172a",
                      "#1e40af",
                      "#7c3aed",
                      "#be123c",
                      "#0d9488",
                      "#d97706",
                      "#16a34a",
                    ].map((c) => (
                      <button
                        key={c}
                        onClick={() => setForm({ ...form, primaryColor: c })}
                        className={`h-10 w-10 rounded-xl transition-transform hover:scale-110 ${form.primaryColor === c ? "ring-2 ring-offset-2 ring-slate-900 dark:ring-white" : ""}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <input
                      type="color"
                      value={form.primaryColor}
                      onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                      className="h-10 w-10 cursor-pointer rounded-xl border-0"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      Masquer "Propulsé par Vitrix"
                    </p>
                    <p className="text-xs text-slate-500">
                      Marque blanche {plan !== "premium" && "— Premium requis"}
                    </p>
                  </div>
                  {plan === "premium" ? (
                    <input
                      type="checkbox"
                      checked={form.hideBranding}
                      onChange={(e) => setForm({ ...form, hideBranding: e.target.checked })}
                      className="h-5 w-5"
                    />
                  ) : (
                    <Lock className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              </>
            )}

            {/* Lot 37 : PERSONNALISATION (fonts, presets métier, ordre sections, custom CSS) */}
            {section === "personnalisation" && (
              <PersonnalisationSection
                form={form as unknown as PersoFormLike}
                // Cast : le state parent est typé sur un objet énorme, le composant
                // Personnalisation n'a besoin que de 6 champs. Le spread ...f garde
                // toutes les autres clés intactes en runtime.
                setForm={setForm as unknown as PersoSetForm}
                plan={plan}
                category={form.category}
              />
            )}

            {/* INFOS & URL */}
            {section === "infos" && (
              <>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    URL de votre page (personnalisable)
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500 whitespace-nowrap">vitrix.fr/</span>
                    <Input
                      value={form.slug}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                        })
                      }
                      placeholder="mon-entreprise"
                    />
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                    <Link2 className="h-3 w-3" /> {publicUrl}
                  </p>
                </div>
                <Input
                  label="Nom de l'entreprise"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <Textarea
                  label="Description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Décrivez votre activité en quelques lignes..."
                />
                <Input
                  label="Adresse"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Code postal"
                    value={form.postalCode}
                    onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                  />
                  <Input
                    label="Ville"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>

                {/* Services et Tarifs */}
                <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                      Mes Services & Tarifs
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setServicesList([...servicesList, { name: "", description: "", price: "" }])
                      }
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" /> Ajouter
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {servicesList.map((s, i) => (
                      <div
                        key={i}
                        className="flex gap-2 items-start p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50"
                      >
                        <div className="flex-1 space-y-2">
                          <Input
                            placeholder="Nom du service (ex: Réparation fuite)"
                            value={s.name}
                            onChange={(e) => {
                              const next = [...servicesList];
                              next[i] = { ...next[i], name: e.target.value };
                              setServicesList(next);
                            }}
                          />
                          <div className="flex gap-2">
                            <Input
                              placeholder="Prix (ex: 50€ ou Sur devis)"
                              value={s.price}
                              onChange={(e) => {
                                const next = [...servicesList];
                                next[i] = { ...next[i], price: e.target.value };
                                setServicesList(next);
                              }}
                              className="w-1/3"
                            />
                            <Input
                              placeholder="Description courte"
                              value={s.description}
                              onChange={(e) => {
                                const next = [...servicesList];
                                next[i] = { ...next[i], description: e.target.value };
                                setServicesList(next);
                              }}
                              className="flex-1"
                            />
                          </div>
                          {/* F2 (Lot 30) : éditeur d'acompte, gaté sur payments.stripe */}
                          <ServiceDepositEditor
                            priceCents={s.priceCents}
                            depositType={s.depositType}
                            depositAmount={s.depositAmount}
                            onChange={(patch) => {
                              const next = [...servicesList];
                              next[i] = { ...next[i], ...patch };
                              setServicesList(next);
                            }}
                          />
                        </div>
                        <button
                          onClick={() => setServicesList(servicesList.filter((_, j) => j !== i))}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    {servicesList.length === 0 && (
                      <p className="text-sm text-slate-500 text-center py-4">
                        Aucun service ajouté. Ajoutez vos prestations pour les afficher sur votre
                        vitrine.
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* HORAIRES & RDV */}
            {section === "horaires" && (
              <>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">
                    Coordonnées de contact
                  </h3>
                  <div className="space-y-3">
                    <Input
                      label="Téléphone"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="+33612345678"
                    />
                    <Input
                      label="WhatsApp"
                      value={form.whatsapp}
                      onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                      placeholder="+33612345678"
                    />
                    <Input
                      label="Email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                    <Input
                      label="Site web"
                      value={form.website}
                      onChange={(e) => setForm({ ...form, website: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">
                    Horaires d&apos;ouverture
                  </h3>
                  <p className="text-xs text-slate-500 mb-3">
                    Configurez vos horaires pour afficher sur votre vitrine et générer des créneaux
                    de RDV.
                  </p>
                  <div className="space-y-2">
                    {["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"].map(
                      (day, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50"
                        >
                          <span className="w-20 text-sm font-medium text-slate-700 dark:text-slate-300">
                            {day}
                          </span>
                          <input
                            type="checkbox"
                            checked={workingHoursState[i]?.isOpen}
                            onChange={(e) => {
                              const newHours = [...workingHoursState];
                              newHours[i] = { ...newHours[i], isOpen: e.target.checked };
                              setWorkingHoursState(newHours);
                            }}
                            className="h-4 w-4"
                          />
                          {workingHoursState[i]?.isOpen && (
                            <>
                              <input
                                type="time"
                                value={workingHoursState[i].start}
                                onChange={(e) => {
                                  const newHours = [...workingHoursState];
                                  newHours[i] = { ...newHours[i], start: e.target.value };
                                  setWorkingHoursState(newHours);
                                }}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                              />
                              <span className="text-slate-400">à</span>
                              <input
                                type="time"
                                value={workingHoursState[i].end}
                                onChange={(e) => {
                                  const newHours = [...workingHoursState];
                                  newHours[i] = { ...newHours[i], end: e.target.value };
                                  setWorkingHoursState(newHours);
                                }}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                              />
                            </>
                          )}
                          {!workingHoursState[i]?.isOpen && (
                            <span className="text-sm text-slate-500">Fermé</span>
                          )}
                        </div>
                      )
                    )}
                  </div>
                  <Button
                    size="sm"
                    className="mt-3"
                    onClick={saveWorkingHours}
                    loading={savingHours}
                    variant={hoursSaved ? "success" : "primary"}
                  >
                    {hoursSaved ? (
                      <>
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Horaires enregistrés
                      </>
                    ) : (
                      "Enregistrer les horaires"
                    )}
                  </Button>
                </div>

                <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">
                    Créneaux de rendez-vous
                  </h3>
                  <p className="text-xs text-slate-500 mb-3">
                    Générez automatiquement des créneaux de RDV à partir de vos horaires.
                  </p>
                  <div className="flex gap-3 items-end">
                    <div className="flex-1">
                      <label className="text-xs text-slate-500">Jours à l&apos;avance</label>
                      <Input
                        type="number"
                        value={daysAhead}
                        onChange={(e) => setDaysAhead(parseInt(e.target.value) || 30)}
                        placeholder="30"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-slate-500">Durée (minutes)</label>
                      <Input
                        type="number"
                        value={slotDuration}
                        onChange={(e) => setSlotDuration(parseInt(e.target.value) || 60)}
                        placeholder="60"
                      />
                    </div>
                    <Button size="sm" onClick={generateSlots} loading={generatingSlots}>
                      <Calendar className="mr-1.5 h-3.5 w-3.5" /> Générer
                    </Button>
                  </div>
                  {slotsGenerated > 0 && (
                    <p className="mt-2 text-sm text-emerald-600">
                      ✅ {slotsGenerated} créneaux générés avec succès !
                    </p>
                  )}
                </div>
              </>
            )}

            {/* PAIEMENTS */}
            {section === "paiements" && (
              <>
                <div
                  className={`rounded-xl border p-4 ${canStripe ? "border-slate-200 dark:border-slate-800" : "border-slate-200 opacity-60 dark:border-slate-800"}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        Paiement en ligne (Stripe)
                      </p>
                      <p className="text-xs text-slate-500">
                        {canStripe
                          ? "Vos clients paient directement sur votre vitrine"
                          : "Disponible avec le plan Pro ou Premium"}
                      </p>
                    </div>
                    {canStripe ? (
                      <input
                        type="checkbox"
                        checked={form.enableStripe}
                        onChange={(e) => setForm({ ...form, enableStripe: e.target.checked })}
                        className="h-5 w-5"
                      />
                    ) : (
                      <Lock className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                  {canStripe && form.enableStripe && (
                    <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                      {form.stripeAccountId ? (
                        <Badge variant="success">
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Compte Stripe connecté
                        </Badge>
                      ) : (
                        <div className="space-y-2">
                          <Button
                            size="sm"
                            onClick={() => (window.location.href = "/api/stripe/connect")}
                          >
                            Connecter mon compte Stripe
                          </Button>
                          <p className="text-xs text-slate-500">
                            Vous serez redirigé vers Stripe pour lier votre compte. C&apos;est
                            gratuit et sécurisé.
                          </p>
                        </div>
                      )}
                      {/* F2 (Lot 30) : politique de remboursement d'acompte */}
                      <div className="mt-4 space-y-1">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          Politique de remboursement d&apos;acompte
                        </label>
                        <select
                          value={form.depositRefundHours ?? "none"}
                          onChange={(e) => {
                            const v = e.target.value;
                            setForm({
                              ...form,
                              depositRefundHours: v === "none" ? null : parseInt(v, 10),
                            });
                          }}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                        >
                          <option value="none">
                            Jamais remboursé automatiquement (gestion manuelle)
                          </option>
                          <option value="0">Toujours remboursé si annulation</option>
                          <option value="24">Remboursé si annulation ≥ 24h avant</option>
                          <option value="48">Remboursé si annulation ≥ 48h avant</option>
                          <option value="72">Remboursé si annulation ≥ 72h avant</option>
                          <option value="168">Remboursé si annulation ≥ 7 jours avant</option>
                        </select>
                        <p className="text-xs text-slate-500">
                          Au-delà de cette fenêtre, l&apos;acompte reste acquis en cas
                          d&apos;annulation (protection anti no-show).
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      Espèces
                    </p>
                    <p className="text-xs text-slate-500">Paiement en personne</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.acceptCash}
                    onChange={(e) => setForm({ ...form, acceptCash: e.target.checked })}
                    className="h-5 w-5"
                  />
                </div>

                <div
                  className={`flex items-center justify-between rounded-xl border p-4 ${canStripe ? "border-slate-200 dark:border-slate-800" : "opacity-60 border-slate-200 dark:border-slate-800"}`}
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      Apple Pay / Google Pay
                    </p>
                    <p className="text-xs text-slate-500">
                      {canStripe ? "Via Stripe" : "Plan Pro requis"}
                    </p>
                  </div>
                  {canStripe ? (
                    <input
                      type="checkbox"
                      checked={form.acceptApplePay}
                      onChange={(e) => setForm({ ...form, acceptApplePay: e.target.checked })}
                      className="h-5 w-5"
                    />
                  ) : (
                    <Lock className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              </>
            )}

            {/* FIDÉLITÉ */}
            {section === "fidelite" && (
              <>
                <div
                  className={`rounded-xl border p-4 ${canLoyalty ? "border-slate-200 dark:border-slate-800" : "opacity-60 border-slate-200 dark:border-slate-800"}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        Programme de fidélité
                      </p>
                      <p className="text-xs text-slate-500">
                        {canLoyalty
                          ? "Récompensez vos clients fidèles"
                          : "Disponible avec le plan Premium"}
                      </p>
                    </div>
                    {canLoyalty ? (
                      <input
                        type="checkbox"
                        checked={form.loyaltyEnabled}
                        onChange={(e) => setForm({ ...form, loyaltyEnabled: e.target.checked })}
                        className="h-5 w-5"
                      />
                    ) : (
                      <Lock className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {canLoyalty && form.loyaltyEnabled && (
                  <>
                    <Input
                      label="Points gagnés par euro dépensé"
                      type="number"
                      value={form.loyaltyPointsPerEuro}
                      onChange={(e) =>
                        setForm({ ...form, loyaltyPointsPerEuro: parseInt(e.target.value) || 1 })
                      }
                    />
                    <Textarea
                      label="Récompense"
                      value={form.loyaltyReward}
                      onChange={(e) => setForm({ ...form, loyaltyReward: e.target.value })}
                      placeholder="Ex: 10% de réduction après 200 points"
                    />
                    <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                      💡 Vos clients cumulent {form.loyaltyPointsPerEuro} point
                      {form.loyaltyPointsPerEuro > 1 ? "s" : ""} par euro. Récompense :{" "}
                      {form.loyaltyReward}
                    </div>
                  </>
                )}

                {!canLoyalty && (
                  <div className="rounded-xl bg-slate-50 p-4 text-center dark:bg-slate-800">
                    <Gift className="mx-auto mb-2 h-8 w-8 text-slate-400" />
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Passez au plan Premium pour activer le programme de fidélité.
                    </p>
                    <Button
                      size="sm"
                      className="mt-3"
                      onClick={() => (window.location.href = "/dashboard/settings?tab=abonnement")}
                    >
                      Voir les abonnements
                    </Button>
                  </div>
                )}
              </>
            )}

            {/* FAQ ÉDITABLE */}
            {section === "faqsec" && (
              <>
                <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4 dark:border-slate-800 mb-4">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      Afficher les avis clients sur la vitrine
                    </p>
                    <p className="text-xs text-slate-500">
                      Choisissez si vos avis apparaissent publiquement
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.showReviewsOnPage}
                    onChange={(e) => setForm({ ...form, showReviewsOnPage: e.target.checked })}
                    className="h-5 w-5"
                  />
                </div>

                <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        Avantages / points forts
                      </p>
                      <p className="text-xs text-slate-500">
                        Personnalisez les 3 encadrés visibles sur la vitrine
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={form.highlightsEnabled}
                      onChange={(e) => setForm({ ...form, highlightsEnabled: e.target.checked })}
                      className="h-5 w-5"
                    />
                  </div>
                  {form.highlightsEnabled && (
                    <div className="mt-4 space-y-3">
                      {highlightsList.map((h, i) => (
                        <div key={i} className="grid grid-cols-[50px_1fr_1fr] gap-2 items-center">
                          <Input
                            value={h.icon}
                            onChange={(e) => {
                              const next = [...highlightsList];
                              next[i] = { ...next[i], icon: e.target.value };
                              setHighlightsList(next);
                            }}
                            placeholder="⚡"
                            className="text-center"
                          />
                          <Input
                            value={h.title}
                            onChange={(e) => {
                              const next = [...highlightsList];
                              next[i] = { ...next[i], title: e.target.value };
                              setHighlightsList(next);
                            }}
                            placeholder="Titre"
                          />
                          <Input
                            value={h.subtitle}
                            onChange={(e) => {
                              const next = [...highlightsList];
                              next[i] = { ...next[i], subtitle: e.target.value };
                              setHighlightsList(next);
                            }}
                            placeholder="Sous-titre"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    Questions fréquentes de votre vitrine
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFaqList([...faqList, { question: "", answer: "" }])}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Ajouter
                  </Button>
                </div>
                {faqList.length === 0 && (
                  <p className="text-sm text-slate-500">
                    Aucune question. Ajoutez-en pour rassurer vos clients (tarifs, zone,
                    garanties...).
                  </p>
                )}
                {faqList.map((f, i) => (
                  <div
                    key={i}
                    className="space-y-2 rounded-xl border border-slate-200 p-4 dark:border-slate-800"
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 space-y-2">
                        <Input
                          placeholder="Question (ex: Quels sont vos tarifs ?)"
                          value={f.question}
                          onChange={(e) => {
                            const next = [...faqList];
                            next[i] = { ...next[i], question: e.target.value };
                            setFaqList(next);
                          }}
                        />
                        <Textarea
                          placeholder="Réponse..."
                          value={f.answer}
                          onChange={(e) => {
                            const next = [...faqList];
                            next[i] = { ...next[i], answer: e.target.value };
                            setFaqList(next);
                          }}
                        />
                      </div>
                      <button
                        onClick={() => setFaqList(faqList.filter((_, j) => j !== i))}
                        className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <Button
                  size="sm"
                  onClick={saveFaqs}
                  loading={savingFaqs}
                  variant={faqsSaved ? "success" : "primary"}
                >
                  {faqsSaved ? (
                    <>
                      <CheckCircle2 className="mr-1 h-4 w-4" /> FAQ enregistrée
                    </>
                  ) : (
                    "Enregistrer FAQ & Avantages"
                  )}
                </Button>
              </>
            )}

            {/* QR CODE */}
            {section === "qrcode" && (
              <>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Votre QR code pointe vers <strong>{publicUrl}</strong>. Imprimez-le sur vos cartes
                  de visite, votre vitrine ou votre véhicule.
                </p>
                <div className="flex flex-col items-center gap-4 rounded-xl bg-slate-50 p-6 dark:bg-slate-800">
                  {vitrineQr ? (
                    <img
                      src={vitrineQr}
                      alt="QR Code"
                      className="h-52 w-52 rounded-2xl bg-white p-3"
                    />
                  ) : (
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                  )}
                  {vitrineQr && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const a = document.createElement("a");
                        a.download = `qr-vitrix-${form.slug}.png`;
                        a.href = vitrineQr;
                        a.click();
                      }}
                    >
                      <Download className="mr-2 h-4 w-4" /> Télécharger le QR code
                    </Button>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  💡 Le QR code est aussi affiché automatiquement en bas de votre vitrine publique.
                </p>
              </>
            )}

            {/* FORMULAIRE DEVIS */}
            {section === "devis" && (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    Champs du formulaire de devis
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setQuoteFields([
                        ...quoteFields,
                        { label: "", type: "text", options: "", required: false },
                      ])
                    }
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Ajouter un champ
                  </Button>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  Ces champs s'ajouteront au formulaire de demande de devis sur votre vitrine.
                </p>

                {quoteFields.map((f, i) => (
                  <div
                    key={i}
                    className="flex gap-2 items-start mb-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50"
                  >
                    <div className="flex-1 space-y-2">
                      <Input
                        placeholder="Nom du champ (ex: Surface)"
                        value={f.label}
                        onChange={(e) => {
                          const next = [...quoteFields];
                          next[i] = { ...next[i], label: e.target.value };
                          setQuoteFields(next);
                        }}
                      />
                      <div className="flex gap-2">
                        <select
                          value={f.type}
                          onChange={(e) => {
                            const next = [...quoteFields];
                            next[i] = { ...next[i], type: e.target.value };
                            setQuoteFields(next);
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        >
                          <option value="text">Texte court</option>
                          <option value="textarea">Texte long</option>
                          <option value="select">Liste déroulante</option>
                          <option value="number">Nombre</option>
                        </select>
                        {f.type === "select" && (
                          <Input
                            placeholder="Options (séparées par virgule)"
                            value={f.options}
                            onChange={(e) => {
                              const next = [...quoteFields];
                              next[i] = { ...next[i], options: e.target.value };
                              setQuoteFields(next);
                            }}
                            className="flex-1"
                          />
                        )}
                        <label className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={f.required}
                            onChange={(e) => {
                              const next = [...quoteFields];
                              next[i] = { ...next[i], required: e.target.checked };
                              setQuoteFields(next);
                            }}
                          />
                          Requis
                        </label>
                      </div>
                    </div>
                    <button
                      onClick={() => setQuoteFields(quoteFields.filter((_, j) => j !== i))}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* AUTOMATISATIONS PREMIUM */}
        {section === "automations" && (
          <>
            <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-900/50 dark:bg-purple-900/10 mb-4">
              <p className="text-sm font-medium text-purple-900 dark:text-purple-200 flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Fonctionnalités Premium
              </p>
              <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                Ces outils sont réservés au plan Premium pour booster votre activité.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    🤖 Chatbot IA sur ma vitrine
                  </p>
                  <p className="text-xs text-slate-500">
                    Affiche un assistant virtuel 24/7 pour répondre à vos clients
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={automations.publicChatEnabled}
                  onChange={(e) =>
                    setAutomations({ ...automations, publicChatEnabled: e.target.checked })
                  }
                  className="h-5 w-5"
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    ⭐ Demande d'avis automatique
                  </p>
                  <p className="text-xs text-slate-500">
                    Envoie un email au client après chaque RDV terminé
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={automations.autoReviewRequest}
                  onChange={(e) =>
                    setAutomations({ ...automations, autoReviewRequest: e.target.checked })
                  }
                  className="h-5 w-5"
                />
              </div>

              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                  🌐 Domaine personnalisé
                </p>
                <p className="text-xs text-slate-500 mb-3">
                  Utilisez votre propre nom de domaine (ex: www.mon-entreprise.fr). Configurez un
                  CNAME vers vitrix.fr chez votre registrar.
                </p>
                <Input
                  placeholder="www.mon-entreprise.fr"
                  value={automations.customDomain}
                  onChange={(e) => setAutomations({ ...automations, customDomain: e.target.value })}
                />
              </div>
            </div>
          </>
        )}

        {/* MENU RESTAURANT */}
        {section === "menu" && form.category === "restaurant" && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                Carte / Menu du restaurant
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setForm({
                    ...form,
                    menuData: [
                      ...(form.menuData || []),
                      { category: "Nouvelle Catégorie", items: [] },
                    ],
                  })
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Ajouter une catégorie
              </Button>
            </div>
            <div className="space-y-6">
              {(form.menuData || []).map((cat: MenuCategory, catIndex: number) => (
                <div
                  key={catIndex}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50"
                >
                  <div className="flex items-center justify-between mb-3">
                    <Input
                      value={cat.category}
                      onChange={(e) => {
                        const newMenu = [...form.menuData];
                        newMenu[catIndex].category = e.target.value;
                        setForm({ ...form, menuData: newMenu });
                      }}
                      className="font-bold text-lg bg-transparent border-none p-0 h-auto"
                    />
                    <button
                      onClick={() => {
                        const newMenu = form.menuData.filter(
                          (_: MenuItem | MenuCategory, i: number) => i !== catIndex
                        );
                        setForm({ ...form, menuData: newMenu });
                      }}
                      className="text-red-500 hover:bg-red-50 p-2 rounded-lg"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-3 pl-4 border-l-2 border-slate-200 dark:border-slate-700">
                    {cat.items.map((item: MenuItem, itemIndex: number) => (
                      <div
                        key={itemIndex}
                        className="flex gap-2 items-start bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-100 dark:border-slate-800"
                      >
                        <div className="flex-1 space-y-2">
                          <Input
                            placeholder="Nom du plat"
                            value={item.name}
                            onChange={(e) => {
                              const newMenu = [...form.menuData];
                              newMenu[catIndex].items[itemIndex].name = e.target.value;
                              setForm({ ...form, menuData: newMenu });
                            }}
                          />
                          <div className="flex gap-2">
                            <Input
                              placeholder="Prix (ex: 15€)"
                              value={item.price}
                              onChange={(e) => {
                                const newMenu = [...form.menuData];
                                newMenu[catIndex].items[itemIndex].price = e.target.value;
                                setForm({ ...form, menuData: newMenu });
                              }}
                              className="w-24"
                            />
                            <Input
                              placeholder="Description"
                              value={item.description}
                              onChange={(e) => {
                                const newMenu = [...form.menuData];
                                newMenu[catIndex].items[itemIndex].description = e.target.value;
                                setForm({ ...form, menuData: newMenu });
                              }}
                              className="flex-1"
                            />
                          </div>
                          <Input
                            placeholder="URL Image (optionnel)"
                            value={item.image}
                            onChange={(e) => {
                              const newMenu = [...form.menuData];
                              newMenu[catIndex].items[itemIndex].image = e.target.value;
                              setForm({ ...form, menuData: newMenu });
                            }}
                            className="text-xs"
                          />
                        </div>
                        <button
                          onClick={() => {
                            const newMenu = [...form.menuData];
                            newMenu[catIndex].items = newMenu[catIndex].items.filter(
                              (_: MenuItem | MenuCategory, i: number) => i !== itemIndex
                            );
                            setForm({ ...form, menuData: newMenu });
                          }}
                          className="text-slate-400 hover:text-red-500 p-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => {
                        const newMenu = [...form.menuData];
                        if (!newMenu[catIndex].items) newMenu[catIndex].items = [];
                        newMenu[catIndex].items.push({
                          name: "",
                          price: "",
                          description: "",
                          image: "",
                        });
                        setForm({ ...form, menuData: newMenu });
                      }}
                    >
                      + Ajouter un plat
                    </Button>
                  </div>
                </div>
              ))}
              {(form.menuData || []).length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">
                  Aucune catégorie. Ajoutez des sections (Entrées, Plats, Desserts...).
                </p>
              )}
            </div>
          </>
        )}

        {/* ==================== PREVIEW LIVE ==================== */}
        <div className="lg:sticky lg:top-8 h-fit">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">
            Aperçu en direct
          </p>
          {(() => {
            const tpl = getTemplate(form.template);
            const isDark =
              tpl.style.pageBg.includes("slate-950") ||
              tpl.style.pageBg.includes("stone-950") ||
              tpl.style.pageBg.includes("bg-slate-900");
            const textColor = isDark ? "text-white" : "text-slate-900";
            const subTextColor = isDark ? "text-slate-400" : "text-slate-500";
            const cardBg = isDark ? "bg-slate-900" : "bg-white";
            const borderColor = isDark ? "border-slate-800" : "border-slate-200";

            return (
              <div
                className={`overflow-hidden rounded-3xl border-4 shadow-xl ${borderColor} w-full max-w-[380px] mx-auto lg:mx-0`}
                style={{
                  background: isDark ? "#0f172a" : "#ffffff",
                  fontFamily: tpl.style.fontFamily,
                }}
              >
                {/* Cover */}
                <div
                  className="relative h-28 sm:h-32"
                  style={{
                    background: form.coverImage
                      ? `url(${form.coverImage}) center/cover`
                      : tpl.style.coverGradient,
                  }}
                >
                  {form.coverImage && (
                    <img src={form.coverImage} alt="" className="h-full w-full object-cover" />
                  )}
                  {form.showEmergency && form.emergencyPhone && (
                    <span className="absolute right-2 top-2 rounded-full bg-red-500 px-2 py-1 text-[9px] font-bold text-white">
                      🚨 Urgence
                    </span>
                  )}
                </div>
                {/* Body */}
                <div className={`${cardBg} px-4 pb-5`}>
                  <div className="-mt-8 mb-2 flex justify-center">
                    <div
                      className={`flex h-16 w-16 items-center justify-center overflow-hidden border-4 bg-slate-900 text-2xl ${tpl.style.avatarRadius} ${isDark ? "border-slate-900" : "border-white"}`}
                    >
                      {form.profileImage ? (
                        <img
                          src={form.profileImage}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        "🏪"
                      )}
                    </div>
                  </div>
                  <div className="text-center">
                    <p className={`font-bold ${textColor}`}>{form.name || "Nom de l'entreprise"}</p>
                    <p className={`mt-1 text-[11px] line-clamp-2 ${subTextColor}`}>
                      {form.description || "Votre description apparaîtra ici"}
                    </p>
                    <div className="mt-1 flex items-center justify-center gap-1 text-[10px] text-amber-500">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> 5.0 ·{" "}
                      {form.city || "Ville"}
                    </div>
                  </div>

                  {/* Services Preview */}
                  {servicesList.length > 0 && (
                    <div className={`mt-3 space-y-1 ${subTextColor} text-[9px]`}>
                      {servicesList.slice(0, 3).map((s, i) => (
                        <div
                          key={i}
                          className="flex justify-between border-b border-dashed border-slate-200 dark:border-slate-800 pb-1 last:border-0"
                        >
                          <span>{s.name}</span>
                          <span className="font-semibold">{s.price}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Boutons contact */}
                  <div
                    className={`mt-3 grid grid-cols-2 gap-1.5 ${tpl.style.buttonRadius === "rounded-full" ? "" : ""}`}
                  >
                    <div
                      className={`${tpl.style.buttonRadius} py-2 text-center text-[10px] font-semibold text-white`}
                      style={{ backgroundColor: form.primaryColor }}
                    >
                      📞 Appeler
                    </div>
                    {form.whatsapp ? (
                      <div
                        className={`${tpl.style.buttonRadius} bg-emerald-500 py-2 text-center text-[10px] font-semibold text-white`}
                      >
                        💬 WhatsApp
                      </div>
                    ) : (
                      <div
                        className={`${tpl.style.buttonRadius} border ${borderColor} py-2 text-center text-[10px] ${subTextColor}`}
                      >
                        💬 WhatsApp
                      </div>
                    )}
                  </div>
                  <div
                    className={`mt-1.5 ${tpl.style.buttonRadius} py-2 text-center text-[10px] font-semibold text-white`}
                    style={{ backgroundColor: form.primaryColor }}
                  >
                    📅 Prendre rendez-vous
                  </div>

                  {/* Paiements */}
                  <div className="mt-3 flex justify-center gap-1">
                    {form.enableStripe && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[8px] ${isDark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-600"}`}
                      >
                        💳 CB
                      </span>
                    )}
                    {form.acceptApplePay && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[8px] ${isDark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-600"}`}
                      >
                        {" "}
                        Pay
                      </span>
                    )}
                    {form.acceptCash && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[8px] ${isDark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-600"}`}
                      >
                        💵 Espèces
                      </span>
                    )}
                  </div>
                  {/* Fidélité */}
                  {canLoyalty && form.loyaltyEnabled && (
                    <div
                      className={`mt-2 rounded-lg py-1.5 text-center text-[9px] font-medium ${isDark ? "bg-amber-900/20 text-amber-400" : "bg-amber-50 text-amber-700"}`}
                    >
                      🎁 Programme fidélité : {form.loyaltyPointsPerEuro} pt/€
                    </div>
                  )}
                  {/* Branding */}
                  {!form.hideBranding && (
                    <p className={`mt-3 text-center text-[8px] ${subTextColor}`}>
                      Propulsé par Vitrix
                    </p>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Lot 37 — Section "Personnalisation" (fonts, presets métier, ordre sections)
// -----------------------------------------------------------------------------
// Composant local séparé du gros composant `VitrinePage` pour :
//  - Isoler l'import lazy des composants Preset/Font/SectionOrder (ils ne se
//    chargent que si l'onglet Personnalisation est actif)
//  - Réduire la charge cognitive du gros switch de sections
//
// Import dynamique : les 3 sous-composants font ~15 KB à eux 3, on ne les
// charge pas si l'user ne visite jamais cet onglet.

import dynamic from "next/dynamic";
import type { ColorPreset, VitrineSectionId } from "@/lib/vitrine-personalization";
import { suggestPresetForCategory, sanitizeCustomCss } from "@/lib/vitrine-personalization";

const LazyPresetPicker = dynamic(
  () => import("@/components/vitrine/PresetPicker").then((m) => m.PresetPicker),
  {
    ssr: false,
    loading: () => <div className="h-64 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />,
  }
);
const LazyFontPicker = dynamic(
  () => import("@/components/vitrine/FontPicker").then((m) => m.FontPicker),
  {
    ssr: false,
    loading: () => <div className="h-40 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />,
  }
);
const LazySectionOrderEditor = dynamic(
  () => import("@/components/vitrine/SectionOrderEditor").then((m) => m.SectionOrderEditor),
  {
    ssr: false,
    loading: () => <div className="h-64 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />,
  }
);

interface PersonnalisationFormState {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  sectionOrder: string[] | null;
  customCss: string;
}

// Interface loose : on n'a besoin que des 6 champs de perso, le reste du form
// passe par le spread ...f. Utilise `Record<string, unknown>` pour éviter de
// dupliquer le type énorme du form parent.
type PersoFormLike = PersonnalisationFormState & Record<string, unknown>;
type PersoSetForm = (updater: (f: PersoFormLike) => PersoFormLike) => void;

function PersonnalisationSection({
  form,
  setForm,
  plan,
  category,
}: {
  form: PersoFormLike;
  setForm: PersoSetForm;
  plan: string;
  category: string;
}) {
  const isPremium = plan === "premium";

  return (
    <div className="space-y-8">
      {category && (
        <SuggestedPreset
          category={category}
          onApply={(p) => {
            setForm((f) => ({
              ...f,
              primaryColor: p.primary,
              secondaryColor: p.secondary,
              accentColor: p.accent,
            }));
          }}
        />
      )}

      {/* Palette de presets couleurs */}
      <section>
        <h3 className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">
          Palette de couleurs
        </h3>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Choisissez un preset adapté à votre métier ou personnalisez les couleurs individuellement
          plus bas.
        </p>
        <LazyPresetPicker
          primary={form.primaryColor}
          onSelect={(p: ColorPreset) => {
            setForm((f) => ({
              ...f,
              primaryColor: p.primary,
              secondaryColor: p.secondary,
              accentColor: p.accent,
            }));
          }}
        />
        <div className="mt-4 grid grid-cols-3 gap-3">
          <ColorInput
            label="Primaire"
            value={form.primaryColor}
            onChange={(v) => setForm((f) => ({ ...f, primaryColor: v }))}
          />
          <ColorInput
            label="Secondaire"
            value={form.secondaryColor}
            onChange={(v) => setForm((f) => ({ ...f, secondaryColor: v }))}
          />
          <ColorInput
            label="Accent"
            value={form.accentColor}
            onChange={(v) => setForm((f) => ({ ...f, accentColor: v }))}
          />
        </div>
      </section>

      {/* Police */}
      <section>
        <h3 className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">
          Police d&apos;écriture
        </h3>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          10 polices sélectionnées, adaptées à chaque style de métier.
        </p>
        <LazyFontPicker
          value={form.fontFamily}
          onChange={(id: string) => setForm((f) => ({ ...f, fontFamily: id }))}
        />
      </section>

      {/* Ordre des sections */}
      <section>
        <h3 className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">
          Ordre des sections
        </h3>
        <LazySectionOrderEditor
          value={form.sectionOrder}
          onChange={(order: VitrineSectionId[]) =>
            setForm((f) => ({ ...f, sectionOrder: order as string[] }))
          }
        />
      </section>

      {/* CSS custom (Premium uniquement) */}
      <section>
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          CSS personnalisé
          {!isPremium && (
            <span className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2 py-0.5 text-[10px] font-semibold text-white">
              Premium
            </span>
          )}
        </h3>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Ajoutez du CSS pour affiner l&apos;apparence de votre vitrine.{" "}
          {!isPremium && "Réservé au plan Premium."}
        </p>
        <textarea
          value={form.customCss}
          onChange={(e) => {
            const v = e.target.value.slice(0, 20 * 1024);
            setForm((f) => ({ ...f, customCss: v }));
          }}
          disabled={!isPremium}
          rows={8}
          placeholder={
            isPremium
              ? "/* Ex : .vitrine-hero { border-radius: 24px; } */"
              : "Passez à Premium pour débloquer le CSS personnalisé"
          }
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-mono text-xs text-slate-900 dark:text-slate-100 disabled:opacity-50"
        />
        {isPremium && form.customCss.length > 0 && (
          <p className="mt-1 text-[10px] text-slate-400">
            {form.customCss.length} / 20 000 caractères — les `@import`, `url()` externes et
            `expression()` sont filtrés côté serveur (sécurité).
          </p>
        )}
      </section>
    </div>
  );
}

function SuggestedPreset({
  category,
  onApply,
}: {
  category: string;
  onApply: (p: ColorPreset) => void;
}) {
  const suggested = suggestPresetForCategory(category);
  if (suggested.id === "custom") return null;
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50 dark:bg-indigo-950/40 p-3 sm:flex-row sm:items-center">
      <div className="text-2xl" aria-hidden>
        {suggested.emoji}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100">
          Suggéré pour votre métier : <strong>{suggested.label}</strong>
        </p>
        <p className="text-xs text-indigo-700 dark:text-indigo-300">
          Un preset couleurs adapté à votre secteur d&apos;activité.
        </p>
      </div>
      <button
        type="button"
        onClick={() => onApply(suggested)}
        className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
      >
        Appliquer
      </button>
    </div>
  );
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const isEmpty = !value;
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={isEmpty ? "#0f172a" : value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="h-9 w-9 shrink-0 cursor-pointer rounded border border-slate-200 dark:border-slate-700"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={isEmpty ? "Auto" : ""}
          className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs font-mono"
        />
      </div>
    </label>
  );
}

// Exports pour tests : sanitizer + presets sont dans le lib, exposés ici en re-export
// utilitaire au cas où on veuille les mocker.
export { sanitizeCustomCss, suggestPresetForCategory };
