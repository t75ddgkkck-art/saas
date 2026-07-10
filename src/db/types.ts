/**
 * Types "select" et "insert" dérivés du schéma Drizzle.
 *
 * ⚠️  Source de vérité UNIQUE — évite la duplication qu'on voit dans
 * PublicPage.tsx et cie où chaque page redéfinit ses propres types.
 *
 * Usage :
 *   import type { Business, BusinessInsert, User, ... } from "@/db/types";
 */
import type {
  users,
  businesses,
  clients,
  quotes,
  quoteItems,
  quoteAttachments,
  appointments,
  services,
  workingHours,
  availabilitySlots,
  faqs,
  reviews,
  reviewRequests,
  payments,
  notifications,
  blogPosts,
  loyaltyPoints,
  loyaltyTransactions,
  teamMembers,
  pageVisits,
  pushSubscriptions,
  scheduleExceptions,
  socialLinks,
  galleryItems,
  chatMessages,
} from "./schema";

// Select (lecture)
export type User = typeof users.$inferSelect;
export type Business = typeof businesses.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Quote = typeof quotes.$inferSelect;
export type QuoteItem = typeof quoteItems.$inferSelect;
export type QuoteAttachment = typeof quoteAttachments.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type Service = typeof services.$inferSelect;
export type WorkingHour = typeof workingHours.$inferSelect;
export type AvailabilitySlot = typeof availabilitySlots.$inferSelect;
export type Faq = typeof faqs.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type ReviewRequest = typeof reviewRequests.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type BlogPost = typeof blogPosts.$inferSelect;
export type LoyaltyPoint = typeof loyaltyPoints.$inferSelect;
export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type TeamMember = typeof teamMembers.$inferSelect;
export type PageVisit = typeof pageVisits.$inferSelect;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type ScheduleException = typeof scheduleExceptions.$inferSelect;
export type SocialLink = typeof socialLinks.$inferSelect;
export type GalleryItem = typeof galleryItems.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;

// Insert (écriture)
export type UserInsert = typeof users.$inferInsert;
export type BusinessInsert = typeof businesses.$inferInsert;
export type ClientInsert = typeof clients.$inferInsert;
export type QuoteInsert = typeof quotes.$inferInsert;
export type AppointmentInsert = typeof appointments.$inferInsert;
export type ServiceInsert = typeof services.$inferInsert;

// Alias sémantiques pour l'UI côté client (dérivés simples, sans PHI)
export type PublicUser = Pick<
  User,
  "id" | "email" | "firstName" | "lastName" | "role" | "subscription"
>;

export type SubscriptionPlan = User["subscription"];
