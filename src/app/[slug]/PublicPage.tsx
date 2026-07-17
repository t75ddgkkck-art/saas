"use client";

import { useState, useEffect } from "react";
import {
  Phone,
  MessageCircle,
  Mail,
  MapPin,
  Star,
  ChevronDown,
  ChevronUp,
  Calendar,
  AlertTriangle,
  Globe,
  Share2,
  ArrowLeft,
  FileText,
  Loader2,
  Briefcase,
  CreditCard,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { formatPrice } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { getTemplate } from "@/lib/vitrine-templates";
// Lot 37 : font stack utilisée si le pro a choisi une font custom.
// Helper léger inline pour éviter d'importer tout le lib côté public
// (garde le bundle vitrine minimal).
function getVitrineFontStack(fontId: string): string {
  const STACKS: Record<string, string> = {
    "system-sans":
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    georgia: 'Georgia, "Times New Roman", Times, serif',
    playfair: '"Playfair Display", Georgia, serif',
    poppins: '"Poppins", -apple-system, sans-serif',
    montserrat: '"Montserrat", -apple-system, sans-serif',
    raleway: '"Raleway", -apple-system, sans-serif',
    merriweather: '"Merriweather", Georgia, serif',
    lora: '"Lora", Georgia, serif',
    "roboto-mono": '"Roboto Mono", "SF Mono", Menlo, monospace',
  };
  return STACKS[fontId] ?? "";
}
import { QuoteForm } from "@/components/public/QuoteForm";
import { BusinessStructuredData } from "@/components/public/StructuredData";
import { PublicChat } from "@/components/public/PublicChat";
import { WorkingHoursCard } from "./sections/WorkingHoursCard";
import { QrCodeCard } from "./sections/QrCodeCard";
import { PublicFooter } from "./sections/PublicFooter";
import { OptimizedImage } from "@/components/ui/OptimizedImage";
import { Lightbox, type LightboxItem } from "@/components/public/Lightbox";
import { MapEmbed } from "@/components/public/MapEmbed";
import { ReviewsCarousel } from "@/components/public/ReviewsCarousel";
import type { Business, Service } from "@/db/types";

// Types partiels acceptés par le composant (colonnes réellement affichées).
// On utilise Business (source de vérité DB) pour éviter les `as any` sur les
// champs récemment ajoutés (template, language, showQrOnPage, hideBranding, etc.).
interface PublicPageProps {
  business: Business;
  hours: {
    id: string;
    businessId: string;
    dayOfWeek: number;
    startTime: string | null;
    endTime: string | null;
    isClosed: boolean;
  }[];
  reviews: {
    id: string;
    clientName: string;
    clientEmail: string | null;
    rating: number;
    comment: string | null;
    source: string | null;
    googleReviewId: string | null;
    isPublished: boolean;
    createdAt: Date;
  }[];
  faqs: {
    id: string;
    question: string;
    answer: string;
  }[];
  gallery: {
    id: string;
    type: string;
    url: string;
    thumbnailUrl: string | null;
    title: string | null;
    description: string | null;
  }[];
  socials: {
    id: string;
    platform: string;
    url: string;
  }[];
  slots: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
  }[];
  ownerPlan?: string;
  initialServices?: Service[];
}

const categoryEmojis: Record<string, string> = {
  plombier: "🔧",
  electricien: "⚡",
  couvreur: "🏠",
  peintre: "🎨",
  menuisier: "🪚",
  coiffeur: "💇",
  esthetician: "💅",
  garagiste: "🚗",
  jardinier: "🌿",
  serrurier: "🔑",
  macon: "🧱",
  chauffagiste: "🔥",
  photographe: "📸",
  coach: "💼",
  autre: "⭐",
};

export function PublicPage({
  business,
  hours,
  reviews,
  faqs,
  gallery,
  socials,
  slots,
  ownerPlan = "free",
  initialServices = [],
}: PublicPageProps) {
  // Lot 22 : Toast global à la place des alert() natifs
  const toast = useToast();
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [showBooking, setShowBooking] = useState(false);
  const [showQuote, setShowQuote] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  // Lot 23 : lightbox galerie (index de l'item ouvert, null = fermé)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [reviewText, setReviewText] = useState("");
  const [reviewName, setReviewName] = useState("");
  const [reviewEmail, setReviewEmail] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [qrCode, setQrCode] = useState<string>("");
  const [quoteFields, setQuoteFields] = useState<any[]>([]);
  const [servicesList, setServicesList] = useState<any[]>(initialServices);
  const [showPayment, setShowPayment] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payDesc, setPayDesc] = useState("");
  const [payLoading, setPayLoading] = useState(false);
  const lang = business.language || "fr";
  const canQuote = ownerPlan !== "free"; // Devis réservé aux plans payants
  const tpl = getTemplate(business.template ?? undefined);
  // Lot 61 fix templates : avant, la vraie vitrine appliquait tpl.style.pageBg,
  // headerHeight, coverGradient, avatarRadius uniquement sur le conteneur+cover.
  // Toutes les CARTES internes (menu, services, gallerie, blog, contact)
  // avaient des styles hardcodés `bg-white dark:bg-slate-900` → le template
  // "Premium Dark" ou "Prestige Or" affichait des cartes blanches en clair
  // → décalage massif entre la preview dashboard et le rendu final.
  // Fix : classes réutilisables `cardClasses` qui combinent cardBg + cardBorder
  // du template. On garde `dark:` pour les users en mode sombre navigateur.
  const cardClasses = `mt-8 rounded-2xl border p-5 sm:p-6 shadow-sm ${tpl.style.cardBg} ${tpl.style.cardBorder} dark:border-slate-800 dark:bg-slate-900`;
  const showQr = business.showQrOnPage !== false;
  const showReviews = business.showReviewsOnPage !== false;
  const highlightsEnabled = business.highlightsEnabled !== false;
  const highlights = (business.highlightsData as Array<{
    icon?: string;
    title?: string;
    subtitle?: string;
  }> | null) || [
    { icon: "⚡", title: "Intervention rapide", subtitle: "Sous 2h" },
    { icon: "🛡️", title: "Garantie décennale", subtitle: "Travaux couverts" },
    { icon: "💬", title: "Conseil personnalisé", subtitle: "Devis gratuit" },
  ];

  const handlePayment = async () => {
    if (!payAmount || parseFloat(payAmount) <= 0) return;
    setPayLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessSlug: business.slug,
          amount: parseFloat(payAmount),
          description: payDesc || `Paiement ${business.name}`,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        // Lot 22 : Toast au lieu d'alert() bloquant
        toast.error(data.error || "Erreur lors du paiement");
      }
    } catch {
      toast.error("Erreur de connexion. Réessayez.");
    } finally {
      setPayLoading(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!reviewName || !reviewEmail || !reviewText || !reviewRating) return;
    setReviewSubmitting(true);
    try {
      const res = await fetch("/api/reviews/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessSlug: business.slug,
          clientName: reviewName,
          clientEmail: reviewEmail,
          rating: reviewRating,
          comment: reviewText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'envoi de l'avis");
      // Lot 22 : Toast succès + petit délai avant reload pour que l'user le voie
      toast.success("Merci ! Votre avis a été publié.");
      setShowReviewForm(false);
      setReviewName("");
      setReviewEmail("");
      setReviewText("");
      setReviewRating(5);
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'envoi de l'avis");
    } finally {
      setReviewSubmitting(false);
    }
  };

  // Gestion de l'image de couverture
  const coverStyle = business.coverImage
    ? {
        backgroundImage: `url(${business.coverImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : { background: tpl.style.coverGradient };

  useEffect(() => {
    // Lot 36 : track la visite (fire-and-forget, respect Do Not Track)
    if (
      typeof window !== "undefined" &&
      navigator.doNotTrack !== "1" &&
      // @ts-expect-error legacy IE/Safari fallback
      window.doNotTrack !== "1"
    ) {
      const src = new URL(window.location.href).searchParams.get("src");
      fetch("/api/track/visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: business.id,
          path: window.location.pathname,
          src: src ?? undefined,
        }),
        keepalive: true, // survit à la navigation vers un autre lien
      }).catch(() => {
        /* silent, non essentiel */
      });
    }

    // Générer le QR code de partage de la vitrine
    if (typeof window !== "undefined") {
      fetch("/api/qr-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: window.location.href }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.qrCode) setQrCode(d.qrCode);
        })
        .catch(() => {});

      // Tracker la visite (statistiques réelles du pro)
      const width = window.innerWidth;
      const device = width < 640 ? "mobile" : width < 1024 ? "tablet" : "desktop";
      const utm = new URLSearchParams(window.location.search).get("utm_source");
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: business.slug,
          referrer: document.referrer || null,
          device,
          path: window.location.pathname,
          utm,
        }),
      }).catch(() => {});

      // Charger les champs de devis personnalisés
      fetch("/api/quote-form-fields?business=" + business.slug)
        .then((r) => r.json())
        .then((d) => {
          if (d.fields) setQuoteFields(d.fields);
        })
        .catch(() => {});

      // Charger les services
      fetch("/api/services?business=" + business.slug)
        .then((r) => r.json())
        .then((d) => {
          if (d.services) setServicesList(d.services);
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [bookingStep, setBookingStep] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    notes: "",
  });

  // Group slots by date
  const groupedSlots: Record<string, typeof slots> = {};
  slots.forEach((slot) => {
    if (!groupedSlots[slot.date]) groupedSlots[slot.date] = [];
    groupedSlots[slot.date].push(slot);
  });

  const avgRating =
    reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

  const category = business.category || "autre";
  const emoji = categoryEmojis[category] || "⭐";

  // Lot 37 : personnalisation étendue — la font choisie par le pro override
  // le template si présente. Les couleurs secondary/accent sont exposées
  // comme CSS custom vars pour usage futur (composants sections). Le custom
  // CSS Premium est injecté dans un <style> scoped au container `.vx-vitrine`.
  const customFontStack =
    business.fontFamily && business.fontFamily !== "inter"
      ? getVitrineFontStack(business.fontFamily)
      : null;
  const inlineVars: React.CSSProperties = {
    fontFamily: customFontStack ?? tpl.style.fontFamily,
    // CSS variables pour les composants children
    ...(business.primaryColor
      ? ({ "--vx-primary": business.primaryColor } as React.CSSProperties)
      : {}),
    ...(business.secondaryColor
      ? ({ "--vx-secondary": business.secondaryColor } as React.CSSProperties)
      : {}),
    ...(business.accentColor
      ? ({ "--vx-accent": business.accentColor } as React.CSSProperties)
      : {}),
  };

  return (
    <div className={`min-h-screen vx-vitrine ${tpl.style.pageBg}`} style={inlineVars}>
      {/* Lot 37 : CSS custom scoped au container vitrine (Premium uniquement,
          déjà sanitizé côté serveur : pas de @import / url() ext / expression()) */}
      {business.customCss && business.customCss.trim().length > 0 && (
        <style
          // Le CSS custom est OWNER-CONTROLLED (le pro le pose sur SA propre
          // vitrine), mais on scope quand même au `.vx-vitrine` pour éviter
          // qu'il ne bleed sur d'autres pages Vitrix embarquant PublicPage.
          dangerouslySetInnerHTML={{
            __html: `.vx-vitrine { ${business.customCss} }`,
          }}
        />
      )}

      {/* JSON-LD Structured Data for SEO */}
      <BusinessStructuredData
        business={{
          ...business,
          slug: business.slug,
        }}
        reviews={reviews}
        avgRating={avgRating}
        url={`${process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr"}/${business.slug}`}
        hours={hours}
        socials={socials}
      />

      {/* Cover Image */}
      <div className={`relative ${tpl.style.headerHeight}`}>
        {business.coverImage ? (
          <OptimizedImage
            src={business.coverImage}
            alt={`Couverture ${business.name}`}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 100vw"
            className="object-cover"
            fallback={
              <div className="absolute inset-0" style={{ background: tpl.style.coverGradient }} />
            }
          />
        ) : (
          <div className="absolute inset-0" style={{ background: tpl.style.coverGradient }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

        {/* Emergency button */}
        {business.showEmergency && business.emergencyPhone && (
          <a
            href={`tel:${business.emergencyPhone}`}
            className="absolute right-4 top-4 flex items-center gap-2 rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-red-600"
          >
            <AlertTriangle className="h-4 w-4" />
            Urgence
          </a>
        )}
      </div>

      {/* Content — cible du skip link, landmark principal */}
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto -mt-20 relative max-w-2xl px-4 pb-12 focus:outline-none"
      >
        {/* Profile */}
        <div className="mb-6 flex justify-center">
          <div
            className={`flex h-32 w-32 items-center justify-center ${tpl.style.avatarRadius} border-4 border-white bg-slate-900 text-5xl shadow-2xl dark:border-slate-950`}
          >
            {business.profileImage ? (
              <OptimizedImage
                src={business.profileImage}
                alt={`Photo de profil de ${business.name}`}
                width={128}
                height={128}
                sizes="128px"
                className="h-full w-full rounded-2xl object-cover"
              />
            ) : (
              <span>{emoji}</span>
            )}
          </div>
        </div>

        {/* Business Info */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {business.name}
          </h1>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-sm">
            <Badge className="capitalize">{category}</Badge>
            {avgRating > 0 && (
              <div className="flex items-center gap-1.5">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {avgRating.toFixed(1)}
                </span>
                <span className="text-slate-500 dark:text-slate-400">({reviews.length} avis)</span>
              </div>
            )}
          </div>
          {business.description && (
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {business.description}
            </p>
          )}
        </div>

        {/* Contact Buttons */}
        <div className="mt-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {business.phone && (
              <a
                href={`tel:${business.phone}`}
                className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
              >
                <Phone className="h-4 w-4" />
                {t(lang, "call")}
              </a>
            )}
            {business.whatsapp && (
              <a
                href={`https://wa.me/${business.whatsapp.replace("+", "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-600"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>
            )}
          </div>
          {business.email && (
            <a
              href={`mailto:${business.email}`}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 py-3.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
            >
              <Mail className="h-4 w-4" />
              {t(lang, "sendEmail")}
            </a>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-4 space-y-3">
          <Button
            className="w-full h-12 text-base"
            onClick={() => setShowBooking(true)}
            leftIcon={<Calendar className="h-5 w-5" />}
          >
            {t(lang, "book")}
          </Button>

          <div className={`grid gap-3 ${canQuote ? "grid-cols-2" : "grid-cols-1"}`}>
            {canQuote && (
              <Button
                variant="outline"
                className="h-12"
                leftIcon={<FileText className="h-4 w-4" />}
                onClick={() => setShowQuote(true)}
              >
                {t(lang, "quote")}
              </Button>
            )}
            <Button
              variant="outline"
              className="h-12"
              leftIcon={<Share2 className="h-4 w-4" />}
              onClick={() => {
                // Lot 23 : partage enrichi (title + text + url) → meilleure preview sur WhatsApp/iMessage.
                // Fallback : copie l'URL + toast succès si Web Share API absente (desktop Chrome).
                const shareData = {
                  title: business.name,
                  text: business.description || `Découvrez ${business.name}`,
                  url: window.location.href,
                };
                if (navigator.share) {
                  navigator.share(shareData).catch(() => {
                    /* user annule = OK, on tait */
                  });
                } else {
                  navigator.clipboard
                    .writeText(window.location.href)
                    .then(() => toast.success("Lien copié dans le presse-papier"))
                    .catch(() => toast.error("Impossible de copier le lien"));
                }
              }}
            >
              {t(lang, "share")}
            </Button>
          </div>
        </div>

        {/* Working Hours (extrait -> sections/WorkingHoursCard.tsx) */}
        <WorkingHoursCard hours={hours} lang={lang as never} />

        {/* Section Menu (Spécial Restaurant) */}
        {business.category === "restaurant" &&
          Array.isArray(business.menuData) &&
          business.menuData.length > 0 && (
            <div className={cardClasses}>
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100 mb-6">
                <span className="text-2xl">🍽️</span> Notre Carte
              </h2>
              <div className="grid gap-8 md:grid-cols-2">
                {(
                  business.menuData as Array<{
                    category: string;
                    items: Array<{
                      name: string;
                      price: string;
                      description?: string;
                      image?: string;
                    }>;
                  }>
                ).map((cat, i) => (
                  <div key={i} className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 border-b-2 border-amber-400 pb-2 inline-block">
                      {cat.category}
                    </h3>
                    <div className="space-y-4">
                      {cat.items.map((item, j) => (
                        <div key={j} className="flex gap-4 group">
                          {item.image && (
                            <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                              <OptimizedImage
                                src={item.image}
                                alt={item.name}
                                fill
                                sizes="64px"
                                loading="lazy"
                                className="object-cover transition-transform group-hover:scale-110"
                              />
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="flex justify-between items-baseline border-b border-dashed border-slate-200 dark:border-slate-700 pb-1">
                              <p className="font-semibold text-slate-900 dark:text-slate-100">
                                {item.name}
                              </p>
                              <span className="font-bold text-amber-600 dark:text-amber-500 ml-2">
                                {item.price}
                              </span>
                            </div>
                            {item.description && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        {/* Services & Tarifs — Design épuré et pro avec avantages */}
        {servicesList.length > 0 && (
          <div className={cardClasses}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
                <Briefcase className="h-5 w-5 text-blue-600" />
                Nos Prestations & Tarifs
              </h2>
              <span className="text-xs font-medium bg-blue-50 text-blue-700 px-2 py-1 rounded-full dark:bg-blue-900/30 dark:text-blue-300">
                Devis gratuit sous 24h
              </span>
            </div>

            <div className="space-y-3">
              {servicesList.map((s, i) => (
                <div
                  key={i}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all dark:bg-slate-800/50 dark:border-slate-800 dark:hover:border-blue-900/50"
                >
                  <div className="flex-1 min-w-0 mb-2 sm:mb-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-900 dark:text-slate-100 text-[15px]">
                        {s.name}
                      </p>
                      {i === 0 && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium dark:bg-amber-900/30 dark:text-amber-400">
                          Populaire
                        </span>
                      )}
                    </div>
                    {s.description && (
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                        {s.description}
                      </p>
                    )}
                  </div>
                  {s.price && (
                    <div className="text-right">
                      <span className="block font-bold text-blue-600 dark:text-blue-400 text-lg">
                        {s.price}
                      </span>
                      <span className="text-[10px] text-slate-400">TTC</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {highlightsEnabled && (
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-center text-xs text-slate-500 dark:text-slate-400">
                {highlights.map((h, i) => (
                  <div
                    key={i}
                    className="flex flex-col items-center gap-1 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50"
                  >
                    <span className="text-lg">{h.icon}</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {h.title}
                    </span>
                    {h.subtitle && <span className="text-[10px] text-slate-400">{h.subtitle}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Paiement en ligne (Stripe) */}
        {business.enableStripe && (
          <div className="mt-8 rounded-2xl border border-blue-200 bg-blue-50/50 p-6 dark:border-blue-900/50 dark:bg-blue-900/10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  <CreditCard className="h-5 w-5 text-blue-600" />
                  Paiement en ligne sécurisé
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Réglez vos factures ou acomptes directement par carte bancaire.
                </p>
              </div>
              <Button onClick={() => setShowPayment(true)} className="shrink-0 ml-4">
                Payer
              </Button>
            </div>
          </div>
        )}

        {/* Location */}
        {(business.address || business.serviceArea) && (
          <div className={cardClasses}>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
              <MapPin className="h-5 w-5" />
              {t(lang, "address")}
            </h2>
            {business.address && (
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                {business.address}
                {business.postalCode && `, ${business.postalCode}`}
                {business.city && ` ${business.city}`}
              </p>
            )}
            {business.serviceArea && (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                📍 Zone : {business.serviceArea}
              </p>
            )}
            {business.latitude && business.longitude && (
              <div className="mt-4">
                {/* Lot 23 : OpenStreetMap au lieu de Google Maps buggée
                    (l'ancien pb=! contenait des coords hardcodées Islande !)
                    + bouton "Itinéraire" universel mobile natif. */}
                <MapEmbed
                  latitude={Number(business.latitude)}
                  longitude={Number(business.longitude)}
                  address={business.address}
                  city={business.city}
                />
              </div>
            )}
          </div>
        )}

        {/* Gallery (Lot 23 : clic → lightbox swipeable, badge vidéo si applicable) */}
        {gallery.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
              Galerie ({gallery.length})
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {gallery.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  aria-label={
                    item.type === "video"
                      ? `Ouvrir la vidéo ${item.title || i + 1}`
                      : `Agrandir la photo ${item.title || i + 1}`
                  }
                  className="group relative aspect-square overflow-hidden rounded-xl bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-slate-800"
                >
                  <OptimizedImage
                    src={item.thumbnailUrl || item.url}
                    alt={item.title || `Photo galerie ${business.name}`}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 250px"
                    loading="lazy"
                    className="object-cover transition-transform duration-300 group-hover:scale-110"
                  />
                  {item.type === "video" && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 flex items-center justify-center bg-black/30 text-white transition group-hover:bg-black/40"
                    >
                      <span className="rounded-full bg-white/90 p-3 text-slate-900">▶</span>
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Lightbox (rendu conditionnel via state, se ferme sur click extérieur/Escape) */}
        <Lightbox
          items={gallery as LightboxItem[]}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />

        {/* Reviews */}
        {showReviews && (
          <div className={cardClasses}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                <Star className="h-5 w-5 text-amber-400" />
                Avis clients
              </h2>
              <Button size="sm" variant="outline" onClick={() => setShowReviewForm(true)}>
                <Star className="mr-1.5 h-3.5 w-3.5" /> Laisser un avis
              </Button>
            </div>
            {reviews.length > 0 ? (
              <div className="space-y-1 flex items-center gap-2 mb-5">
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-5 w-5 ${i < Math.round(avgRating) ? "fill-amber-400 text-amber-400" : "text-slate-200 dark:text-slate-700"}`}
                    />
                  ))}
                </div>
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {avgRating.toFixed(1)}/5
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  ({reviews.length} avis)
                </span>
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                Soyez le premier à laisser un avis !
              </p>
            )}
            {reviews.length > 0 && (
              <div className="mt-5">
                {/* Lot 23 : carousel scroll-snap avec swipe mobile (auparavant liste verticale) */}
                <ReviewsCarousel
                  reviews={reviews.map((r) => ({
                    id: r.id,
                    clientName: r.clientName,
                    rating: r.rating,
                    comment: r.comment,
                    createdAt: r.createdAt,
                    source: r.source === "google" ? "Google" : r.source,
                  }))}
                />
              </div>
            )}
          </div>
        )}

        {/* FAQ */}
        {faqs.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
              {t(lang, "faq")}
            </h2>
            <div className="space-y-2">
              {faqs.map((faq, index) => (
                <div
                  key={faq.id}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                >
                  <button
                    type="button"
                    aria-expanded={activeFaq === index}
                    aria-controls={`faq-answer-${index}`}
                    id={`faq-question-${index}`}
                    className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                    onClick={() => setActiveFaq(activeFaq === index ? null : index)}
                  >
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {faq.question}
                    </span>
                    {activeFaq === index ? (
                      <ChevronUp
                        className="h-4 w-4 flex-shrink-0 text-slate-500"
                        aria-hidden="true"
                      />
                    ) : (
                      <ChevronDown
                        className="h-4 w-4 flex-shrink-0 text-slate-500"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                  {activeFaq === index && (
                    <div
                      id={`faq-answer-${index}`}
                      role="region"
                      aria-labelledby={`faq-question-${index}`}
                      className="border-t border-slate-100 px-4 py-3 text-sm leading-relaxed text-slate-600 dark:border-slate-800 dark:text-slate-400"
                    >
                      {faq.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Social Links */}
        {socials.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
              {t(lang, "socials")}
            </h2>
            <div className="flex flex-wrap gap-3">
              {socials.map((social) => (
                <a
                  key={social.id}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-900 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:border-white dark:hover:bg-slate-900"
                >
                  <Globe className="h-4 w-4" />
                  <span className="capitalize">{social.platform}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Blog link */}
        <div className="mt-8 flex justify-center">
          <a
            href={`/${business.slug}/blog`}
            className="flex items-center gap-2 rounded-xl border border-slate-200 px-6 py-3 text-sm font-medium text-slate-700 transition-colors hover:border-slate-900 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:border-white"
          >
            📝 {t(lang, "blog")}
          </a>
        </div>

        {/* QR Code (extrait -> sections/QrCodeCard.tsx) */}
        {showQr && qrCode && (
          <QrCodeCard
            qrCode={qrCode}
            slug={business.slug}
            lang={lang as never}
            cardBorder={tpl.style.cardBorder}
            cardBg={tpl.style.cardBg}
          />
        )}

        {/* Footer (extrait -> sections/PublicFooter.tsx) */}
        <PublicFooter
          hideBranding={(business as { hideBranding?: boolean | null }).hideBranding}
          siret={business.siret}
          lang={lang as never}
        />
      </main>

      {/* Booking Modal */}
      {showBooking && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              setShowBooking(false);
              setBookingStep(0);
              setSelectedSlot(null);
              setBookingSuccess(false);
            }}
          />
          <div className="relative z-10 w-full max-w-lg rounded-t-2xl bg-white p-6 dark:bg-slate-900 sm:rounded-2xl max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Prendre rendez-vous
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {bookingStep === 0
                    ? "Choisissez un créneau"
                    : bookingStep === 1
                      ? "Vos informations"
                      : "Confirmation"}
                </p>
              </div>
              <button
                type="button"
                aria-label="Fermer"
                onClick={() => {
                  setShowBooking(false);
                  setBookingStep(0);
                  setSelectedSlot(null);
                  setBookingSuccess(false);
                }}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>

            {bookingSuccess ? (
              <div className="py-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                  <Star className="h-8 w-8 text-emerald-600" />
                </div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Rendez-vous confirmé !
                </h4>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  {bookingForm.firstName}, vous êtes attendu(e) le{" "}
                  <strong>{selectedSlot?.split("_")[0]}</strong> à{" "}
                  <strong>{selectedSlot?.split("_")[1]}</strong>.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Un rappel vous sera envoyé avant le rendez-vous.
                </p>
                <Button
                  className="mt-6"
                  onClick={() => {
                    setShowBooking(false);
                    setBookingStep(0);
                    setSelectedSlot(null);
                    setBookingSuccess(false);
                  }}
                >
                  Fermer
                </Button>
              </div>
            ) : bookingStep === 0 ? (
              <>
                {slots.length > 0 ? (
                  <div className="max-h-72 space-y-4 overflow-y-auto">
                    {Object.entries(groupedSlots)
                      .slice(0, 7)
                      .map(([date, daySlots]) => (
                        <div key={date}>
                          <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                            {date}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {daySlots.map((slot) => {
                              const slotKey = `${date}_${slot.startTime}`;
                              const isSelected = selectedSlot === slotKey;
                              return (
                                <button
                                  key={slot.id}
                                  onClick={() => setSelectedSlot(slotKey)}
                                  className={`rounded-xl border px-4 py-2 text-sm font-medium transition-all ${
                                    isSelected
                                      ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
                                      : "border-slate-200 text-slate-700 hover:border-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-white"
                                  }`}
                                >
                                  {slot.startTime}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="rounded-xl bg-slate-50 p-6 text-center dark:bg-slate-800">
                    <Calendar className="mx-auto mb-2 h-8 w-8 text-slate-400" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Aucun créneau disponible.
                    </p>
                    {business.phone && (
                      <a
                        href={`tel:${business.phone}`}
                        className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline"
                      >
                        <Phone className="h-4 w-4" /> Appelez-nous
                      </a>
                    )}
                  </div>
                )}
                <Button
                  className="mt-6 w-full"
                  disabled={!selectedSlot}
                  onClick={() => selectedSlot && setBookingStep(1)}
                >
                  Continuer
                </Button>
              </>
            ) : bookingStep === 1 ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    Créneau sélectionné
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {selectedSlot?.split("_")[0]} à {selectedSlot?.split("_")[1]}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Prénom"
                    value={bookingForm.firstName}
                    onChange={(e) => setBookingForm({ ...bookingForm, firstName: e.target.value })}
                    placeholder="Jean"
                  />
                  <Input
                    label="Nom"
                    value={bookingForm.lastName}
                    onChange={(e) => setBookingForm({ ...bookingForm, lastName: e.target.value })}
                    placeholder="Dupont"
                  />
                </div>
                <Input
                  label="Téléphone"
                  value={bookingForm.phone}
                  onChange={(e) => setBookingForm({ ...bookingForm, phone: e.target.value })}
                  placeholder="+336 12 34 56 78"
                />
                <Input
                  label="Email (pour recevoir votre confirmation)"
                  type="email"
                  value={bookingForm.email}
                  onChange={(e) => setBookingForm({ ...bookingForm, email: e.target.value })}
                  placeholder="jean@email.fr"
                  required
                />
                <Input
                  label="Motif (optionnel)"
                  value={bookingForm.notes}
                  onChange={(e) => setBookingForm({ ...bookingForm, notes: e.target.value })}
                  placeholder="Ex: Réparation fuite"
                />
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setBookingStep(0)}>
                    Retour
                  </Button>
                  <Button
                    className="flex-1"
                    loading={bookingLoading}
                    onClick={async () => {
                      if (!bookingForm.firstName || !bookingForm.phone || !bookingForm.email)
                        return;
                      setBookingLoading(true);
                      try {
                        const [date, startTime] = selectedSlot!.split("_");
                        const res = await fetch("/api/book-appointment", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            businessId: business.id,
                            date,
                            startTime,
                            endTime: selectedSlot!
                              .split("_")[1]
                              .replace(
                                /(\d+):(\d+)/,
                                (_, h) => `${String(Number(h) + 1).padStart(2, "0")}:00`
                              ),
                            ...bookingForm,
                          }),
                        });
                        if (res.ok) {
                          setBookingSuccess(true);
                          setBookingStep(2);
                        } else {
                          // UX2 fix : on affichait rien en cas de 4xx/5xx → confusion user.
                          toast.error(
                            "Impossible de réserver ce créneau. Il est peut-être déjà pris.",
                            "Réservation échouée"
                          );
                        }
                      } catch (e) {
                        // UX2 fix : console.error silencieux → l'user restait bloqué en loading.
                        console.error(e);
                        toast.error(
                          "Vérifiez votre connexion et réessayez.",
                          "Erreur réseau"
                        );
                      } finally {
                        setBookingLoading(false);
                      }
                    }}
                  >
                    Confirmer le RDV
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Chatbot IA public (Premium + activé) */}
      {ownerPlan === "premium" && business.publicChatEnabled && (
        <PublicChat businessId={business.id} businessName={business.name} />
      )}

      {/* Review Form Modal */}
      {showReviewForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowReviewForm(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 dark:bg-slate-900 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Laisser un avis
              </h3>
              <button
                type="button"
                aria-label="Fermer la fenêtre"
                onClick={() => setShowReviewForm(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Votre note
                </label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} onClick={() => setReviewRating(star)} className="text-2xl">
                      <Star
                        className={`h-8 w-8 ${star <= reviewRating ? "fill-amber-400 text-amber-400" : "text-slate-300 dark:text-slate-600"}`}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <Input
                label="Votre nom"
                value={reviewName}
                onChange={(e) => setReviewName(e.target.value)}
                placeholder="Jean D."
              />
              <Textarea
                label="Votre avis"
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Partagez votre expérience..."
                rows={4}
              />
              <Input
                label="Votre email"
                type="email"
                value={reviewEmail}
                onChange={(e) => setReviewEmail(e.target.value)}
                placeholder="vous@email.fr"
              />
              <Button
                className="w-full"
                size="lg"
                loading={reviewSubmitting}
                onClick={handleSubmitReview}
              >
                <Star className="mr-2 h-4 w-4" /> Publier l&apos;avis
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Quote Form Modal */}
      {showQuote && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowQuote(false)}
          />
          <div className="relative z-10 w-full max-w-lg rounded-t-2xl bg-white p-6 dark:bg-slate-900 sm:rounded-2xl max-h-[90vh] overflow-y-auto">
            <QuoteForm
              businessId={business.id}
              businessName={business.name}
              category={business.category}
              customFields={quoteFields}
              enableStripe={business.enableStripe ?? undefined}
              onClose={() => setShowQuote(false)}
            />
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowPayment(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 dark:bg-slate-900 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Paiement sécurisé
              </h3>
              <button
                type="button"
                aria-label="Fermer la fenêtre de paiement"
                onClick={() => setShowPayment(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              Vous effectuez un paiement vers <strong>{business.name}</strong>. Vous serez redirigé
              vers Stripe pour finaliser la transaction.
            </p>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Montant (€)
                </label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Motif (optionnel)
                </label>
                <Input
                  placeholder="Ex: Acompte, Facture #123..."
                  value={payDesc}
                  onChange={(e) => setPayDesc(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                size="lg"
                onClick={handlePayment}
                loading={payLoading}
                disabled={!payAmount || parseFloat(payAmount) <= 0}
              >
                <CreditCard className="mr-2 h-4 w-4" /> Payer{" "}
                {payAmount ? `${parseFloat(payAmount).toFixed(2)} €` : ""}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
