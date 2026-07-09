import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount: number, currency = "€") {
  return `${amount.toFixed(2)} ${currency}`;
}

export function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDateTime(date: Date | string) {
  return new Date(date).toLocaleString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function generateQuoteNumber() {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `DEV-${year}-${random}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const CATEGORIES = [
  { id: "plombier", name: "Plombier", icon: "🔧" },
  { id: "electricien", name: "Électricien", icon: "⚡" },
  { id: "couvreur", name: "Couvreur", icon: "🏠" },
  { id: "peintre", name: "Peintre", icon: "🎨" },
  { id: "menuisier", name: "Menuisier", icon: "🪚" },
  { id: "coiffeur", name: "Coiffeur", icon: "💇" },
  { id: "esthetician", name: "Esthéticienne", icon: "💅" },
  { id: "garagiste", name: "Garagiste", icon: "🚗" },
  { id: "jardinier", name: "Jardinier", icon: "🌿" },
  { id: "serrurier", name: "Serrurier", icon: "🔑" },
  { id: "macon", name: "Maçon", icon: "🧱" },
  { id: "chauffagiste", name: "Chauffagiste", icon: "🔥" },
  { id: "photographe", name: "Photographe", icon: "📸" },
  { id: "coach", name: "Coach / Consultant", icon: "💼" },
  { id: "autre", name: "Autre", icon: "⭐" },
];

export const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
export const DAYS_SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

export const SUBSCRIPTION_FEATURES = {
  free: {
    name: "Gratuit",
    price: 0,
    features: [
      "Page publique personnalisée",
      "Boutons de contact",
      "Galerie photos",
      "Avis clients",
      "FAQ",
      "Réseaux sociaux",
    ],
    limitations: ["Pas de rendez-vous en ligne", "Pas de paiement", "Pas de CRM"],
  },
  pro: {
    name: "Pro",
    price: 29,
    features: [
      "Tout du plan Gratuit",
      "Prise de rendez-vous en ligne",
      "Système de devis",
      "Paiement en ligne (Stripe)",
      "CRM intégré",
      "Statistiques de base",
      "Rappels email",
    ],
    limitations: ["Pas d'IA", "Pas de SMS/WhatsApp"],
  },
  premium: {
    name: "Premium",
    price: 79,
    features: [
      "Tout du plan Pro",
      "Assistant IA 24/7",
      "Rappels SMS & WhatsApp",
      "Statistiques avancées",
      "Automatisations",
      "Synchronisation Google Calendar",
      "Synchronisation Outlook",
      "Support prioritaire",
      "Marque blanche",
    ],
    limitations: [],
  },
};
