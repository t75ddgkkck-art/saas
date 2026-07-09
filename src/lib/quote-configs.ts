// Configuration dynamique des formulaires de devis par catégorie

export interface QuoteField {
  id: string;
  type: "text" | "textarea" | "select" | "number" | "date" | "image" | "checkbox";
  label: string;
  placeholder?: string;
  required: boolean;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  section?: string;
}

export interface QuoteFormConfig {
  category: string;
  title: string;
  description: string;
  fields: QuoteField[];
  attachmentLabel: string;
  submitLabel: string;
}

export const quoteFormConfigs: Record<string, QuoteFormConfig> = {
  plombier: {
    category: "plombier",
    title: "Demande d'intervention plomberie",
    description: "Décrivez votre problème de plomberie et nous vous répondrons sous 24h",
    fields: [
      { id: "problem_type", type: "select", label: "Type de problème", required: true, options: [
        { value: "fuite", label: "💧 Fuite d'eau" },
        { value: "bouchon", label: "🚿 Canalisation bouchée" },
        { value: "chauffe_eau", label: "🔥 Chauffe-eau / Ballon" },
        { value: "robinet", label: "🚰 Robinet / Mitigeur" },
        { value: "wc", label: "🚽 Chasse d'eau / WC" },
        { value: "renovation", label: "🏗️ Rénovation salle de bain / cuisine" },
        { value: "installation", label: "🔧 Installation neuve" },
        { value: "autre", label: "❓ Autre" },
      ]},
      { id: "urgency", type: "select", label: "Urgence", required: true, options: [
        { value: "critical", label: "🚨 Urgence (eau qui coule, dégât)" },
        { value: "high", label: "⚠️ Important (sous 48h)" },
        { value: "normal", label: "📅 Normal (cette semaine)" },
        { value: "low", label: "🕐 Pas urgent (planification)" },
      ]},
      { id: "description", type: "textarea", label: "Décrivez le problème", placeholder: "Ex: Fuite sous l'évier de la cuisine depuis ce matin, l'eau coule en continu...", required: true },
      { id: "rooms_affected", type: "text", label: "Pièce(s) concernée(s)", placeholder: "Ex: Cuisine, Salle de bain", required: false },
      { id: "building_age", type: "select", label: "Âge approximatif du bâtiment", required: false, options: [
        { value: "new", label: "Moins de 10 ans" },
        { value: "medium", label: "10-30 ans" },
        { value: "old", label: "30-60 ans" },
        { value: "very_old", label: "Plus de 60 ans" },
      ]},
      { id: "access", type: "textarea", label: "Accès / Informations pratiques", placeholder: "Ex: 3ème étage sans ascenseur, parking disponible...", required: false },
    ],
    attachmentLabel: "Photos de la fuite / du problème",
    submitLabel: "Envoyer ma demande d'intervention",
  },

  electricien: {
    category: "electricien",
    title: "Demande d'intervention électrique",
    description: "Décrivez votre besoin et recevez un devis gratuit sous 24h",
    fields: [
      { id: "problem_type", type: "select", label: "Type d'intervention", required: true, options: [
        { value: "panne", label: "⚡ Panne électrique" },
        { value: "tableau", label: "🔌 Tableau électrique" },
        { value: "installation", label: "🏗️ Installation neuve" },
        { value: "renovation", label: "🔄 Rénovation électrique" },
        { value: "mise_conformite", label: "📋 Mise aux normes" },
        { value: "eclairage", label: "💡 Éclairage" },
        { value: "domotique", label: "📱 Domotique" },
        { value: "autre", label: "❓ Autre" },
      ]},
      { id: "surface", type: "number", label: "Surface approximative (m²)", placeholder: "Ex: 80", required: false },
      { id: "description", type: "textarea", label: "Décrivez votre besoin", placeholder: "Ex: Disjoncteur qui saute régulièrement dans la cuisine...", required: true },
      { id: "nb_pieces", type: "number", label: "Nombre de pièces", placeholder: "Ex: 4", required: false },
    ],
    attachmentLabel: "Photos du tableau / de l'installation",
    submitLabel: "Envoyer ma demande",
  },

  coiffeur: {
    category: "coiffeur",
    title: "Réservation & Devis Coiffure",
    description: "Choisissez votre prestation et réservez en ligne",
    fields: [
      { id: "service", type: "select", label: "Prestation souhaitée", required: true, options: [
        { value: "coupe_femme", label: "💇 Coupe femme" },
        { value: "coupe_homme", label: "💈 Coupe homme" },
        { value: "coupe_enfant", label: "👦 Coupe enfant" },
        { value: "coloration", label: "🎨 Coloration" },
        { value: "meches", label: "✨ Mèches / Balayage" },
        { value: "brushing", label: "💨 Brushing" },
        { value: "soin", label: "💆 Soin capillaire" },
        { value: "lissage", label: "🪮 Lissage / Permanente" },
        { value: "mariage", label: "👰 Coiffure mariage / événement" },
        { value: "forfait", label: "📦 Forfait complet" },
      ]},
      { id: "hair_length", type: "select", label: "Longueur des cheveux", required: false, options: [
        { value: "court", label: "Court" },
        { value: "mi_long", label: "Mi-long" },
        { value: "long", label: "Long" },
        { value: "tres_long", label: "Très long" },
      ]},
      { id: "preferences", type: "textarea", label: "Précisions / Envies", placeholder: "Ex: Je voudrais une coupe courte avec des mèches blondes...", required: false },
      { id: "allergies", type: "checkbox", label: "Allergies connues (coloration, etc.)", required: false },
      { id: "budget", type: "select", label: "Budget approximatif", required: false, options: [
        { value: "basic", label: "💰 Basique (30-50€)" },
        { value: "medium", label: "💰💰 Moyen (50-100€)" },
        { value: "premium", label: "💰💰💰 Premium (100€+)" },
      ]},
    ],
    attachmentLabel: "Photo de la coupe / couleur souhaitée",
    submitLabel: "Réserver / Demander un devis",
  },

  peintre: {
    category: "peintre",
    title: "Demande de devis Peinture",
    description: "Décrivez votre projet peinture et recevez un devis gratuit",
    fields: [
      { id: "service", type: "select", label: "Type de prestation", required: true, options: [
        { value: "interieur", label: "🏠 Peinture intérieure" },
        { value: "exterieur", label: "🏡 Peinture extérieure / façade" },
        { value: "decoratif", label: "🎨 Peinture décorative" },
        { value: "enduit", label: "🧱 Enduit / Ragréage" },
        { value: "papier_peint", label: "📄 Papier peint" },
        { value: "ravalement", label: "🏗️ Ravalement de façade" },
        { value: "bois", label: "🪚 Peinture bois / ferronnerie" },
        { value: "autre", label: "❓ Autre" },
      ]},
      { id: "surface", type: "number", label: "Surface à peindre (m²)", placeholder: "Ex: 60", required: false },
      { id: "nb_pieces", type: "number", label: "Nombre de pièces", placeholder: "Ex: 3", required: false },
      { id: "description", type: "textarea", label: "Détails du projet", placeholder: "Ex: Peinture blanche pour le salon et les chambres, peinture bleue pour la chambre d'enfant...", required: true },
      { id: "state", type: "select", label: "État actuel des murs", required: false, options: [
        { value: "neuf", label: "Neuf (plâtre/placo)" },
        { value: "bon", label: "Bon état" },
        { value: "moyen", label: "Moyen (quelques fissures)" },
        { value: "mauvais", label: "Mauvais (préparation importante)" },
      ]},
      { id: "colors", type: "textarea", label: "Couleurs souhaitées", placeholder: "Ex: Blanc mat pour le plafond, gris perle pour les murs...", required: false },
    ],
    attachmentLabel: "Photos des pièces / de la façade",
    submitLabel: "Demander mon devis gratuit",
  },

  garagiste: {
    category: "garagiste",
    title: "Demande d'intervention automobile",
    description: "Décrivez le problème de votre véhicule",
    fields: [
      { id: "vehicle_info", type: "text", label: "Véhicule (marque, modèle, année)", placeholder: "Ex: Renault Clio 4, 2018", required: true },
      { id: "service", type: "select", label: "Type d'intervention", required: true, options: [
        { value: "vidange", label: "🛢️ Vidange / Révision" },
        { value: "freins", label: "🛑 Freins" },
        { value: "pneus", label: "🔘 Pneus" },
        { value: "distribution", label: "⚙️ Distribution" },
        { value: "diagnostic", label: "🔍 Diagnostic / Voyant" },
        { value: "clim", label: "❄️ Climatisation" },
        { value: "batterie", label: "🔋 Batterie / Démarrage" },
        { value: "carrosserie", label: "🚗 Carrosserie" },
        { value: "controle_tech", label: "📋 Contrôle technique" },
        { value: "autre", label: "❓ Autre" },
      ]},
      { id: "description", type: "textarea", label: "Décrivez le problème", placeholder: "Ex: Bruit anormal au freinage, voyant moteur allumé...", required: true },
      { id: "km", type: "number", label: "Kilométrage approximatif", placeholder: "Ex: 85000", required: false },
    ],
    attachmentLabel: "Photo du véhicule / du problème",
    submitLabel: "Envoyer ma demande",
  },

  couvreur: {
    category: "couvreur",
    title: "Demande de devis Couverture",
    description: "Décrivez votre besoin en toiture",
    fields: [
      { id: "service", type: "select", label: "Type d'intervention", required: true, options: [
        { value: "reparation", label: "🔧 Réparation fuite" },
        { value: "renovation", label: "🏗️ Rénovation toiture" },
        { value: "tuiles", label: "🧱 Remplacement de tuiles" },
        { value: "zinc", label: "🪙 Travaux de zinguerie" },
        { value: "gouttiere", label: "🌊 Gouttières" },
        { value: "isolation", label: "🧤 Isolation toiture" },
        { value: "demoussage", label: "🧹 Démoussage" },
        { value: "nettoyage", label: "💧 Nettoyage toiture" },
        { value: "autre", label: "❓ Autre" },
      ]},
      { id: "roof_type", type: "select", label: "Type de toiture", required: false, options: [
        { value: "tuiles", label: "Tuiles" },
        { value: "ardoise", label: "Ardoise" },
        { value: "bac_acier", label: "Bac acier" },
        { value: "zinc", label: "Zinc" },
        { value: "plat", label: "Toiture plate" },
      ]},
      { id: "description", type: "textarea", label: "Décrivez le problème", placeholder: "Ex: Fuite au niveau de la cheminée, tuiles cassées après la tempête...", required: true },
      { id: "floors", type: "number", label: "Nombre d'étages", placeholder: "Ex: 2", required: false },
    ],
    attachmentLabel: "Photos de la toiture / des dégâts",
    submitLabel: "Demander mon devis gratuit",
  },

  menuisier: {
    category: "menuisier",
    title: "Demande de devis Menuiserie",
    description: "Décrivez votre projet menuiserie sur mesure",
    fields: [
      { id: "service", type: "select", label: "Type de projet", required: true, options: [
        { value: "porte", label: "🚪 Porte intérieure / extérieure" },
        { value: "fenetre", label: "🪟 Fenêtre / Baie vitrée" },
        { value: "escalier", label: "🪜 Escalier" },
        { value: "placard", label: "📦 Placard / Dressing" },
        { value: "cuisine", label: "🍳 Cuisine sur mesure" },
        { value: "meuble", label: "🪑 Meuble sur mesure" },
        { value: "terrasse", label: "🏡 Terrasse / Pergola" },
        { value: "autre", label: "❓ Autre" },
      ]},
      { id: "material", type: "select", label: "Matériau souhaité", required: false, options: [
        { value: "chene", label: "🪵 Chêne" },
        { value: "pin", label: "🌲 Pin" },
        { value: "exotique", label: "🌴 Bois exotique" },
        { value: "aluminium", label: "🔩 Aluminium" },
        { value: "pvc", label: "⬜ PVC" },
        { value: "mixte", label: "🔄 Mixte" },
      ]},
      { id: "dimensions", type: "textarea", label: "Dimensions approximatives", placeholder: "Ex: Porte 90x210cm, dressing 2m de large sur 2.5m de haut...", required: false },
      { id: "description", type: "textarea", label: "Détails du projet", placeholder: "Ex: Je souhaite un dressing sur mesure avec étagères et penderie...", required: true },
    ],
    attachmentLabel: "Photos de l'espace / du projet souhaité",
    submitLabel: "Demander mon devis gratuit",
  },
};

// Default config for categories not specifically configured
export const defaultQuoteConfig: QuoteFormConfig = {
  category: "autre",
  title: "Demande de devis",
  description: "Décrivez votre projet et recevez un devis gratuit",
  fields: [
    { id: "service", type: "select", label: "Type de prestation", required: true, options: [
      { value: "devis", label: "📋 Demande de devis" },
      { value: "info", label: "ℹ️ Demande d'information" },
      { value: "rdv", label: "📅 Prise de rendez-vous" },
      { value: "autre", label: "❓ Autre" },
    ]},
    { id: "description", type: "textarea", label: "Décrivez votre besoin", placeholder: "Décrivez votre projet en détail...", required: true },
    { id: "budget", type: "text", label: "Budget estimé", placeholder: "Ex: 500-1000€", required: false },
    { id: "deadline", type: "date", label: "Date souhaitée", required: false },
  ],
  attachmentLabel: "Photos / Documents",
  submitLabel: "Envoyer ma demande",
};

export function getQuoteConfig(category: string): QuoteFormConfig {
  return quoteFormConfigs[category] || defaultQuoteConfig;
}
