-- =============================================================================
-- Vitrix / ArtisanPro — SQL idempotent v2
-- =============================================================================
-- Version ultra-safe :
--   • Chaque bloc vérifie l'existence de la table AVANT toute modification
--   • Aucun bloc ne fait crash le script si une table n'existe pas
--   • Tout est dans du SQL dynamique (EXECUTE format(...)) pour éviter
--     les résolutions d'identifiants au parse-time
--   • Idempotent : rejouable N fois sans effet secondaire
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Extensions requises
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 2. Enums : création si absent + ajout des valeurs manquantes
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role') THEN
    CREATE TYPE public.role AS ENUM ('admin','professional','employee','assistant');
  END IF;
END $$;
DO $$ BEGIN ALTER TYPE public.role ADD VALUE IF NOT EXISTS 'assistant'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.role ADD VALUE IF NOT EXISTS 'employee';  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription') THEN
    CREATE TYPE public.subscription AS ENUM ('free','pro','premium');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') THEN
    CREATE TYPE public.appointment_status AS ENUM ('pending','confirmed','in_progress','completed','cancelled','no_show');
  END IF;
END $$;
DO $$ BEGIN ALTER TYPE public.appointment_status ADD VALUE IF NOT EXISTS 'in_progress'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.appointment_status ADD VALUE IF NOT EXISTS 'no_show';     EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quote_status') THEN
    CREATE TYPE public.quote_status AS ENUM ('draft','sent','accepted','rejected','signed','expired');
  END IF;
END $$;
DO $$ BEGIN ALTER TYPE public.quote_status ADD VALUE IF NOT EXISTS 'signed';  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.quote_status ADD VALUE IF NOT EXISTS 'expired'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE public.payment_status AS ENUM ('pending','completed','failed','refunded');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_type') THEN
    CREATE TYPE public.payment_type AS ENUM ('deposit','full','subscription');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reminder_type') THEN
    CREATE TYPE public.reminder_type AS ENUM ('email','sms','whatsapp');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'client_source') THEN
    CREATE TYPE public.client_source AS ENUM ('website','google','referral','social','other');
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Helper : test d'existence de table (évite de dupliquer l'IF EXISTS partout)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.__vx_table_exists(_tbl text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = _tbl
  );
$$;

-- -----------------------------------------------------------------------------
-- 3. Colonnes ajoutées récemment (safe : table par table, dynamique)
-- -----------------------------------------------------------------------------

-- users
DO $$ BEGIN
  IF public.__vx_table_exists('users') THEN
    ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS stripe_customer_id     varchar(255),
      ADD COLUMN IF NOT EXISTS stripe_subscription_id varchar(255),
      ADD COLUMN IF NOT EXISTS email_verified         boolean DEFAULT false NOT NULL,
      ADD COLUMN IF NOT EXISTS phone                  varchar(20);
  END IF;
END $$;

-- businesses
DO $$ BEGIN
  IF public.__vx_table_exists('businesses') THEN
    ALTER TABLE public.businesses
      ADD COLUMN IF NOT EXISTS primary_color             varchar(20)  DEFAULT '#0f172a',
      ADD COLUMN IF NOT EXISTS hide_branding             boolean      DEFAULT false,
      ADD COLUMN IF NOT EXISTS language                  varchar(5)   DEFAULT 'fr',
      ADD COLUMN IF NOT EXISTS template                  varchar(30)  DEFAULT 'classique',
      ADD COLUMN IF NOT EXISTS show_qr_on_page           boolean      DEFAULT true,
      ADD COLUMN IF NOT EXISTS custom_domain             varchar(255),
      ADD COLUMN IF NOT EXISTS public_chat_enabled       boolean      DEFAULT false,
      ADD COLUMN IF NOT EXISTS auto_review_request       boolean      DEFAULT false,
      ADD COLUMN IF NOT EXISTS show_reviews_on_page      boolean      DEFAULT true,
      ADD COLUMN IF NOT EXISTS highlights_enabled        boolean      DEFAULT true,
      ADD COLUMN IF NOT EXISTS highlights_data           jsonb,
      ADD COLUMN IF NOT EXISTS iban                      varchar(50),
      ADD COLUMN IF NOT EXISTS bic                       varchar(20),
      ADD COLUMN IF NOT EXISTS visits_reset_at           timestamp,
      ADD COLUMN IF NOT EXISTS google_place_id           varchar(200),
      ADD COLUMN IF NOT EXISTS reminder_sms_enabled      boolean      DEFAULT false,
      ADD COLUMN IF NOT EXISTS reminder_whatsapp_enabled boolean      DEFAULT false,
      ADD COLUMN IF NOT EXISTS menu_data                 jsonb,
      ADD COLUMN IF NOT EXISTS enable_stripe             boolean      DEFAULT false,
      ADD COLUMN IF NOT EXISTS stripe_account_id         varchar(255),
      ADD COLUMN IF NOT EXISTS accept_cash               boolean      DEFAULT true,
      ADD COLUMN IF NOT EXISTS accept_apple_pay          boolean      DEFAULT false,
      ADD COLUMN IF NOT EXISTS loyalty_enabled           boolean      DEFAULT false,
      ADD COLUMN IF NOT EXISTS loyalty_points_per_euro   integer      DEFAULT 1,
      ADD COLUMN IF NOT EXISTS loyalty_reward            text,
      ADD COLUMN IF NOT EXISTS emergency_phone           varchar(20),
      ADD COLUMN IF NOT EXISTS show_emergency            boolean      DEFAULT false,
      ADD COLUMN IF NOT EXISTS service_area              text,
      ADD COLUMN IF NOT EXISTS whatsapp                  varchar(20),
      ADD COLUMN IF NOT EXISTS profile_image             text,
      ADD COLUMN IF NOT EXISTS cover_image               text;
  END IF;
END $$;

-- clients
DO $$ BEGIN
  IF public.__vx_table_exists('clients') THEN
    ALTER TABLE public.clients
      ADD COLUMN IF NOT EXISTS total_spent        numeric(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS appointments_count integer       DEFAULT 0,
      ADD COLUMN IF NOT EXISTS quotes_count       integer       DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_contact       timestamp;

    -- L'enum client_source doit exister avant d'ajouter la colonne
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'client_source') THEN
      BEGIN
        ALTER TABLE public.clients
          ADD COLUMN IF NOT EXISTS source client_source DEFAULT 'website';
      EXCEPTION WHEN others THEN NULL;
      END;
    END IF;
  END IF;
END $$;

-- quotes
DO $$ BEGIN
  IF public.__vx_table_exists('quotes') THEN
    ALTER TABLE public.quotes
      ADD COLUMN IF NOT EXISTS category         varchar(100),
      ADD COLUMN IF NOT EXISTS signed_at        timestamp,
      ADD COLUMN IF NOT EXISTS signature_url    text,
      ADD COLUMN IF NOT EXISTS reminder_sent_at timestamp;
  END IF;
END $$;

-- notifications
DO $$ BEGIN
  IF public.__vx_table_exists('notifications') THEN
    ALTER TABLE public.notifications
      ADD COLUMN IF NOT EXISTS data jsonb,
      ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- team_members
DO $$ BEGIN
  IF public.__vx_table_exists('team_members') THEN
    ALTER TABLE public.team_members
      ADD COLUMN IF NOT EXISTS active boolean DEFAULT true NOT NULL;
  END IF;
END $$;

-- blog_posts
DO $$ BEGIN
  IF public.__vx_table_exists('blog_posts') THEN
    ALTER TABLE public.blog_posts
      ADD COLUMN IF NOT EXISTS meta_title       varchar(200),
      ADD COLUMN IF NOT EXISTS meta_description varchar(300),
      ADD COLUMN IF NOT EXISTS published_at     timestamp;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4. Index de performance (chacun conditionné à l'existence de la table)
-- -----------------------------------------------------------------------------
-- Petit helper pour créer un index si la table existe.
DO $$
DECLARE
  ix RECORD;
BEGIN
  FOR ix IN
    SELECT * FROM (VALUES
      ('businesses',      'businesses_slug_uidx',            'UNIQUE',  '(slug)'),
      ('businesses',      'businesses_owner_idx',            '',        '(owner_id)'),
      ('businesses',      'businesses_city_idx',             '',        '(lower(city))'),
      ('businesses',      'businesses_cat_idx',              '',        '(category)'),
      ('businesses',      'businesses_siret_uidx',           'UNIQUE',  '(siret) WHERE siret IS NOT NULL'),
      ('users',           'users_email_uidx',                'UNIQUE',  '(lower(email))'),
      ('clients',         'clients_business_idx',            '',        '(business_id)'),
      ('clients',         'clients_business_phone_idx',      '',        '(business_id, phone)'),
      ('clients',         'clients_business_email_idx',      '',        '(business_id, lower(email))'),
      ('appointments',    'appointments_business_date_idx',  '',        '(business_id, date)'),
      ('appointments',    'appointments_status_idx',         '',        '(status)'),
      ('appointments',    'appointments_client_idx',         '',        '(client_id)'),
      ('quotes',          'quotes_business_status_idx',      '',        '(business_id, status)'),
      ('quotes',          'quotes_client_idx',               '',        '(client_id)'),
      ('quotes',          'quotes_updated_idx',              '',        '(updated_at)'),
      ('quotes',          'quotes_sent_updated_idx',         '',        '(status, updated_at) WHERE status = ''sent'''),
      ('payments',        'payments_business_created_idx',   '',        '(business_id, created_at DESC)'),
      ('payments',        'payments_status_idx',             '',        '(status)'),
      ('notifications',   'notifications_user_read_idx',     '',        '(user_id, is_read, created_at DESC)'),
      ('reviews',         'reviews_business_idx',            '',        '(business_id, created_at DESC)'),
      ('page_visits',     'page_visits_business_date_idx',   '',        '(business_id, date)'),
      ('blog_posts',      'blog_business_published_idx',     '',        '(business_id, is_published, published_at DESC)'),
      ('blog_posts',      'blog_business_slug_uidx',         'UNIQUE',  '(business_id, slug)')
    ) AS t(tbl, idx_name, kind, cols)
  LOOP
    IF public.__vx_table_exists(ix.tbl) THEN
      BEGIN
        EXECUTE format('CREATE %s INDEX IF NOT EXISTS %I ON public.%I %s',
                       ix.kind, ix.idx_name, ix.tbl, ix.cols);
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'Index %: %', ix.idx_name, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 5. Nettoyage doux des NULL sur les colonnes NOT NULL requises
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF public.__vx_table_exists('users') THEN
    UPDATE public.users SET email_verified = false      WHERE email_verified IS NULL;
    UPDATE public.users SET subscription   = 'free'     WHERE subscription   IS NULL;
    UPDATE public.users SET role           = 'professional' WHERE role       IS NULL;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 6. Rapport post-application (jamais bloquant)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  _cnt bigint;
  _tables text[] := ARRAY['users','businesses','clients','quotes','appointments','payments'];
  _tbl text;
BEGIN
  RAISE NOTICE '--- Vitrix DB status ---';
  FOREACH _tbl IN ARRAY _tables LOOP
    IF public.__vx_table_exists(_tbl) THEN
      EXECUTE format('SELECT COUNT(*) FROM public.%I', _tbl) INTO _cnt;
      RAISE NOTICE '%: %', rpad(_tbl, 14), _cnt;
    ELSE
      RAISE NOTICE '%: (table absente)', rpad(_tbl, 14);
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- Nettoyage : on retire le helper (facultatif — commenter pour le garder)
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.__vx_table_exists(text);

-- ✅ Fin du script — safe à rejouer N fois, même sur une DB partielle.
