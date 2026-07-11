import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  decimal,
  jsonb,
  uuid,
  pgEnum,
  index,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ============== ENUMS ==============

export const roleEnum = pgEnum("role", ["admin", "professional", "employee", "assistant"]);
export const subscriptionEnum = pgEnum("subscription", ["free", "pro", "premium"]);
// Lot 24 : ajout de `no_show` (client absent au RDV). Utilisé par le CRM
// pour incrémenter `clients.no_shows_count` et proposer une politique
// (rappel obligatoire, acompte à l'avance…) pour les clients à risque.
export const appointmentStatusEnum = pgEnum("appointment_status", [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
]);
export const quoteStatusEnum = pgEnum("quote_status", [
  "draft",
  "sent",
  "accepted",
  "rejected",
  "signed",
  "expired",
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "completed",
  "failed",
  "refunded",
]);
export const paymentTypeEnum = pgEnum("payment_type", ["deposit", "full", "subscription"]);
// F2 (Lot 30) : statut spécifique aux acomptes RDV. Séparé de payment_status
// car un RDV peut être `pending` (créneau tenu) → `paid` (acompte reçu) →
// `refunded` (annulé dans les délais) OU `forfeited` (annulé hors délais,
// acompte non remboursé, le pro conserve).
export const depositStatusEnum = pgEnum("deposit_status", [
  "pending",
  "paid",
  "refunded",
  "forfeited",
]);
export const reminderTypeEnum = pgEnum("reminder_type", ["email", "sms", "whatsapp"]);
export const clientSourceEnum = pgEnum("client_source", [
  "website",
  "google",
  "referral",
  "social",
  "other",
]);

// ============== USERS ==============

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    phone: varchar("phone", { length: 20 }),
    role: roleEnum("role").default("professional").notNull(),
    subscription: subscriptionEnum("subscription").default("free").notNull(),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
    // Statut fin de la subscription Stripe : active | trialing | past_due |
    // canceled | unpaid | incomplete. Différent de `subscription` (free/pro/premium)
    // qui reste le plan effectif après grace period.
    subscriptionStatus: varchar("subscription_status", { length: 30 }),
    // Grace period : date jusqu'à laquelle l'accès premium/pro est maintenu
    // même si Stripe indique past_due/unpaid. Downgrade auto après.
    subscriptionExpiresAt: timestamp("subscription_expires_at"),
    emailVerified: boolean("email_verified").default(false).notNull(),
    // Lot 13 monitoring : ban admin (soft, ne supprime rien).
    // Non-null = compte banni depuis cette date → login refusé.
    bannedAt: timestamp("banned_at"),
    banReason: varchar("ban_reason", { length: 500 }),
    // Lot 14.3 soft delete : RGPD "droit à l'oubli" + audit.
    // Non-null = user supprimé logiquement. Toutes les requêtes de listing
    // doivent filtrer WHERE deleted_at IS NULL (voir helpers `notDeleted()`
    // dans src/lib/soft-delete.ts).
    deletedAt: timestamp("deleted_at"),
    // Lot 16.3 parrainage : code unique attribué à l'inscription (ex: "VX-A3F7K2").
    // Le user peut le partager → chaque filleul qui souscrit un plan payant
    // débloque 1 mois gratuit pour le parrain.
    referralCode: varchar("referral_code", { length: 20 }),
    // User qui a parrainé celui-ci (nullable si inscription directe)
    referredBy: uuid("referred_by").references((): AnyPgColumn => users.id, {
      onDelete: "set null",
    }),
    // Nombre de mois de crédit accumulés (non encore appliqués sur la souscription).
    // Le webhook Stripe checkout.completed du filleul incrémente +1 sur le parrain.
    referralCreditMonths: integer("referral_credit_months").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    // Recherche login case-insensitive
    emailLowerIdx: uniqueIndex("users_email_lower_uidx").on(sql`lower(${t.email})`),
    // Cron de downgrade : "who has grace period expired ?"
    subscriptionExpiresIdx: index("users_subscription_expires_idx").on(t.subscriptionExpiresAt),
    // Lot 14.3 : listing "users actifs" scanne uniquement les non-supprimés
    deletedAtIdx: index("users_deleted_at_idx").on(t.deletedAt),
    // Lot 16.3 : lookup "à qui appartient ce code parrain ?" (unique global)
    referralCodeIdx: uniqueIndex("users_referral_code_uidx")
      .on(t.referralCode)
      .where(sql`${t.referralCode} is not null`),
    // Reverse lookup : "qui a été parrainé par X ?" (dashboard parrainage)
    referredByIdx: index("users_referred_by_idx").on(t.referredBy),
  })
);

export const usersRelations = relations(users, ({ one, many }) => ({
  business: one(businesses, {
    fields: [users.id],
    references: [businesses.ownerId],
  }),
  appointments: many(appointments, { relationName: "createdBy" }),
  quotes: many(quotes, { relationName: "createdBy" }),
  clients: many(clients),
  notes: many(notes),
}));

// ============== BUSINESSES ==============

export const businesses = pgTable(
  "businesses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Lot 14.8 : cascade ownership → si le user est supprimé (RGPD droit à
    // l'oubli), son business dégage aussi. Avant : orphelin en DB.
    // En pratique on préfère le soft delete via `deletedAt` mais le hard
    // delete via cascade reste la garantie ultime.
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 100 }).notNull(),
    logo: text("logo"),
    coverImage: text("cover_image"),
    profileImage: text("profile_image"),
    address: text("address"),
    city: varchar("city", { length: 100 }),
    postalCode: varchar("postal_code", { length: 20 }),
    country: varchar("country", { length: 50 }).default("France"),
    latitude: decimal("latitude", { precision: 10, scale: 7 }),
    longitude: decimal("longitude", { precision: 10, scale: 7 }),
    serviceArea: text("service_area"),
    phone: varchar("phone", { length: 20 }),
    whatsapp: varchar("whatsapp", { length: 20 }),
    email: varchar("email", { length: 255 }),
    website: varchar("website", { length: 255 }),
    emergencyPhone: varchar("emergency_phone", { length: 20 }),
    showEmergency: boolean("show_emergency").default(false),
    taxNumber: varchar("tax_number", { length: 50 }),
    siret: varchar("siret", { length: 20 }),
    // Personnalisation vitrine
    primaryColor: varchar("primary_color", { length: 20 }).default("#0f172a"),
    hideBranding: boolean("hide_branding").default(false),
    language: varchar("language", { length: 5 }).default("fr"),
    // Fuseau horaire IANA (ex: "Europe/Paris"). Défaut : Paris pour les nouveaux comptes.
    timezone: varchar("timezone", { length: 64 }).default("Europe/Paris"),
    template: varchar("template", { length: 30 }).default("classique"),
    showQrOnPage: boolean("show_qr_on_page").default(true),
    customDomain: varchar("custom_domain", { length: 255 }),
    publicChatEnabled: boolean("public_chat_enabled").default(false),
    autoReviewRequest: boolean("auto_review_request").default(false),
    // Contrôle de l'affichage des avis sur la vitrine
    showReviewsOnPage: boolean("show_reviews_on_page").default(true),
    // Badges / avantages personnalisables de la vitrine
    highlightsEnabled: boolean("highlights_enabled").default(true),
    highlightsData: jsonb("highlights_data"), // [{ icon: "⚡", title: "Intervention rapide", subtitle: "Sous 2h" }]
    iban: varchar("iban", { length: 50 }),
    bic: varchar("bic", { length: 20 }),
    // Lot 14.5 doc : timestamp de "reset des stats de visites".
    // Le dashboard analytics ne compte les visites que WHERE created_at >= visits_reset_at.
    // Set via DELETE /api/my-availability (bouton "Réinitialiser mes stats").
    // Nullable = pas de reset → toutes les visites de tous les temps sont comptées.
    visitsResetAt: timestamp("visits_reset_at"),
    googlePlaceId: varchar("google_place_id", { length: 200 }),
    reminderSmsEnabled: boolean("reminder_sms_enabled").default(false),
    reminderWhatsappEnabled: boolean("reminder_whatsapp_enabled").default(false),
    menuData: jsonb("menu_data"), // Pour les restaurants: [{category: "Plats", items: [...]}]
    // Paiements
    enableStripe: boolean("enable_stripe").default(false),
    stripeAccountId: varchar("stripe_account_id", { length: 255 }),
    acceptCash: boolean("accept_cash").default(true),
    acceptApplePay: boolean("accept_apple_pay").default(false),
    // F2 (Lot 30) : politique de remboursement d'acompte.
    // Nombre d'heures AVANT le RDV où l'annulation donne droit au remboursement
    // automatique. Ex : 48 → annulation 48h avant = remboursé, sinon forfeited.
    // NULL = pas de politique définie (jamais remboursé automatiquement, à la main).
    depositRefundHours: integer("deposit_refund_hours"),
    // F4 (Lot 33) : secret opaque pour l'URL ICS publique (CalDAV/Apple/Outlook).
    // Format hex 32 chars, généré à la demande via /api/calendar/ics-secret rotate.
    // Route publique `/api/calendar/[secret].ics` renvoie les RDV en iCalendar.
    icsSecret: varchar("ics_secret", { length: 64 }),
    // Programme de fidélité (Premium)
    loyaltyEnabled: boolean("loyalty_enabled").default(false),
    loyaltyPointsPerEuro: integer("loyalty_points_per_euro").default(1),
    loyaltyReward: text("loyalty_reward"),
    // Lot 14.3 soft delete
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    // Lookup vitrine (chaque hit /[slug])
    slugIdx: uniqueIndex("businesses_slug_uidx").on(t.slug),
    // Dashboard : "mon business" par owner
    ownerIdx: index("businesses_owner_idx").on(t.ownerId),
    // Annuaire par ville (recherche case-insensitive)
    cityIdx: index("businesses_city_idx").on(sql`lower(${t.city})`),
    // Annuaire par catégorie
    categoryIdx: index("businesses_cat_idx").on(t.category),
    // SIRET unique quand présent (empêche les doublons)
    siretIdx: uniqueIndex("businesses_siret_uidx")
      .on(t.siret)
      .where(sql`${t.siret} is not null`),
    // Lot 14.3 soft delete : listing "vitrines actives" scanne uniquement les non-supprimées
    deletedAtIdx: index("businesses_deleted_at_idx").on(t.deletedAt),
  })
);

// Points de fidélité par client
export const loyaltyPoints = pgTable("loyalty_points", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  points: integer("points").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Membres d'équipe (Premium) : secrétaire, employé avec accès limité
// F5 (Lot 32) — team_members refonte avec vrais rôles + link user.
//
// Rôles :
//  - owner    : le propriétaire du business (implicite, jamais dans team_members)
//  - admin    : peut inviter/révoquer, gérer paramètres business
//  - employee : peut voir + éditer RDV/devis/clients qui lui sont assignés + créer nouveaux
//  - viewer   : lecture seule (comptable, stagiaire)
//
// Le membre est identifié par EMAIL au moment de l'invitation. Quand il
// s'inscrit avec le même email (register ou magic-link), `user_id` est
// automatiquement rempli côté API accept-invitation → il accède au dashboard
// du business via `getCurrentTeamContext()`.
export const teamMembers = pgTable(
  "team_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    // Link vers users : rempli quand le membre accepte l'invitation
    // ON DELETE SET NULL : si le user est supprimé, on garde la trace
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    email: varchar("email", { length: 255 }).notNull(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }),
    // Valeurs valides : admin | employee | viewer (owner implicite via businesses.ownerId)
    // (varchar + CHECK SQL pour éviter d'ajouter un enum PG qu'il faudrait migrer)
    memberRole: varchar("member_role", { length: 30 }).default("employee").notNull(),
    invitedByUserId: uuid("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    invitedAt: timestamp("invited_at").defaultNow().notNull(),
    // NULL = invitation pas encore acceptée. Rempli à l'acceptation.
    acceptedAt: timestamp("accepted_at"),
    active: boolean("active").default(true).notNull(),
    // Lot 14.3 soft delete (garde trace historique quand un membre part)
    deletedAt: timestamp("deleted_at"),
  },
  (t) => ({
    businessIdx: index("team_members_business_idx").on(t.businessId),
    // Lookup par user pour getCurrentTeamContext (résout tous les businesses
    // où l'user courant est membre actif)
    userIdx: index("team_members_user_idx").on(t.userId),
    // Anti-doublon par (business, email lowercase) — géré aussi côté route
    businessEmailUidx: uniqueIndex("team_members_business_email_uidx").on(
      t.businessId,
      sql`lower(${t.email})`
    ),
  })
);

// F4 (Lot 33) — Blocs d'indisponibilité (déjeuner, congés, chantier long, etc.).
// Séparés de `appointments` car ce ne sont pas des RDV clients :
//  - Pas de clientId, pas de status, pas de deposit
//  - Peuvent être récurrents (v2 : ajout `rrule`) — pour v1, one-shot
//  - Assignables à un membre (bloque UNIQUEMENT son calendrier)
export const unavailabilities = pgTable(
  "unavailabilities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    // NULL = bloque toute l'équipe. Sinon uniquement ce membre.
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    title: varchar("title", { length: 200 }).notNull(),
    // Format YYYY-MM-DD (aligné avec appointments.date pour cohérence)
    date: varchar("date", { length: 10 }).notNull(),
    // Format HH:MM. NULL sur les 2 = journée entière.
    startTime: varchar("start_time", { length: 5 }),
    endTime: varchar("end_time", { length: 5 }),
    /** Optionnel : rappel visuel (couleur hex #RRGGBB) */
    color: varchar("color", { length: 7 }),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    // Scan calendrier : range de dates pour un business
    businessDateIdx: index("unavailabilities_business_date_idx").on(t.businessId, t.date),
    // Filtre "les miennes"
    userIdx: index("unavailabilities_user_idx").on(t.userId),
  })
);

// F4 (Lot 33) — Tokens Google Calendar par business (OAuth Calendar API).
// Distinct de google/callback qui gère Google Business Profile (avis). Ici on
// stocke refresh_token + calendarId (primary par défaut) pour pousser les RDV.
//
// Chaque business a AU PLUS un token Calendar (1:1). Refresh_token conservé
// tant que le user n'a pas révoqué côté Google.
export const calendarTokens = pgTable("calendar_tokens", {
  businessId: uuid("business_id")
    .primaryKey()
    .references(() => businesses.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 20 }).default("google").notNull(),
  refreshToken: text("refresh_token").notNull(),
  accessToken: text("access_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  calendarId: varchar("calendar_id", { length: 255 }).default("primary").notNull(),
  scope: text("scope"),
  connectedAt: timestamp("connected_at").defaultNow().notNull(),
  lastSyncAt: timestamp("last_sync_at"),
});

// F5 (Lot 32) — Invitations magic-link pour l'équipe.
// Séparé de auth_tokens (pros) et client_auth_tokens (clients finaux) pour
// isoler la logique : une invitation porte businessId + role à assigner.
export const teamInvitations = pgTable(
  "team_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    memberRole: varchar("member_role", { length: 30 }).notNull(),
    // Hash SHA-256 du token brut (identique pattern auth-tokens)
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    // NULL = non consommée. Non-null = déjà acceptée (single-use).
    acceptedAt: timestamp("accepted_at"),
    invitedByUserId: uuid("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    hashUidx: uniqueIndex("team_invitations_hash_uidx").on(t.tokenHash),
    businessEmailIdx: index("team_invitations_business_email_idx").on(t.businessId, t.email),
  })
);

// Demandes d'avis envoyées après un RDV terminé
export const reviewRequests = pgTable("review_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  appointmentId: uuid("appointment_id").references(() => appointments.id, { onDelete: "set null" }),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  channel: varchar("channel", { length: 20 }).default("email"),
});

// Visites réelles des vitrines (une ligne par visite)
export const pageVisits = pgTable(
  "page_visits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
    source: varchar("source", { length: 100 }).default("direct"),
    device: varchar("device", { length: 20 }).default("desktop"),
    path: varchar("path", { length: 200 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    // Dashboard analytics : "visites des 14/30 derniers jours"
    businessDateIdx: index("page_visits_business_date_idx").on(t.businessId, t.date),
  })
);

// Services et tarifs du pro
export const services = pgTable("services", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  price: varchar("price", { length: 50 }), // ex: "50€", "Sur devis" (legacy, gardé pour compat)
  // F2 (Lot 30) : prix numérique en centimes — nécessaire pour calculer un %
  // d'acompte de manière fiable (le champ `price` varchar était humain, pas parseable).
  // Nullable : les services legacy sans priceCents affichent le varchar comme avant.
  priceCents: integer("price_cents"),
  // F2 : configuration d'acompte pour ce service.
  // Type=null → pas d'acompte demandé. Type=fixed → montant en centimes.
  // Type=percent → depositAmount représente 0-100 (ex : 20 = 20%).
  depositType: varchar("deposit_type", { length: 10 }), // "fixed" | "percent" | null
  depositAmount: integer("deposit_amount"), // centimes si fixed, 0-100 si percent
  sortOrder: integer("sort_order").default(0).notNull(),
});

// Champs personnalisés pour le formulaire de devis
export const quoteFormFields = pgTable("quote_form_fields", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 200 }).notNull(),
  type: varchar("type", { length: 20 }).default("text").notNull(), // text, select, number
  options: text("options"), // pour les select, séparés par des virgules
  required: boolean("required").default(false).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
});

// Historique des points de fidélité (gains et utilisations)
export const loyaltyTransactions = pgTable("loyalty_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  points: integer("points").notNull(), // positif = gain, négatif = utilisation
  reason: varchar("reason", { length: 200 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const businessesRelations = relations(businesses, ({ one, many }) => ({
  owner: one(users, {
    fields: [businesses.ownerId],
    references: [users.id],
  }),
  workingHours: many(workingHours),
  appointments: many(appointments),
  quotes: many(quotes),
  galleryItems: many(galleryItems),
  reviews: many(reviews),
  faqs: many(faqs),
  socialLinks: many(socialLinks),
  payments: many(payments),
}));

// ============== WORKING HOURS ==============

export const workingHours = pgTable("working_hours", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(), // 0=Sunday, 6=Saturday
  startTime: varchar("start_time", { length: 5 }), // HH:MM
  endTime: varchar("end_time", { length: 5 }),
  isClosed: boolean("is_closed").default(false).notNull(),
});

export const workingHoursRelations = relations(workingHours, ({ one }) => ({
  business: one(businesses, {
    fields: [workingHours.businessId],
    references: [businesses.id],
  }),
}));

// ============== SOCIAL LINKS ==============

export const socialLinks = pgTable("social_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  platform: varchar("platform", { length: 50 }).notNull(), // facebook, instagram, linkedin, tiktok, youtube
  url: varchar("url", { length: 500 }).notNull(),
});

export const socialLinksRelations = relations(socialLinks, ({ one }) => ({
  business: one(businesses, {
    fields: [socialLinks.businessId],
    references: [businesses.id],
  }),
}));

// ============== GALLERY ==============

export const galleryItems = pgTable("gallery_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 20 }).notNull(), // image, video
  url: varchar("url", { length: 500 }).notNull(),
  thumbnailUrl: varchar("thumbnail_url", { length: 500 }),
  title: varchar("title", { length: 200 }),
  description: text("description"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const galleryItemsRelations = relations(galleryItems, ({ one }) => ({
  business: one(businesses, {
    fields: [galleryItems.businessId],
    references: [businesses.id],
  }),
}));

// ============== AVAILABILITY SLOTS ==============

export const availabilitySlots = pgTable("availability_slots", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  startTime: varchar("start_time", { length: 5 }).notNull(),
  endTime: varchar("end_time", { length: 5 }).notNull(),
  isBooked: boolean("is_booked").default(false).notNull(),
  isBlocked: boolean("is_blocked").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const availabilitySlotsRelations = relations(availabilitySlots, ({ one }) => ({
  business: one(businesses, {
    fields: [availabilitySlots.businessId],
    references: [businesses.id],
  }),
}));

// ============== APPOINTMENTS ==============

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    // Lot 14.8 : cascade user pour ne pas laisser createdBy orphelin
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    // F5 (Lot 32) : assignation à un membre d'équipe (nullable = non assigné).
    // Utilisé pour filtrer "mes RDV" côté employé + coloration calendrier.
    assignedToUserId: uuid("assigned_to_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    date: varchar("date", { length: 10 }).notNull(),
    startTime: varchar("start_time", { length: 5 }).notNull(),
    endTime: varchar("end_time", { length: 5 }).notNull(),
    status: appointmentStatusEnum("status").default("pending").notNull(),
    googleCalendarId: varchar("google_calendar_id", { length: 500 }),
    outlookCalendarId: varchar("outlook_calendar_id", { length: 500 }),
    reminderSent: boolean("reminder_sent").default(false),
    // F2 (Lot 30) : traçabilité de l'acompte pour ce RDV.
    // Si `depositRequired = true`, le RDV reste en status `pending` tant que
    // `depositStatus !== 'paid'`. Passage à `confirmed` piloté par le webhook Stripe.
    depositRequired: boolean("deposit_required").default(false).notNull(),
    depositAmountCents: integer("deposit_amount_cents"), // NULL si pas d'acompte
    depositStatus: depositStatusEnum("deposit_status"), // NULL si pas d'acompte
    // Session Stripe Checkout — lien d'audit + retry potentiel
    stripeCheckoutSessionId: varchar("stripe_checkout_session_id", { length: 255 }),
    // Lot 14.3 soft delete
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    // Dashboard : RDV du jour / semaine par business
    businessDateIdx: index("appointments_business_date_idx").on(t.businessId, t.date),
    // Filtre par statut (upcoming, completed, etc.)
    statusIdx: index("appointments_status_idx").on(t.status),
    // Historique client
    clientIdx: index("appointments_client_idx").on(t.clientId),
    // Lot 14.3 soft delete
    deletedAtIdx: index("appointments_deleted_at_idx").on(t.deletedAt),
    // F2 (Lot 30) : cron d'expiration des acomptes en attente
    // WHERE deposit_status='pending' AND created_at < now-15min
    depositScanIdx: index("appointments_deposit_scan_idx")
      .on(t.depositStatus, t.createdAt)
      .where(sql`${t.depositStatus} = 'pending'`),
    // F5 (Lot 32) : filtrer "mes RDV" côté employé
    assignedIdx: index("appointments_assigned_idx").on(t.assignedToUserId),
  })
);

export const appointmentsRelations = relations(appointments, ({ one, many }) => ({
  business: one(businesses, {
    fields: [appointments.businessId],
    references: [businesses.id],
  }),
  client: one(clients, {
    fields: [appointments.clientId],
    references: [clients.id],
  }),
  creator: one(users, {
    fields: [appointments.createdBy],
    references: [users.id],
  }),
  reminders: many(reminders),
}));

// ============== CLIENTS (CRM) ==============

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id").references(() => businesses.id, { onDelete: "cascade" }),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 20 }).notNull(),
    address: text("address"),
    notes: text("notes"),
    source: clientSourceEnum("source").default("other"),
    totalSpent: decimal("total_spent", { precision: 10, scale: 2 }).default("0"),
    appointmentsCount: integer("appointments_count").default(0),
    quotesCount: integer("quotes_count").default(0),
    // Lot 24 : incrémenté à chaque RDV passé en `no_show` par le pro.
    // Le CRM affichera un badge "⚠️ 3 no-shows" pour identifier les clients à risque.
    noShowsCount: integer("no_shows_count").default(0).notNull(),
    lastContact: timestamp("last_contact"),
    // Lot 14.3 soft delete
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    // Liste des clients d'un business (dashboard)
    businessIdx: index("clients_business_idx").on(t.businessId),
    // Upsert par (business, phone) très fréquent (book-appointment, quote-request)
    businessPhoneIdx: index("clients_business_phone_idx").on(t.businessId, t.phone),
    // Recherche par email (anti-doublon)
    businessEmailIdx: index("clients_business_email_idx").on(t.businessId, sql`lower(${t.email})`),
    // Lot 14.3 soft delete
    deletedAtIdx: index("clients_deleted_at_idx").on(t.deletedAt),
  })
);

export const clientsRelations = relations(clients, ({ one, many }) => ({
  business: one(businesses, {
    fields: [clients.businessId],
    references: [businesses.id],
  }),
  appointments: many(appointments),
  quotes: many(quotes),
  payments: many(payments),
  notes: many(notes),
}));

// ============== QUOTES ==============

export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    // Lot 14.8 : SET NULL au lieu de laisser orphelin. Un devis reste dans l'historique
    // même si son créateur (employé) quitte l'équipe.
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    // F5 (Lot 32) : assignation devis à un membre (commercial responsable)
    assignedToUserId: uuid("assigned_to_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    quoteNumber: varchar("quote_number", { length: 50 }).notNull().unique(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 100 }),
    subtotal: decimal("subtotal", { precision: 10, scale: 2 }).default("0"),
    tax: decimal("tax", { precision: 10, scale: 2 }).default("0"),
    total: decimal("total", { precision: 10, scale: 2 }).default("0"),
    depositAmount: decimal("deposit_amount", { precision: 10, scale: 2 }),
    status: quoteStatusEnum("status").default("draft").notNull(),
    validUntil: varchar("valid_until", { length: 10 }),
    signedAt: timestamp("signed_at"),
    signature: text("signature"),
    signatureUrl: text("signature_url"),
    termsAndConditions: text("terms_and_conditions"),
    reminderSentAt: timestamp("reminder_sent_at"),
    // Lot 14.3 soft delete
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    // Dashboard : "mes devis par statut"
    businessStatusIdx: index("quotes_business_status_idx").on(t.businessId, t.status),
    // Historique client
    clientIdx: index("quotes_client_idx").on(t.clientId),
    // Lot 14.3 soft delete
    deletedAtIdx: index("quotes_deleted_at_idx").on(t.deletedAt),
    // Cron reminder (WHERE status='sent' AND updatedAt < now-7d)
    sentUpdatedIdx: index("quotes_sent_updated_idx")
      .on(t.status, t.updatedAt)
      .where(sql`${t.status} = 'sent'`),
  })
);

export const quotesRelations = relations(quotes, ({ one, many }) => ({
  business: one(businesses, {
    fields: [quotes.businessId],
    references: [businesses.id],
  }),
  client: one(clients, {
    fields: [quotes.clientId],
    references: [clients.id],
  }),
  creator: one(users, {
    fields: [quotes.createdBy],
    references: [users.id],
  }),
  items: many(quoteItems),
  attachments: many(quoteAttachments),
  payments: many(payments),
}));

export const quoteItems = pgTable("quote_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  quoteId: uuid("quote_id")
    .notNull()
    .references(() => quotes.id, { onDelete: "cascade" }),
  description: varchar("description", { length: 500 }).notNull(),
  quantity: integer("quantity").default(1).notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
});

export const quoteItemsRelations = relations(quoteItems, ({ one }) => ({
  quote: one(quotes, {
    fields: [quoteItems.quoteId],
    references: [quotes.id],
  }),
}));

export const quoteAttachments = pgTable("quote_attachments", {
  id: uuid("id").defaultRandom().primaryKey(),
  quoteId: uuid("quote_id")
    .notNull()
    .references(() => quotes.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 20 }).notNull(), // photo, video, document
  url: varchar("url", { length: 500 }).notNull(),
  name: varchar("name", { length: 200 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const quoteAttachmentsRelations = relations(quoteAttachments, ({ one }) => ({
  quote: one(quotes, {
    fields: [quoteAttachments.quoteId],
    references: [quotes.id],
  }),
}));

// ============== PAYMENTS ==============

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    quoteId: uuid("quote_id").references(() => quotes.id, { onDelete: "set null" }),
    stripePaymentId: varchar("stripe_payment_id", { length: 255 }),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("EUR"),
    type: paymentTypeEnum("type").notNull(),
    status: paymentStatusEnum("status").default("pending").notNull(),
    invoiceGenerated: boolean("invoice_generated").default(false),
    invoiceUrl: varchar("invoice_url", { length: 500 }),
    metadata: jsonb("metadata"),
    // Lot 24 : relance impayés — J+7, J+15, J+30 via cron. Évite le spam
    // en checkant l'écart depuis la dernière relance.
    lastReminderAt: timestamp("last_reminder_at"),
    reminderCount: integer("reminder_count").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    // Dashboard revenue par période (SUM(amount) WHERE createdAt >= X)
    businessCreatedIdx: index("payments_business_created_idx").on(t.businessId, t.createdAt),
    statusIdx: index("payments_status_idx").on(t.status),
  })
);

export const paymentsRelations = relations(payments, ({ one }) => ({
  business: one(businesses, {
    fields: [payments.businessId],
    references: [businesses.id],
  }),
  client: one(clients, {
    fields: [payments.clientId],
    references: [clients.id],
  }),
  quote: one(quotes, {
    fields: [payments.quoteId],
    references: [quotes.id],
  }),
}));

// ============== REVIEWS ==============

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    clientName: varchar("client_name", { length: 200 }).notNull(),
    clientEmail: varchar("client_email", { length: 255 }),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    source: varchar("source", { length: 50 }).default("platform"),
    googleReviewId: varchar("google_review_id", { length: 255 }),
    isPublished: boolean("is_published").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    // Avis d'un business par date (dashboard + vitrine)
    businessCreatedIdx: index("reviews_business_created_idx").on(t.businessId, t.createdAt),
  })
);

export const reviewsRelations = relations(reviews, ({ one }) => ({
  business: one(businesses, {
    fields: [reviews.businessId],
    references: [businesses.id],
  }),
}));

// ============== FAQ ==============

export const faqs = pgTable("faqs", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  question: varchar("question", { length: 500 }).notNull(),
  answer: text("answer").notNull(),
  sortOrder: integer("sort_order").default(0),
  isPublished: boolean("is_published").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const faqsRelations = relations(faqs, ({ one }) => ({
  business: one(businesses, {
    fields: [faqs.businessId],
    references: [businesses.id],
  }),
}));

// ============== NOTES ==============

export const notes = pgTable("notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id").references(() => businesses.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
  // Lot 14.8 : cascade user (les notes disparaissent avec le créateur ;
  // c'est cohérent RGPD car ce sont des données personnelles rédigées par lui).
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const notesRelations = relations(notes, ({ one }) => ({
  business: one(businesses, {
    fields: [notes.businessId],
    references: [businesses.id],
  }),
  client: one(clients, {
    fields: [notes.clientId],
    references: [clients.id],
  }),
  creator: one(users, {
    fields: [notes.createdBy],
    references: [users.id],
  }),
}));

// ============== REMINDERS ==============

export const reminders = pgTable("reminders", {
  id: uuid("id").defaultRandom().primaryKey(),
  appointmentId: uuid("appointment_id")
    .notNull()
    .references(() => appointments.id, { onDelete: "cascade" }),
  type: reminderTypeEnum("type").notNull(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  sentAt: timestamp("sent_at"),
  status: varchar("status", { length: 20 }).default("pending"),
  message: text("message"),
});

export const remindersRelations = relations(reminders, ({ one }) => ({
  appointment: one(appointments, {
    fields: [reminders.appointmentId],
    references: [appointments.id],
  }),
}));

// ============== ANALYTICS ==============
// NOTE (Lot 14.6) : ancienne table `analytics` supprimée du schéma
// (jamais lue/écrite dans le code). Les vraies stats de visite sont
// stockées dans `page_visits` (ligne ~187). La table SQL éventuelle
// est laissée en place côté DB (pas de DROP dans 00_apply_safe.sql)
// pour ne perdre aucune donnée historique — un DROP manuel devra être
// fait par un admin si vraiment on veut la retirer.

// ============== SUBSCRIPTIONS ==============

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  plan: subscriptionEnum("plan").default("free").notNull(),
  status: varchar("status", { length: 20 }).default("active"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  business: one(businesses, {
    fields: [subscriptions.businessId],
    references: [businesses.id],
  }),
}));

// ============== CATALOGS ==============

export const catalogs = pgTable("catalogs", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }).notNull(),
  fileUrl: varchar("file_url", { length: 500 }).notNull(),
  fileSize: integer("file_size"),
  downloads: integer("downloads").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const catalogsRelations = relations(catalogs, ({ one }) => ({
  business: one(businesses, {
    fields: [catalogs.businessId],
    references: [businesses.id],
  }),
}));

// ============== CHAT MESSAGES (AI) ==============

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  sessionId: varchar("session_id", { length: 100 }).notNull(),
  role: varchar("role", { length: 20 }).notNull(), // user, assistant, system
  content: text("content").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  business: one(businesses, {
    fields: [chatMessages.businessId],
    references: [businesses.id],
  }),
}));

// ============== PAGE THEMES ==============

export const pageThemes = pgTable("page_themes", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  primaryColor: varchar("primary_color", { length: 20 }).default("#000000"),
  secondaryColor: varchar("secondary_color", { length: 20 }).default("#ffffff"),
  fontFamily: varchar("font_family", { length: 50 }).default("inter"),
  borderRadius: varchar("border_radius", { length: 10 }).default("md"),
  layout: varchar("layout", { length: 20 }).default("modern"),
  showSections: jsonb("show_sections"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const pageThemesRelations = relations(pageThemes, ({ one }) => ({
  business: one(businesses, {
    fields: [pageThemes.businessId],
    references: [businesses.id],
  }),
}));

// ============== BLOG POSTS ==============

export const blogPosts = pgTable(
  "blog_posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 300 }).notNull(),
    slug: varchar("slug", { length: 300 }).notNull(),
    excerpt: text("excerpt"),
    content: text("content").notNull(),
    coverImage: text("cover_image"),
    authorName: varchar("author_name", { length: 200 }),
    isPublished: boolean("is_published").default(false).notNull(),
    publishedAt: timestamp("published_at"),
    views: integer("views").default(0),
    // Lot 14.3 soft delete
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    // Liste publique : articles publiés d'un business, du + récent au + ancien
    businessPublishedIdx: index("blog_business_published_idx").on(
      t.businessId,
      t.isPublished,
      t.publishedAt
    ),
    // Slug unique par business (2 pros peuvent avoir /mon-slug chacun)
    businessSlugIdx: uniqueIndex("blog_business_slug_uidx").on(t.businessId, t.slug),
    // Lot 14.3 soft delete
    deletedAtIdx: index("blog_deleted_at_idx").on(t.deletedAt),
  })
);

export const blogPostsRelations = relations(blogPosts, ({ one }) => ({
  business: one(businesses, {
    fields: [blogPosts.businessId],
    references: [businesses.id],
  }),
}));

// ============== NOTIFICATIONS ==============

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    businessId: uuid("business_id").references(() => businesses.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 50 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    message: text("message").notNull(),
    isRead: boolean("is_read").default(false).notNull(),
    data: jsonb("data"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    // Cloche : bell aggregate = unread par user, plus récent d'abord
    userReadIdx: index("notifications_user_read_idx").on(t.userId, t.isRead, t.createdAt),
  })
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  business: one(businesses, {
    fields: [notifications.businessId],
    references: [businesses.id],
  }),
}));

// ============== PUSH SUBSCRIPTIONS ==============

// F6 (Lot 34) — Préférences de notification par user + type d'event.
//
// Modèle : au lieu de N booléens sur users, on stocke un jsonb libre
// `disabled_types: string[]` (les types désactivés — défaut : tout activé).
// Une entrée par user, upsert au save.
//
// Simple, extensible (ajouter un event → aucun schema change), et rétro-compat
// (un user sans ligne = tout activé, opt-out plutôt qu'opt-in pour ne pas
// perdre les users qui n'ont jamais visité leurs préférences).
export const notificationPreferences = pgTable("notification_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Types d'events désactivés (arrays de string, ex: ["quota.reached", "review.received"]) */
  disabledTypes: jsonb("disabled_types").$type<string[]>().default([]).notNull(),
  /** Canaux désactivés globalement (push, email). in-app toujours OK sauf coupure explicite. */
  disabledChannels: jsonb("disabled_channels").$type<string[]>().default([]).notNull(),
  /** Fenêtre "Do Not Disturb" (2 champs HH:MM). Push suppressed dans ce créneau, digest à la fin. */
  dndStart: varchar("dnd_start", { length: 5 }),
  dndEnd: varchar("dnd_end", { length: 5 }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  endpoint: varchar("endpoint", { length: 500 }).notNull(),
  p256dh: varchar("p256dh", { length: 500 }).notNull(),
  auth: varchar("auth", { length: 200 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [pushSubscriptions.userId],
    references: [users.id],
  }),
}));

// Exceptions de planning (jours fériés, congés)
export const scheduleExceptions = pgTable("schedule_exceptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  date: varchar("date", { length: 10 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(), // holiday, vacation, custom
  isClosed: boolean("is_closed").default(true),
  customStartTime: varchar("custom_start_time", { length: 5 }),
  customEndTime: varchar("custom_end_time", { length: 5 }),
  reason: varchar("reason", { length: 200 }),
});

// Types de services avec durée
export const serviceTypes = pgTable("service_types", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  duration: integer("duration").default(60), // en minutes
  bufferBefore: integer("buffer_before").default(0), // minutes avant
  bufferAfter: integer("buffer_after").default(0), // minutes après
  price: decimal("price", { precision: 10, scale: 2 }),
});

// NOTE (Lot 14.1) : ancien `appointmentStatuses` supprimé (dupliqué avec
// `appointmentStatusEnum` ligne 21). Il n'était référencé nulle part et
// aurait provoqué une collision Postgres (même nom d'enum). Si on veut
// ajouter `in_progress` / `no_show` un jour, faire un ALTER TYPE ... ADD VALUE
// sur `appointment_status` existant, pas créer un doublon.

// ============== EMAIL OPT-OUTS (RGPD) ==============
// Registre des désabonnements par catégorie (marketing, reminders, review-request, all).
// - `email` normalisé lowercase, indexé
// - `category` = la clé sur laquelle l'user s'est désabonné (peut être "all")
// - Aucune donnée personnelle sensible : juste l'email + timestamp
// - Consultable via GET /api/unsubscribe?token=XYZ, ajouté via POST du même endpoint
export const emailOptouts = pgTable(
  "email_optouts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    category: varchar("category", { length: 30 }).notNull(),
    reason: varchar("reason", { length: 500 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    // Anti-doublon (email, catégorie) + lookup rapide "cet email est-il opt-out ?"
    emailCategoryIdx: uniqueIndex("email_optouts_email_category_uidx").on(
      sql`lower(${t.email})`,
      t.category
    ),
  })
);

// ============== AI USAGE (quotas & tracking) ==============
// Une ligne par appel IA (chat, blog, tools, review-reply).
// Sommée sur 30j pour calculer le quota mensuel du user.
export const aiUsage = pgTable(
  "ai_usage",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    route: varchar("route", { length: 80 }).notNull(),
    model: varchar("model", { length: 60 }).notNull(),
    promptTokens: integer("prompt_tokens").default(0).notNull(),
    completionTokens: integer("completion_tokens").default(0).notNull(),
    totalTokens: integer("total_tokens").default(0).notNull(),
    // USD avec 6 décimales — précision suffisante (< 0.000001 $)
    estimatedCostUsd: decimal("estimated_cost_usd", { precision: 10, scale: 6 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    // Index critique : quota check = sum(tokens) WHERE user_id = ? AND createdAt >= 30j
    userCreatedIdx: index("ai_usage_user_created_idx").on(t.userId, t.createdAt),
    // Index pour agrégations admin ("quel modèle coûte le plus ?")
    modelCreatedIdx: index("ai_usage_model_created_idx").on(t.model, t.createdAt),
  })
);

// ============== ADMIN EVENTS (Lot 13 monitoring) ==============
// Journal d'audit des actions admin : ban/unban user, refund, override plan, etc.
// - Traçabilité RGPD (qui a fait quoi sur quel compte, quand)
// - Rejouable en cas d'incident
// - Une seule table pour tous les types d'événements admin (payload jsonb)
// -----------------------------------------------------------------------------
// F3 (Lot 31) — Espace client final (magic-link auth découplée des users pro)
// -----------------------------------------------------------------------------
//
// DESIGN : les clients finaux (visiteurs des vitrines) NE sont PAS dans `users`
// (qui est réservé aux professionnels). Ils vivent dans `clients` (déjà existant
// par businessId). Un client peut avoir plusieurs entrées `clients` s'il est
// client de plusieurs pros — on unifie côté espace client par EMAIL.
//
// Auth : magic-link envoyé par email uniquement. Aucun mot de passe.
// Session : cookie HMAC-signé (comme `vx_session` des pros mais séparé) —
// nom cookie `vx_client_session`.

export const clientAuthTokens = pgTable(
  "client_auth_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Email cible (normalisé lowercase). Pas de FK vers `clients` car un email
    // peut apparaître dans plusieurs businesses — on garde le lien loose.
    email: varchar("email", { length: 255 }).notNull(),
    // Hash SHA-256 du token brut (identique au pattern des auth_tokens pros)
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    ip: varchar("ip", { length: 45 }),
    // Optionnel : business qui a servi de "point d'entrée" (utile pour analytics)
    businessId: uuid("business_id").references(() => businesses.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    // Lookup par hash (consommation)
    hashIdx: uniqueIndex("client_auth_tokens_hash_uidx").on(t.tokenHash),
    // Anti-spam : compter tokens actifs par (email, non expirés, non utilisés)
    emailScanIdx: index("client_auth_tokens_email_scan_idx").on(t.email, t.usedAt, t.expiresAt),
  })
);

export const clientSessions = pgTable(
  "client_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    // Hash du session-id envoyé au cookie (le token brut du cookie n'est jamais stocké)
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    ip: varchar("ip", { length: 45 }),
    userAgent: varchar("user_agent", { length: 500 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
    revokedAt: timestamp("revoked_at"),
  },
  (t) => ({
    hashIdx: uniqueIndex("client_sessions_hash_uidx").on(t.tokenHash),
    emailIdx: index("client_sessions_email_idx").on(t.email),
    // Purge (expirés + révoqués)
    expiryIdx: index("client_sessions_expiry_idx").on(t.expiresAt),
  })
);

// F2 (Lot 30, bonus B27) — Idempotence des webhooks Stripe.
// Stripe retente les webhooks pendant 3 jours sur 5xx / timeout. Certains handlers
// (crédit parrain, upsert paiement) NE SONT PAS strictement idempotents et
// doubleraient l'effet si l'event était rejoué. Cette table garde une trace du
// event_id traité — un INSERT sur clé dupliquée = event déjà vu → skip.
export const stripeWebhookEvents = pgTable(
  "stripe_webhook_events",
  {
    eventId: varchar("event_id", { length: 255 }).primaryKey(),
    type: varchar("type", { length: 60 }).notNull(),
    processedAt: timestamp("processed_at").defaultNow().notNull(),
  },
  (t) => ({
    // Purge périodique par type + date
    typeProcessedIdx: index("stripe_webhook_type_processed_idx").on(t.type, t.processedAt),
  })
);

export const adminEvents = pgTable(
  "admin_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Admin qui a déclenché l'action (nullable si système / cron)
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    // User cible (nullable si l'action ne concerne pas un user précis)
    targetUserId: uuid("target_user_id").references(() => users.id, { onDelete: "set null" }),
    // Type d'action : ban_user, unban_user, override_plan, refund, delete_business, ...
    action: varchar("action", { length: 60 }).notNull(),
    // Détails libres (raison, montant refund, ancien/nouveau plan...)
    payload: jsonb("payload"),
    // IP source pour audit sécurité
    ip: varchar("ip", { length: 45 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    // Filtres classiques admin panel
    actorCreatedIdx: index("admin_events_actor_created_idx").on(t.actorUserId, t.createdAt),
    targetCreatedIdx: index("admin_events_target_created_idx").on(t.targetUserId, t.createdAt),
    actionCreatedIdx: index("admin_events_action_created_idx").on(t.action, t.createdAt),
  })
);

// ============== API KEYS (Lot 16.4 API publique) ==============
// Clés d'authentification pour l'API publique v1. Un user peut en créer plusieurs
// (ex: prod + dev + intégration Zapier), chacune scopée à un business.
//
// SÉCURITÉ :
// - Seul le HASH est stocké (SHA-256) — la clé claire n'est montrée qu'une fois à la création
// - Prefix visible en dur pour identifier une clé dans les logs sans exposer le secret
// - `lastUsedAt` pour révoquer les clés inactives
// - Révocation soft (revokedAt) plutôt que DELETE → audit
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Business auquel la clé donne accès (une clé = un business, isolation stricte)
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    // Nom lisible ("Prod API", "Zapier", "Test dev") — l'user gère
    name: varchar("name", { length: 100 }).notNull(),
    // Prefix visible : "vx_live_xxxx..." → on stocke "vx_live_A3F7" pour affichage
    keyPrefix: varchar("key_prefix", { length: 20 }).notNull(),
    // Hash SHA-256 de la clé complète (jamais la clé claire)
    keyHash: varchar("key_hash", { length: 64 }).notNull(),
    // Portée : "read" (GET only) ou "read_write" (GET + POST/PUT)
    scope: varchar("scope", { length: 20 }).default("read").notNull(),
    lastUsedAt: timestamp("last_used_at"),
    lastUsedIp: varchar("last_used_ip", { length: 45 }),
    // Révocation soft : null = active, non-null = révoquée
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    // Lookup par hash pour l'auth (chaque requête API) — critique pour la perf
    hashIdx: uniqueIndex("api_keys_hash_uidx").on(t.keyHash),
    // Dashboard : "mes clés"
    userCreatedIdx: index("api_keys_user_created_idx").on(t.userId, t.createdAt),
  })
);

// ============== WEBHOOK ENDPOINTS (Lot 16.4 webhooks sortants) ==============
// URLs vers lesquelles Vitrix POST les events business du user (RDV créé,
// paiement reçu, devis signé…). Permet aux pros de brancher Zapier / Make /
// leur propre backend / n8n.
export const webhookEndpoints = pgTable(
  "webhook_endpoints",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    // URL cible : DOIT être en HTTPS (validé côté API create/update)
    url: varchar("url", { length: 500 }).notNull(),
    // Liste des events auxquels ce endpoint s'abonne (ex: ["appointment.created", "payment.received"])
    // Vide → tous les events (pratique pour Zapier)
    events: jsonb("events").$type<string[]>().default([]).notNull(),
    // Secret HMAC pour signer le body → le receveur peut vérifier l'auth
    signingSecret: varchar("signing_secret", { length: 64 }).notNull(),
    // Compteur d'échecs consécutifs. Après 5 → désactivation auto (voir `disabledAt`)
    failureCount: integer("failure_count").default(0).notNull(),
    disabledAt: timestamp("disabled_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    // Dispatcher : "quels endpoints notifier pour ce business ?" (hot path)
    businessIdx: index("webhook_endpoints_business_idx").on(t.businessId),
    userIdx: index("webhook_endpoints_user_idx").on(t.userId),
  })
);

// ============== WEBHOOK DELIVERIES (audit + retry) ==============
// Une ligne par tentative d'envoi. Sert à :
//  - Debug côté user ("mon webhook ne reçoit rien")
//  - Retry (cron qui reprend les échoués récents)
//  - Compter les échecs consécutifs (disable auto)
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    endpointId: uuid("endpoint_id")
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: "cascade" }),
    event: varchar("event", { length: 60 }).notNull(),
    // Body envoyé (JSON stringifié, tronqué à ~10KB si énorme)
    payload: jsonb("payload"),
    // Réponse HTTP : status + body tronqué à 500 chars pour debug
    responseStatus: integer("response_status"),
    responseBody: varchar("response_body", { length: 500 }),
    // null = pas encore envoyé (queue), false = échoué, true = succès (2xx)
    success: boolean("success"),
    attemptCount: integer("attempt_count").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    deliveredAt: timestamp("delivered_at"),
  },
  (t) => ({
    // Dashboard user : "historique livraisons de mon endpoint"
    endpointCreatedIdx: index("webhook_deliveries_endpoint_created_idx").on(
      t.endpointId,
      t.createdAt
    ),
    // Cron retry : SELECT ... WHERE success = false AND attempt_count < 5
    retryIdx: index("webhook_deliveries_retry_idx").on(t.success, t.attemptCount),
  })
);

// ============== AUTH TOKENS (Lot 19) ==============
// Tokens à usage unique pour :
//  - password_reset : lien envoyé par email pour réinitialiser le mdp
//  - email_verify   : double opt-in confirmation d'inscription
//  - magic_link     : (futur) connexion sans mot de passe
//
// SÉCURITÉ :
//  - Seul le HASH SHA-256 est stocké (le token clair transite dans l'URL de l'email
//    puis est jeté). Si la DB fuite, les tokens ne sont pas réutilisables.
//  - Single-use : `used_at` est renseigné à la 1ère consommation → rejet des replays.
//  - TTL court (1h reset, 24h verify) via `expires_at`.
//  - IP stockée pour audit / détection abus.
export const authTokenTypeEnum = pgEnum("auth_token_type", [
  "password_reset",
  "email_verify",
  "magic_link",
]);

export const authTokens = pgTable(
  "auth_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: authTokenTypeEnum("type").notNull(),
    // Hash SHA-256 hex du token (64 chars). Le token clair n'est jamais stocké.
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    // Non-null = déjà consommé (single-use)
    usedAt: timestamp("used_at"),
    // IP de génération (audit) + IP de consommation stockée en meta jsonb
    ip: varchar("ip", { length: 45 }),
    meta: jsonb("meta"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    // Lookup par hash à la consommation (hot path) — critique pour perf + sécurité
    hashIdx: uniqueIndex("auth_tokens_hash_uidx").on(t.tokenHash),
    // Cron nettoyage des expirés
    expiresIdx: index("auth_tokens_expires_idx").on(t.expiresAt),
    // Anti-spam : "combien de tokens actifs pour ce user + type ?"
    userTypeIdx: index("auth_tokens_user_type_idx").on(t.userId, t.type, t.createdAt),
  })
);

// ============== SESSIONS (Lot 19 multi-device) ==============
// Registre des sessions actives d'un user pour "Mes sessions" + "Déconnecter partout".
// Complémentaire au cookie signé HMAC de session.ts : le cookie prouve l'auth,
// la table permet de RÉVOQUER une session sans changer le secret global.
//
// Vérification côté getCurrentUser : après avoir décodé le cookie, on check
// que la session existe et n'a pas été révoquée. Si absente → cookie ignoré.
export const sessions = pgTable(
  "sessions",
  {
    // ID de session = fingerprint stocké dans le cookie (à côté du userId).
    // On stocke le HASH pour même raison que auth_tokens (fuite DB non-exploitable).
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Hash SHA-256 du session token → lookup rapide, safe si DB fuite
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    // Métadonnées visibles côté user (dashboard "mes sessions")
    userAgent: varchar("user_agent", { length: 500 }),
    ip: varchar("ip", { length: 45 }),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
    // Non-null = révoquée (soft), la session ne peut plus authentifier
    revokedAt: timestamp("revoked_at"),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    hashIdx: uniqueIndex("sessions_hash_uidx").on(t.tokenHash),
    userCreatedIdx: index("sessions_user_created_idx").on(t.userId, t.createdAt),
    expiresIdx: index("sessions_expires_idx").on(t.expiresAt),
  })
);
