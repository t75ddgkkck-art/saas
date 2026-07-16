// Permissions par abonnement
// Centralisation de toutes les règles métier par plan

export type SubscriptionPlan = "free" | "pro" | "premium";

export interface PlanPermissions {
  // Vitrine
  canCustomizeTemplate: boolean;
  canHideBranding: boolean;
  canCustomDomain: boolean;
  maxTemplates: number;

  // Services & Tarifs
  canAddServices: boolean;
  maxServices: number;

  // Réservation
  canEnableBooking: boolean;

  // Devis
  canEnableQuotes: boolean;

  // Paiements
  canEnableStripe: boolean;
  canAcceptApplePay: boolean;

  // CRM
  canAddClients: boolean;
  maxClients: number;

  // IA
  canEnableAi: boolean;
  canAiChatbot: boolean;
  canAiBlog: boolean;
  canAiPosts: boolean;
  canAiReports: boolean;

  // Automatisations
  canEnableReminders: boolean;
  canSmsReminders: boolean;
  canWhatsappReminders: boolean;
  canAutoReviewRequest: boolean;

  // Équipe
  canAddTeamMembers: boolean;
  maxTeamMembers: number;

  // Fidélité
  canEnableLoyalty: boolean;

  // Menu restaurant
  canEnableMenu: boolean;

  // Blog
  maxBlogPosts: number;

  // Analytics
  canAdvancedAnalytics: boolean;

  // PDF
  canMultiTemplatePdf: boolean;
  maxPdfTemplates: number;

  // Lot 46 (F11) : nombre max de vitrines/businesses par compte user.
  // Free: 1, Pro: 1, Premium: 3. Historique compat : sans cette clé, `getLimit`
  // renvoie undefined donc les vieux users continuent à voir 1 vitrine par défaut.
  maxBusinesses: number;

  // Lot 47 (F12) : nombre max de QR codes trackables par business.
  // Free: 1 (test), Pro: 3 (multi-supports basiques), Premium: 20 (campagnes A/B).
  maxQrCodes: number;
}

export const PLAN_PERMISSIONS: Record<SubscriptionPlan, PlanPermissions> = {
  free: {
    canCustomizeTemplate: false,
    canHideBranding: false,
    canCustomDomain: false,
    maxTemplates: 1,

    canAddServices: true,
    maxServices: 10,

    canEnableBooking: true,

    canEnableQuotes: false,

    canEnableStripe: false,
    canAcceptApplePay: false,

    canAddClients: true,
    maxClients: 50,

    canEnableAi: false,
    canAiChatbot: false,
    canAiBlog: false,
    canAiPosts: false,
    canAiReports: false,

    canEnableReminders: false,
    canSmsReminders: false,
    canWhatsappReminders: false,
    canAutoReviewRequest: false,

    canAddTeamMembers: false,
    maxTeamMembers: 0,

    canEnableLoyalty: false,

    canEnableMenu: true,

    maxBlogPosts: 3,

    canAdvancedAnalytics: false,

    canMultiTemplatePdf: false,
    maxPdfTemplates: 1,

    // Lot 46 : Free = 1 seule vitrine
    maxBusinesses: 1,

    // Lot 47 : Free = 1 QR trackable (test unique)
    maxQrCodes: 1,
  },

  pro: {
    canCustomizeTemplate: true,
    canHideBranding: false,
    canCustomDomain: false,
    maxTemplates: 4,

    canAddServices: true,
    maxServices: 50,

    canEnableBooking: true,

    canEnableQuotes: true,

    canEnableStripe: true,
    canAcceptApplePay: true,

    canAddClients: true,
    maxClients: 500,

    canEnableAi: false,
    canAiChatbot: false,
    canAiBlog: true,
    canAiPosts: false,
    canAiReports: false,

    canEnableReminders: true,
    canSmsReminders: false,
    canWhatsappReminders: false,
    canAutoReviewRequest: true,

    canAddTeamMembers: true,
    maxTeamMembers: 2,

    canEnableLoyalty: false,

    canEnableMenu: true,

    maxBlogPosts: 100,

    canAdvancedAnalytics: true,

    canMultiTemplatePdf: true,
    maxPdfTemplates: 3,

    // Lot 46 : Pro reste à 1 vitrine — argument commercial de l'upgrade Premium
    maxBusinesses: 1,

    // Lot 47 : Pro = 3 QR (multi-supports basiques : cartes / camionnette / flyer)
    maxQrCodes: 3,
  },

  premium: {
    canCustomizeTemplate: true,
    canHideBranding: true,
    canCustomDomain: true,
    maxTemplates: 7,

    canAddServices: true,
    maxServices: -1, // illimité

    canEnableBooking: true,

    canEnableQuotes: true,

    canEnableStripe: true,
    canAcceptApplePay: true,

    canAddClients: true,
    maxClients: -1, // illimité

    canEnableAi: true,
    canAiChatbot: true,
    canAiBlog: true,
    canAiPosts: true,
    canAiReports: true,

    canEnableReminders: true,
    canSmsReminders: true,
    canWhatsappReminders: true,
    canAutoReviewRequest: true,

    canAddTeamMembers: true,
    maxTeamMembers: -1, // illimité

    canEnableLoyalty: true,

    canEnableMenu: true,

    maxBlogPosts: -1, // illimité

    canAdvancedAnalytics: true,

    canMultiTemplatePdf: true,
    maxPdfTemplates: 10,

    // Lot 46 : Premium = jusqu'à 3 vitrines simultanées (multi-marques / franchisés)
    maxBusinesses: 3,

    // Lot 47 : Premium = 20 QR (campagnes A/B, saisonnières, multi-canaux)
    maxQrCodes: 20,
  },
};

// Helper pour vérifier les permissions
export function checkPermission(
  plan: SubscriptionPlan,
  permission: keyof PlanPermissions
): boolean {
  return PLAN_PERMISSIONS[plan][permission] === true;
}

export function getPlanLimits(plan: SubscriptionPlan, limit: keyof PlanPermissions): number {
  return PLAN_PERMISSIONS[plan][limit] as number;
}
