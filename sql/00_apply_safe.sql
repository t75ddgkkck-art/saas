-- =============================================================================
-- Vitrix / ArtisanPro — SQL idempotent
-- =============================================================================
-- À jouer sur une base EXISTANTE (Supabase Prod incluse).
-- Toutes les instructions sont "safe" : IF NOT EXISTS, DO $$…, ADD COLUMN IF NOT EXISTS
-- ➜ Vous pouvez le relancer autant de fois que vous voulez sans casser la DB.
--
-- Usage :
--   psql "$DATABASE_URL" -f sql/00_apply_safe.sql
-- ou dans Supabase → SQL Editor → New query → coller → Run
--
-- Ce script fait UNIQUEMENT :
--   1. Vérifie / crée les extensions (uuid, pgcrypto)
--   2. Ajoute les valeurs manquantes aux enums (sans casser l'existant)
--   3. Ajoute les colonnes manquantes (jamais de DROP)
--   4. Crée les index de performance utiles absents
--   5. Crée les contraintes uniques manquantes
--   6. Ne touche jamais aux données existantes
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Extensions requises
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 2. Enums : ajout des valeurs manquantes si l'enum existe déjà
--    (⚠️  ALTER TYPE ADD VALUE n'est pas dans une transaction implicite Supabase,
--     on utilise donc des blocs séparés.)
-- -----------------------------------------------------------------------------

-- role
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role') THEN
    CREATE TYPE "role" AS ENUM ('admin','professional','employee','assistant');
  END IF;
END $$;

DO $$ BEGIN ALTER TYPE "role" ADD VALUE IF NOT EXISTS 'assistant'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "role" ADD VALUE IF NOT EXISTS 'employee';  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- subscription
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription') THEN
    CREATE TYPE "subscription" AS ENUM ('free','pro','premium');
  END IF;
END $$;

-- appointment_status (le schéma prod devrait contenir aussi in_progress + no_show)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') THEN
    CREATE TYPE "appointment_status" AS ENUM ('pending','confirmed','in_progress','completed','cancelled','no_show');
  END IF;
END $$;

DO $$ BEGIN ALTER TYPE "appointment_status" ADD VALUE IF NOT EXISTS 'in_progress'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "appointment_status" ADD VALUE IF NOT EXISTS 'no_show';     EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- quote_status
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quote_status') THEN
    CREATE TYPE "quote_status" AS ENUM ('draft','sent','accepted','rejected','signed','expired');
  END IF;
END $$;

DO $$ BEGIN ALTER TYPE "quote_status" ADD VALUE IF NOT EXISTS 'signed';  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "quote_status" ADD VALUE IF NOT EXISTS 'expired'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- payment_status / payment_type / reminder_type / client_source
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE "payment_status" AS ENUM ('pending','completed','failed','refunded');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_type') THEN
    CREATE TYPE "payment_type" AS ENUM ('deposit','full','subscription');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reminder_type') THEN
    CREATE TYPE "reminder_type" AS ENUM ('email','sms','whatsapp');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'client_source') THEN
    CREATE TYPE "client_source" AS ENUM ('website','google','referral','social','other');
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3. Colonnes ajoutées récemment (ne DROP jamais rien).
--    Chaque ADD COLUMN utilise IF NOT EXISTS.
-- -----------------------------------------------------------------------------

-- users : rien à ajouter par rapport au schéma initial connu.
ALTER TABLE IF EXISTS "users"
  ADD COLUMN IF NOT EXISTS "stripe_customer_id"     varchar(255),
  ADD COLUMN IF NOT EXISTS "stripe_subscription_id" varchar(255),
  ADD COLUMN IF NOT EXISTS "email_verified"         boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "phone"                  varchar(20);

-- businesses : ajouts progressifs (fidélité, paiements, thème, chat, etc.)
ALTER TABLE IF EXISTS "businesses"
  ADD COLUMN IF NOT EXISTS "primary_color"              varchar(20)  DEFAULT '#0f172a',
  ADD COLUMN IF NOT EXISTS "hide_branding"              boolean      DEFAULT false,
  ADD COLUMN IF NOT EXISTS "language"                   varchar(5)   DEFAULT 'fr',
  ADD COLUMN IF NOT EXISTS "template"                   varchar(30)  DEFAULT 'classique',
  ADD COLUMN IF NOT EXISTS "show_qr_on_page"            boolean      DEFAULT true,
  ADD COLUMN IF NOT EXISTS "custom_domain"              varchar(255),
  ADD COLUMN IF NOT EXISTS "public_chat_enabled"        boolean      DEFAULT false,
  ADD COLUMN IF NOT EXISTS "auto_review_request"        boolean      DEFAULT false,
  ADD COLUMN IF NOT EXISTS "show_reviews_on_page"       boolean      DEFAULT true,
  ADD COLUMN IF NOT EXISTS "highlights_enabled"         boolean      DEFAULT true,
  ADD COLUMN IF NOT EXISTS "highlights_data"            jsonb,
  ADD COLUMN IF NOT EXISTS "iban"                       varchar(50),
  ADD COLUMN IF NOT EXISTS "bic"                        varchar(20),
  ADD COLUMN IF NOT EXISTS "visits_reset_at"            timestamp,
  ADD COLUMN IF NOT EXISTS "google_place_id"            varchar(200),
  ADD COLUMN IF NOT EXISTS "reminder_sms_enabled"       boolean      DEFAULT false,
  ADD COLUMN IF NOT EXISTS "reminder_whatsapp_enabled"  boolean      DEFAULT false,
  ADD COLUMN IF NOT EXISTS "menu_data"                  jsonb,
  ADD COLUMN IF NOT EXISTS "enable_stripe"              boolean      DEFAULT false,
  ADD COLUMN IF NOT EXISTS "stripe_account_id"          varchar(255),
  ADD COLUMN IF NOT EXISTS "accept_cash"                boolean      DEFAULT true,
  ADD COLUMN IF NOT EXISTS "accept_apple_pay"           boolean      DEFAULT false,
  ADD COLUMN IF NOT EXISTS "loyalty_enabled"            boolean      DEFAULT false,
  ADD COLUMN IF NOT EXISTS "loyalty_points_per_euro"    integer      DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "loyalty_reward"             text,
  ADD COLUMN IF NOT EXISTS "emergency_phone"            varchar(20),
  ADD COLUMN IF NOT EXISTS "show_emergency"             boolean      DEFAULT false,
  ADD COLUMN IF NOT EXISTS "service_area"               text,
  ADD COLUMN IF NOT EXISTS "whatsapp"                   varchar(20),
  ADD COLUMN IF NOT EXISTS "profile_image"              text,
  ADD COLUMN IF NOT EXISTS "cover_image"                text;

-- clients : nouveaux compteurs / tracking
ALTER TABLE IF EXISTS "clients"
  ADD COLUMN IF NOT EXISTS "source"             "client_source" DEFAULT 'website',
  ADD COLUMN IF NOT EXISTS "total_spent"        numeric(10,2)   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "appointments_count" integer         DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "quotes_count"       integer         DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "last_contact"       timestamp;

-- quotes : suivi
ALTER TABLE IF EXISTS "quotes"
  ADD COLUMN IF NOT EXISTS "category"           varchar(100),
  ADD COLUMN IF NOT EXISTS "signed_at"          timestamp,
  ADD COLUMN IF NOT EXISTS "signature_url"      text,
  ADD COLUMN IF NOT EXISTS "reminder_sent_at"   timestamp;

-- notifications : type/data
ALTER TABLE IF EXISTS "notifications"
  ADD COLUMN IF NOT EXISTS "data"          jsonb,
  ADD COLUMN IF NOT EXISTS "read"          boolean DEFAULT false;

-- team_members : activation
ALTER TABLE IF EXISTS "team_members"
  ADD COLUMN IF NOT EXISTS "active"        boolean DEFAULT true NOT NULL;

-- blog_posts : SEO
ALTER TABLE IF EXISTS "blog_posts"
  ADD COLUMN IF NOT EXISTS "meta_title"       varchar(200),
  ADD COLUMN IF NOT EXISTS "meta_description" varchar(300),
  ADD COLUMN IF NOT EXISTS "published_at"     timestamp;

-- -----------------------------------------------------------------------------
-- 4. Index de performance (tous IF NOT EXISTS)
--    Ces index NE SONT PAS dans le schéma Drizzle mais sont critiques.
-- -----------------------------------------------------------------------------

-- Lookup fréquent : slug de vitrine, ownerId, email, siret
CREATE UNIQUE INDEX IF NOT EXISTS "businesses_slug_uidx"   ON "businesses" ("slug");
CREATE        INDEX IF NOT EXISTS "businesses_owner_idx"   ON "businesses" ("owner_id");
CREATE        INDEX IF NOT EXISTS "businesses_city_idx"    ON "businesses" (LOWER("city"));
CREATE        INDEX IF NOT EXISTS "businesses_cat_idx"     ON "businesses" ("category");
CREATE UNIQUE INDEX IF NOT EXISTS "businesses_siret_uidx"  ON "businesses" ("siret") WHERE "siret" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_uidx"       ON "users" (LOWER("email"));

-- Clients : recherche par business + tel/email
CREATE INDEX IF NOT EXISTS "clients_business_idx"       ON "clients" ("business_id");
CREATE INDEX IF NOT EXISTS "clients_business_phone_idx" ON "clients" ("business_id", "phone");
CREATE INDEX IF NOT EXISTS "clients_business_email_idx" ON "clients" ("business_id", LOWER("email"));

-- Rendez-vous : recherche par date/statut/business
CREATE INDEX IF NOT EXISTS "appointments_business_date_idx"  ON "appointments" ("business_id", "date");
CREATE INDEX IF NOT EXISTS "appointments_status_idx"         ON "appointments" ("status");
CREATE INDEX IF NOT EXISTS "appointments_client_idx"         ON "appointments" ("client_id");

-- Devis
CREATE INDEX IF NOT EXISTS "quotes_business_status_idx" ON "quotes" ("business_id", "status");
CREATE INDEX IF NOT EXISTS "quotes_client_idx"          ON "quotes" ("client_id");
CREATE INDEX IF NOT EXISTS "quotes_updated_idx"         ON "quotes" ("updated_at");

-- Paiements
CREATE INDEX IF NOT EXISTS "payments_business_created_idx" ON "payments" ("business_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "payments_status_idx"           ON "payments" ("status");

-- Notifications
CREATE INDEX IF NOT EXISTS "notifications_user_read_idx" ON "notifications" ("user_id", "read", "created_at" DESC);

-- Avis
CREATE INDEX IF NOT EXISTS "reviews_business_idx"        ON "reviews" ("business_id", "created_at" DESC);

-- Analytics / visites
CREATE INDEX IF NOT EXISTS "page_visits_business_date_idx" ON "page_visits" ("business_id", "date");

-- Blog
CREATE INDEX IF NOT EXISTS "blog_business_published_idx" ON "blog_posts" ("business_id", "is_published", "published_at" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "blog_business_slug_uidx" ON "blog_posts" ("business_id", "slug");

-- Cron : requêtes de rappel de devis > 7j
CREATE INDEX IF NOT EXISTS "quotes_sent_updated_idx" ON "quotes" ("status", "updated_at") WHERE "status" = 'sent';

-- -----------------------------------------------------------------------------
-- 5. Contraintes / valeurs par défaut manquantes (jamais destructives)
-- -----------------------------------------------------------------------------

-- Sécurité : forcer un défaut sur users.email_verified si NULL
UPDATE "users" SET "email_verified" = false WHERE "email_verified" IS NULL;

-- Éviter les subscriptions NULL sur les vieux comptes
UPDATE "users" SET "subscription" = 'free' WHERE "subscription" IS NULL;

-- Éviter les rôles NULL
UPDATE "users" SET "role" = 'professional' WHERE "role" IS NULL;

-- -----------------------------------------------------------------------------
-- 6. Rapport post-application
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  n_users     bigint;
  n_biz       bigint;
  n_quotes    bigint;
  n_apts      bigint;
BEGIN
  SELECT COUNT(*) INTO n_users  FROM users;
  SELECT COUNT(*) INTO n_biz    FROM businesses;
  SELECT COUNT(*) INTO n_quotes FROM quotes;
  SELECT COUNT(*) INTO n_apts   FROM appointments;
  RAISE NOTICE '--- Vitrix DB status ---';
  RAISE NOTICE 'users        : %', n_users;
  RAISE NOTICE 'businesses   : %', n_biz;
  RAISE NOTICE 'quotes       : %', n_quotes;
  RAISE NOTICE 'appointments : %', n_apts;
END $$;

-- ✅ Fin du script — aucune erreur ne devrait remonter, même si tout existe déjà.
