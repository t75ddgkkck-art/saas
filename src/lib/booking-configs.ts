// Configuration dynamique du formulaire de réservation selon le métier

export interface BookingField {
  id: string;
  type: "text" | "textarea" | "select" | "number" | "checkbox";
  label: string;
  placeholder?: string;
  required: boolean;
  options?: { value: string; label: string }[];
}

export interface BookingConfig {
  category: string;
  fields: BookingField[];
}

export const bookingConfigs: Record<string, BookingConfig> = {
  plombier: {
    category: "plombier",
    fields: [
      {
        id: "problem_type",
        type: "select",
        label: "Type de problème",
        required: true,
        options: [
          { value: "fuite", label: "Fuite d'eau" },
          { value: "bouchon", label: "Canalisation bouchée" },
          { value: "chauffe_eau", label: "Chauffe-eau / Ballon" },
          { value: "robinet", label: "Robinet / Mitigeur" },
          { value: "wc", label: "Chasse d'eau / WC" },
          { value: "renovation", label: "Rénovation salle de bain / cuisine" },
          { value: "installation", label: "Installation neuve" },
          { value: "autre", label: "Autre" },
        ],
      },
      {
        id: "urgency",
        type: "select",
        label: "Urgence",
        required: true,
        options: [
          { value: "critical", label: "Urgence (eau qui coule)" },
          { value: "high", label: "Important (sous 48h)" },
          { value: "normal", label: "Normal (cette semaine)" },
          { value: "low", label: "Pas urgent" },
        ],
      },
      { id: "description", type: "textarea", label: "Description du problème", required: true },
    ],
  },

  coiffeur: {
    category: "coiffeur",
    fields: [
      {
        id: "service",
        type: "select",
        label: "Prestation souhaitée",
        required: true,
        options: [
          { value: "coupe_femme", label: "Coupe femme" },
          { value: "coupe_homme", label: "Coupe homme" },
          { value: "coloration", label: "Coloration" },
          { value: "meches", label: "Mèches / Balayage" },
          { value: "mariage", label: "Coiffure mariage / événement" },
          { value: "soin", label: "Soin capillaire" },
        ],
      },
      {
        id: "hair_length",
        type: "select",
        label: "Longueur des cheveux",
        required: false,
        options: [
          { value: "court", label: "Court" },
          { value: "mi_long", label: "Mi-long" },
          { value: "long", label: "Long" },
        ],
      },
      { id: "preferences", type: "textarea", label: "Précisions / Envies", required: false },
    ],
  },

  electricien: {
    category: "electricien",
    fields: [
      {
        id: "problem_type",
        type: "select",
        label: "Type d'intervention",
        required: true,
        options: [
          { value: "panne", label: "Panne électrique" },
          { value: "tableau", label: "Tableau électrique" },
          { value: "installation", label: "Installation neuve" },
          { value: "renovation", label: "Rénovation électrique" },
          { value: "mise_conformite", label: "Mise aux normes" },
        ],
      },
      { id: "surface", type: "number", label: "Surface approximative (m²)", required: false },
      { id: "description", type: "textarea", label: "Description", required: true },
    ],
  },
};

export function getBookingConfig(category: string): BookingConfig {
  return (
    bookingConfigs[category] || {
      category: "autre",
      fields: [
        { id: "service", type: "text", label: "Service souhaité", required: true },
        { id: "description", type: "textarea", label: "Description", required: true },
      ],
    }
  );
}
