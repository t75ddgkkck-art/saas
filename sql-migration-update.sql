-- ============================================================
-- VITRIX — MIGRATION DE MISE À JOUR
-- À exécuter dans Supabase → SQL Editor → Run
-- Corrige l'erreur de connexion (colonnes manquantes)
-- Sans risque : n'efface AUCUNE donnée (IF NOT EXISTS partout)
-- ============================================================

-- 1. USERS : colonnes Stripe (cause de ton erreur de connexion)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_customer_id" varchar(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_subscription_id" varchar(255);

-- 2. BUSINESSES : personnalisation vitrine
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "primary_color" varchar(20) DEFAULT '#0f172a';
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "hide_branding" boolean DEFAULT false;
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "language" varchar(5) DEFAULT 'fr';

-- 3. BUSINESSES : paiements
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "enable_stripe" boolean DEFAULT false;
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "stripe_account_id" varchar(255);
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "accept_cash" boolean DEFAULT true;
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "accept_apple_pay" boolean DEFAULT false;

-- 4. BUSINESSES : programme de fidélité
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "loyalty_enabled" boolean DEFAULT false;
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "loyalty_points_per_euro" integer DEFAULT 1;
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "loyalty_reward" text;

-- 5. TABLE : points de fidélité par client
CREATE TABLE IF NOT EXISTS "loyalty_points" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL,
  "client_id" uuid NOT NULL,
  "points" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "loyalty_points_business_id_fk" FOREIGN KEY ("business_id")
    REFERENCES "public"."businesses"("id") ON DELETE cascade,
  CONSTRAINT "loyalty_points_client_id_fk" FOREIGN KEY ("client_id")
    REFERENCES "public"."clients"("id") ON DELETE cascade
);

-- 6. TABLE : historique des points (gains/utilisations)
CREATE TABLE IF NOT EXISTS "loyalty_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL,
  "client_id" uuid NOT NULL,
  "points" integer NOT NULL,
  "reason" varchar(200),
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "loyalty_tx_business_id_fk" FOREIGN KEY ("business_id")
    REFERENCES "public"."businesses"("id") ON DELETE cascade,
  CONSTRAINT "loyalty_tx_client_id_fk" FOREIGN KEY ("client_id")
    REFERENCES "public"."clients"("id") ON DELETE cascade
);

-- 7. TABLE : visites réelles des vitrines (statistiques)
CREATE TABLE IF NOT EXISTS "page_visits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL,
  "date" varchar(10) NOT NULL,
  "source" varchar(100) DEFAULT 'direct',
  "device" varchar(20) DEFAULT 'desktop',
  "path" varchar(200),
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "page_visits_business_id_fk" FOREIGN KEY ("business_id")
    REFERENCES "public"."businesses"("id") ON DELETE cascade
);

-- 8. TABLE : notifications internes (cloche dashboard) — si manquante
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
  CONSTRAINT "notifications_user_id_fk" FOREIGN KEY ("user_id")
    REFERENCES "public"."users"("id") ON DELETE cascade,
  CONSTRAINT "notifications_business_id_fk" FOREIGN KEY ("business_id")
    REFERENCES "public"."businesses"("id") ON DELETE cascade
);

-- 9. TABLE : abonnements push PWA — si manquante
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "endpoint" varchar(500) NOT NULL,
  "p256dh" varchar(500) NOT NULL,
  "auth" varchar(200) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "push_subscriptions_user_id_fk" FOREIGN KEY ("user_id")
    REFERENCES "public"."users"("id") ON DELETE cascade
);

-- 10. TABLE : articles de blog — si manquante
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
  CONSTRAINT "blog_posts_business_id_fk" FOREIGN KEY ("business_id")
    REFERENCES "public"."businesses"("id") ON DELETE cascade
);

-- 11. Index de performance
CREATE INDEX IF NOT EXISTS "idx_loyalty_points_client" ON "loyalty_points" ("business_id", "client_id");
CREATE INDEX IF NOT EXISTS "idx_loyalty_tx_client" ON "loyalty_transactions" ("business_id", "client_id");
CREATE INDEX IF NOT EXISTS "idx_page_visits_biz_date" ON "page_visits" ("business_id", "date");
CREATE INDEX IF NOT EXISTS "idx_notifications_user" ON "notifications" ("user_id", "is_read");

-- ============================================================
-- VÉRIFICATION : doit lister les colonnes users sans erreur
-- ============================================================
SELECT column_name FROM information_schema.columns
WHERE table_name = 'users' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 12. Templates de vitrine + affichage QR (mise à jour)
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "template" varchar(30) DEFAULT 'classique';
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "show_qr_on_page" boolean DEFAULT true;

-- 13. Outils Premium (mise à jour)
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "custom_domain" varchar(255);
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "public_chat_enabled" boolean DEFAULT false;
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "auto_review_request" boolean DEFAULT false;

-- 14. Membres d'équipe (Premium)
CREATE TABLE IF NOT EXISTS "team_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL,
  "email" varchar(255) NOT NULL,
  "first_name" varchar(100) NOT NULL,
  "last_name" varchar(100),
  "member_role" varchar(30) DEFAULT 'assistant' NOT NULL,
  "invited_at" timestamp DEFAULT now() NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  CONSTRAINT "team_members_business_id_fk" FOREIGN KEY ("business_id")
    REFERENCES "public"."businesses"("id") ON DELETE cascade
);

-- 15. Demandes d'avis post-RDV
CREATE TABLE IF NOT EXISTS "review_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL,
  "client_id" uuid NOT NULL,
  "appointment_id" uuid,
  "sent_at" timestamp DEFAULT now() NOT NULL,
  "channel" varchar(20) DEFAULT 'email',
  CONSTRAINT "review_requests_business_id_fk" FOREIGN KEY ("business_id")
    REFERENCES "public"."businesses"("id") ON DELETE cascade,
  CONSTRAINT "review_requests_client_id_fk" FOREIGN KEY ("client_id")
    REFERENCES "public"."clients"("id") ON DELETE cascade
);
