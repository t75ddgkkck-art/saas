// Page Templates for artisan public pages

export interface PageTemplate {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  features: string[];
  style: {
    header: "hero" | "minimal" | "gradient" | "split";
    contactLayout: "grid" | "stacked" | "floating";
    sectionOrder: string[];
    cardStyle: "rounded" | "sharp" | "pill";
    fontFamily: "inter" | "serif" | "mono" | "display";
    colors: {
      primary: string;
      secondary: string;
      background: string;
      accent: string;
    };
  };
}

export const pageTemplates: Record<string, PageTemplate> = {
  minimaliste: {
    id: "minimaliste",
    name: "Minimaliste",
    description: "Épuré et élégant. Idéal pour les artisans qui veulent aller à l'essentiel.",
    thumbnail: "🎨",
    features: ["Design épuré", "Navigation intuitive", "Focus sur le contenu", "Performance optimale"],
    style: {
      header: "minimal",
      contactLayout: "grid",
      sectionOrder: ["contact", "services", "gallery", "reviews", "faq"],
      cardStyle: "rounded",
      fontFamily: "inter",
      colors: { primary: "#0f172a", secondary: "#f8fafc", background: "#ffffff", accent: "#3b82f6" },
    },
  },
  corporate: {
    id: "corporate",
    name: "Corporate",
    description: "Professionnel et rassurant. Parfait pour les entreprises établies.",
    thumbnail: "🏢",
    features: ["Image institutionnelle", "Confiance et sérieux", "Informations détaillées", "Multi-sections"],
    style: {
      header: "split",
      contactLayout: "stacked",
      sectionOrder: ["hero", "about", "services", "reviews", "contact", "faq"],
      cardStyle: "sharp",
      fontFamily: "serif",
      colors: { primary: "#1e3a5f", secondary: "#e8edf2", background: "#f5f7fa", accent: "#2563eb" },
    },
  },
  colore: {
    id: "colore",
    name: "Coloré",
    description: "Vivant et énergique. Idéal pour les créatifs et métiers de bouche.",
    thumbnail: "🌈",
    features: ["Couleurs vibrantes", "Dynamique et joyeux", "Attraction visuelle", "Idéal réseaux sociaux"],
    style: {
      header: "gradient",
      contactLayout: "floating",
      sectionOrder: ["hero", "contact", "gallery", "services", "reviews", "faq"],
      cardStyle: "pill",
      fontFamily: "display",
      colors: { primary: "#7c3aed", secondary: "#f3e8ff", background: "#faf5ff", accent: "#ec4899" },
    },
  },
  creatif: {
    id: "creatif",
    name: "Créatif",
    description: "Original et mémorable. Pour les artisans qui veulent se démarquer.",
    thumbnail: "✨",
    features: ["Design unique", "Animations subtiles", "Storytelling visuel", "Impact mémorable"],
    style: {
      header: "hero",
      contactLayout: "floating",
      sectionOrder: ["hero", "gallery", "contact", "services", "reviews", "faq"],
      cardStyle: "rounded",
      fontFamily: "display",
      colors: { primary: "#0d9488", secondary: "#ccfbf1", background: "#f0fdfa", accent: "#f59e0b" },
    },
  },
};

export function getTemplate(templateId: string): PageTemplate {
  return pageTemplates[templateId] || pageTemplates.minimaliste;
}
