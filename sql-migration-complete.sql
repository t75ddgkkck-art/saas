-- ============================================================
-- VITRIX — MIGRATION COMPLÈTE (sans erreur)
-- À exécuter dans Supabase → SQL Editor → Run
-- Tout est en IF NOT EXISTS, aucune donnée supprimée
-- ============================================================

-- 1. Colonnes manquantes sur users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_customer_id" varchar(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_subscription_id" varchar(255);

-- 2. Colonnes manquantes sur businesses
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "primary_color" varchar(20) DEFAULT '#0f172a';
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "hide_branding" boolean DEFAULT false;
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "language" varchar(5) DEFAULT 'fr';
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "enable_stripe" boolean DEFAULT false;
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "stripe_account_id" varchar(255);
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "accept_cash" boolean DEFAULT true;
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "accept_apple_pay" boolean DEFAULT false;
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "loyalty_enabled" boolean DEFAULT false;
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "loyalty_points_per_euro" integer DEFAULT 1;
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "loyalty_reward" text;
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "template" varchar(30) DEFAULT 'classique';
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "show_qr_on_page" boolean DEFAULT true;
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "custom_domain" varchar(255);
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "public_chat_enabled" boolean DEFAULT false;
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "auto_review_request" boolean DEFAULT false;
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "iban" varchar(50);
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "bic" varchar(20);
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "visits_reset_at" timestamp;
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "google_place_id" varchar(200);
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "reminder_sms_enabled" boolean DEFAULT false;
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "reminder_whatsapp_enabled" boolean DEFAULT false;
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "menu_data" jsonb;

-- 3. Table loyalty_points
CREATE TABLE IF NOT EXISTS "loyalty_points" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL,
  "client_id" uuid NOT NULL,
  "points" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "loyalty_points_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade,
  CONSTRAINT "loyalty_points_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade
);

-- 4. Table loyalty_transactions
CREATE TABLE IF NOT EXISTS "loyalty_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL,
  "client_id" uuid NOT NULL,
  "points" integer NOT NULL,
  "reason" varchar(200),
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "loyalty_tx_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade,
  CONSTRAINT "loyalty_tx_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade
);

-- 5. Table page_visits
CREATE TABLE IF NOT EXISTS "page_visits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL,
  "date" varchar(10) NOT NULL,
  "source" varchar(100) DEFAULT 'direct',
  "device" varchar(20) DEFAULT 'desktop',
  "path" varchar(200),
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "page_visits_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade
);

-- 6. Table notifications
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "business_id" uuid,
  "type" varchar(50) NOT NULL,
  "title" varchar(200) NOT NULL,
  "message" text NOT NULL,
  "is_read" boolean DEFAULT false NOT NULL,
  "data" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "notifications_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade,
  CONSTRAINT "notifications_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade
);

-- 7. Table push_subscriptions
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "endpoint" varchar(500) NOT NULL,
  "p256dh" varchar(500) NOT NULL,
  "auth" varchar(200) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "push_subscriptions_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade
);

-- 8. Table blog_posts
CREATE TABLE IF NOT EXISTS "blog_posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL,
  "title" varchar(300) NOT NULL,
  "slug" varchar(300) NOT NULL,
  "excerpt" text,
  "content" text NOT NULL,
  "cover_image" text,
  "author_name" varchar(200),
  "is_published" boolean DEFAULT false NOT NULL,
  "published_at" timestamp,
  "views" integer DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "blog_posts_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade
);

-- 9. Table team_members
CREATE TABLE IF NOT EXISTS "team_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL,
  "email" varchar(255) NOT NULL,
  "first_name" varchar(100) NOT NULL,
  "last_name" varchar(100),
  "member_role" varchar(30) DEFAULT 'assistant' NOT NULL,
  "invited_at" timestamp DEFAULT now() NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  CONSTRAINT "team_members_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade
);

-- 10. Table review_requests
CREATE TABLE IF NOT EXISTS "review_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL,
  "client_id" uuid NOT NULL,
  "appointment_id" uuid,
  "sent_at" timestamp DEFAULT now() NOT NULL,
  "channel" varchar(20) DEFAULT 'email',
  CONSTRAINT "review_requests_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade,
  CONSTRAINT "review_requests_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade
);

-- 11. Table quote_form_fields
CREATE TABLE IF NOT EXISTS "quote_form_fields" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL,
  "label" varchar(200) NOT NULL,
  "type" varchar(20) DEFAULT 'text' NOT NULL,
  "options" text,
  "required" boolean DEFAULT false NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "quote_form_fields_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade
);

-- 12. Table services
CREATE TABLE IF NOT EXISTS "services" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL,
  "name" varchar(200) NOT NULL,
  "description" text,
  "price" varchar(50),
  "sort_order" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "services_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade
);

-- 13. Index de performance
CREATE INDEX IF NOT EXISTS "idx_loyalty_points_client" ON "loyalty_points" ("business_id", "client_id");
CREATE INDEX IF NOT EXISTS "idx_loyalty_tx_client" ON "loyalty_transactions" ("business_id", "client_id");
CREATE INDEX IF NOT EXISTS "idx_page_visits_biz_date" ON "page_visits" ("business_id", "date");
CREATE INDEX IF NOT EXISTS "idx_notifications_user" ON "notifications" ("user_id", "is_read");
CREATE INDEX IF NOT EXISTS "idx_services_biz" ON "services" ("business_id", "sort_order");

-- Vérification
SELECT 'Migration terminée avec succès ! ' || count(*) || ' tables vérifiées.' as status
FROM information_schema.tables WHERE table_schema = 'public';

-- 14. Contrôle des avis + avantages personnalisés
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "show_reviews_on_page" boolean DEFAULT true;
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "highlights_enabled" boolean DEFAULT true;
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "highlights_data" jsonb;
