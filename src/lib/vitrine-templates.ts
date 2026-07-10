// Templates de design pour les vitrines publiques
// Gratuit : 1 template · Pro : 4 templates · Premium : 7 templates

export interface VitrineTemplate {
  id: string;
  name: string;
  description: string;
  emoji: string;
  plan: "free" | "pro" | "premium";
  style: {
    coverGradient: string;
    pageBg: string;
    cardBg: string;
    cardBorder: string;
    buttonRadius: string;
    avatarRadius: string;
    fontFamily: string; // Police d'écriture (stack CSS)
    headerHeight: string;
    layout: "center" | "left"; // Alignement du contenu
    accent?: string;
  };
}

export const vitrineTemplates: VitrineTemplate[] = [
  {
    id: "classique",
    name: "Classique",
    description: "Simple et efficace. L'essentiel pour démarrer.",
    emoji: "⚪",
    plan: "free",
    style: {
      coverGradient: "linear-gradient(135deg, #cbd5e1, #94a3b8)",
      pageBg: "bg-slate-50",
      cardBg: "bg-white",
      cardBorder: "border-slate-200",
      buttonRadius: "rounded-md",
      avatarRadius: "rounded-lg",
      fontFamily: "sans-serif",
      headerHeight: "h-48",
      layout: "center",
    },
  },
  {
    id: "pro-blue",
    name: "Pro Business",
    description: "Bleu confiance, layout structuré. Idéal pour les services.",
    emoji: "🔵",
    plan: "pro",
    style: {
      coverGradient: "linear-gradient(135deg, #1e40af, #3b82f6)",
      pageBg: "bg-slate-50",
      cardBg: "bg-white shadow-sm",
      cardBorder: "border-blue-100",
      buttonRadius: "rounded-lg",
      avatarRadius: "rounded-full border-4 border-white shadow-md",
      fontFamily: "sans-serif",
      headerHeight: "h-64",
      layout: "left",
    },
  },
  {
    id: "pro-green",
    name: "Pro Nature",
    description: "Vert rassurant, parfait pour l'artisanat et le jardin.",
    emoji: "🌿",
    plan: "pro",
    style: {
      coverGradient: "linear-gradient(135deg, #064e3b, #10b981)",
      pageBg: "bg-stone-50",
      cardBg: "bg-white",
      cardBorder: "border-emerald-100",
      buttonRadius: "rounded-xl",
      avatarRadius: "rounded-2xl",
      fontFamily: "sans-serif",
      headerHeight: "h-64",
      layout: "center",
    },
  },
  {
    id: "premium-dark",
    name: "Premium Dark",
    description: "Élégance sombre, effet verre dépoli. Très moderne.",
    emoji: "🌑",
    plan: "premium",
    style: {
      coverGradient: "linear-gradient(135deg, #0f172a, #1e293b)",
      pageBg: "bg-slate-950 text-slate-100",
      cardBg: "bg-slate-900/50 backdrop-blur-md border border-slate-800",
      cardBorder: "border-slate-800",
      buttonRadius: "rounded-full bg-indigo-600 hover:bg-indigo-500",
      avatarRadius: "rounded-full ring-4 ring-indigo-500/30",
      fontFamily: "sans-serif",
      headerHeight: "h-80",
      layout: "center",
      accent: "glow",
    },
  },
  {
    id: "premium-gold",
    name: "Prestige Or",
    description: "Noir et Or, pour les services de luxe et haut de gamme.",
    emoji: "👑",
    plan: "premium",
    style: {
      coverGradient: "linear-gradient(135deg, #000000, #4338ca)",
      pageBg: "bg-black text-amber-50",
      cardBg: "bg-zinc-900 border border-amber-900/30",
      cardBorder: "border-amber-900/30",
      buttonRadius: "rounded-none border border-amber-600 text-amber-500",
      avatarRadius: "rounded-sm border-2 border-amber-600",
      fontFamily: "serif",
      headerHeight: "h-96",
      layout: "center",
      accent: "gold",
    },
  },
];

export function getTemplate(id: string | null | undefined): VitrineTemplate {
  return vitrineTemplates.find((t) => t.id === id) || vitrineTemplates[0];
}

// Templates accessibles selon le plan
export function templatesForPlan(plan: string): VitrineTemplate[] {
  if (plan === "premium") return vitrineTemplates;
  if (plan === "pro") return vitrineTemplates.filter((t) => t.plan !== "premium");
  return vitrineTemplates.filter((t) => t.plan === "free");
}

export function canUseTemplate(plan: string, templateId: string): boolean {
  return templatesForPlan(plan).some((t) => t.id === templateId);
}
