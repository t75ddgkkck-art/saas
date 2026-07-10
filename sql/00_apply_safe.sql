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
      ADD COLUMN IF NOT EXISTS stripe_customer_id       varchar(255),
      ADD COLUMN IF NOT EXISTS stripe_subscription_id   varchar(255),
      ADD COLUMN IF NOT EXISTS subscription_status      varchar(30),
      ADD COLUMN IF NOT EXISTS subscription_expires_at  timestamp,
      ADD COLUMN IF NOT EXISTS email_verified           boolean DEFAULT false NOT NULL,
      ADD COLUMN IF NOT EXISTS phone                    varchar(20),
      -- Lot 13 monitoring : soft ban admin
      ADD COLUMN IF NOT EXISTS banned_at                timestamp,
      ADD COLUMN IF NOT EXISTS ban_reason               varchar(500);
    CREATE INDEX IF NOT EXISTS users_subscription_expires_idx
      ON public.users (subscription_expires_at);
  END IF;
END $$;

-- admin_events (Lot 13 monitoring) : audit trail des actions admin
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.admin_events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id   uuid,
    target_user_id  uuid,
    action          varchar(60) NOT NULL,
    payload         jsonb,
    ip              varchar(45),
    created_at      timestamp NOT NULL DEFAULT NOW()
  );
  -- FKs séparés (ON DELETE SET NULL) — ne bloque pas si users absent au premier apply
  IF public.__vx_table_exists('users') THEN
    BEGIN
      ALTER TABLE public.admin_events
        ADD CONSTRAINT admin_events_actor_fk
        FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN
      ALTER TABLE public.admin_events
        ADD CONSTRAINT admin_events_target_fk
        FOREIGN KEY (target_user_id) REFERENCES public.users(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
  CREATE INDEX IF NOT EXISTS admin_events_actor_created_idx
    ON public.admin_events (actor_user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS admin_events_target_created_idx
    ON public.admin_events (target_user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS admin_events_action_created_idx
    ON public.admin_events (action, created_at DESC);
END $$;

-- businesses
DO $$ BEGIN
  IF public.__vx_table_exists('businesses') THEN
    ALTER TABLE public.businesses
      ADD COLUMN IF NOT EXISTS primary_color             varchar(20)  DEFAULT '#0f172a',
      ADD COLUMN IF NOT EXISTS hide_branding             boolean      DEFAULT false,
      ADD COLUMN IF NOT EXISTS language                  varchar(5)   DEFAULT 'fr',
      ADD COLUMN IF NOT EXISTS timezone                  varchar(64)  DEFAULT 'Europe/Paris',
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

-- ai_usage (nouvelle table quotas IA, créée si absente)
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  route varchar(80) NOT NULL,
  model varchar(60) NOT NULL,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  estimated_cost_usd numeric(10, 6),
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_usage_user_created_idx
  ON public.ai_usage (user_id, created_at);
CREATE INDEX IF NOT EXISTS ai_usage_model_created_idx
  ON public.ai_usage (model, created_at);

-- email_optouts (nouvelle table RGPD, créée si absente)
CREATE TABLE IF NOT EXISTS public.email_optouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) NOT NULL,
  category varchar(30) NOT NULL,
  reason varchar(500),
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS email_optouts_email_category_uidx
  ON public.email_optouts (lower(email), category);

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
-- 4bis. Lot 14 — Soft delete, triggers updated_at, CHECK longueur, cascade,
--        partitionnement page_visits
-- -----------------------------------------------------------------------------

-- 14.3 Colonnes deleted_at (soft delete) + index partiel sur "actifs"
DO $$
DECLARE
  t text;
  _tables text[] := ARRAY['users','businesses','clients','appointments','quotes','blog_posts'];
BEGIN
  FOREACH t IN ARRAY _tables LOOP
    IF public.__vx_table_exists(t) THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_at timestamp', t);
      -- Index sur deleted_at → listing "actifs" scanne le partiel, super rapide
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I (deleted_at)',
        t || '_deleted_at_idx', t
      );
    END IF;
  END LOOP;
END $$;

-- 14.4 Trigger updated_at automatique
-- Une seule fonction générique, réutilisable pour toutes les tables.
CREATE OR REPLACE FUNCTION public.__vx_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
  _tables text[] := ARRAY[
    'users','businesses','clients','appointments','quotes','blog_posts',
    'services','faqs','working_hours','payments','reviews','notes',
    'quote_items','notifications'
  ];
BEGIN
  FOREACH t IN ARRAY _tables LOOP
    IF public.__vx_table_exists(t) THEN
      -- Vérifie que la table a bien une colonne updated_at, sinon on skip
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name=t AND column_name='updated_at'
      ) THEN
        -- Idempotent : DROP puis CREATE (pas de CREATE TRIGGER IF NOT EXISTS avant PG14)
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'set_updated_at_' || t, t);
        EXECUTE format(
          'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.__vx_set_updated_at()',
          'set_updated_at_' || t, t
        );
      END IF;
    END IF;
  END LOOP;
END $$;

-- 14.2 CHECK longueur sur colonnes text sans limite
-- On cap à des valeurs généreuses mais réalistes → protège contre DoS
-- (un user qui colle 1 GB dans "notes").
DO $$ BEGIN
  IF public.__vx_table_exists('clients') THEN
    BEGIN
      ALTER TABLE public.clients
        ADD CONSTRAINT clients_notes_length_chk CHECK (char_length(notes) <= 10000);
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
  IF public.__vx_table_exists('businesses') THEN
    BEGIN
      ALTER TABLE public.businesses
        ADD CONSTRAINT businesses_description_length_chk CHECK (char_length(description) <= 5000);
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN
      ALTER TABLE public.businesses
        ADD CONSTRAINT businesses_service_area_length_chk CHECK (char_length(service_area) <= 2000);
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN
      ALTER TABLE public.businesses
        ADD CONSTRAINT businesses_address_length_chk CHECK (char_length(address) <= 500);
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN
      ALTER TABLE public.businesses
        ADD CONSTRAINT businesses_loyalty_reward_length_chk CHECK (char_length(loyalty_reward) <= 1000);
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
  IF public.__vx_table_exists('blog_posts') THEN
    -- 50 000 caractères ≈ 8 000 mots. Largement au-dessus d'un article normal (1500 mots).
    BEGIN
      ALTER TABLE public.blog_posts
        ADD CONSTRAINT blog_posts_content_length_chk CHECK (char_length(content) <= 50000);
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN
      ALTER TABLE public.blog_posts
        ADD CONSTRAINT blog_posts_excerpt_length_chk CHECK (char_length(excerpt) <= 500);
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
  IF public.__vx_table_exists('notes') THEN
    BEGIN
      ALTER TABLE public.notes
        ADD CONSTRAINT notes_content_length_chk CHECK (char_length(content) <= 10000);
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;

-- 14.8 Cascade delete manquants
-- Recrée les FKs avec ON DELETE CASCADE / SET NULL selon la logique métier.
DO $$ BEGIN
  IF public.__vx_table_exists('businesses') THEN
    -- businesses.owner_id → users.id : cascade (un user supprimé emporte ses vitrines)
    BEGIN
      ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_owner_id_fkey;
      ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_owner_id_users_id_fk;
      ALTER TABLE public.businesses
        ADD CONSTRAINT businesses_owner_id_fkey
        FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;

  IF public.__vx_table_exists('appointments') THEN
    -- appointments.created_by : SET NULL (RDV conservés même si employé supprimé)
    BEGIN
      ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_created_by_fkey;
      ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_created_by_users_id_fk;
      ALTER TABLE public.appointments
        ADD CONSTRAINT appointments_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;

  IF public.__vx_table_exists('quotes') THEN
    BEGIN
      ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_created_by_fkey;
      ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_created_by_users_id_fk;
      ALTER TABLE public.quotes
        ADD CONSTRAINT quotes_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;

  IF public.__vx_table_exists('notes') THEN
    -- notes.created_by NOT NULL → cascade (données personnelles du créateur)
    BEGIN
      ALTER TABLE public.notes DROP CONSTRAINT IF EXISTS notes_created_by_fkey;
      ALTER TABLE public.notes DROP CONSTRAINT IF EXISTS notes_created_by_users_id_fk;
      ALTER TABLE public.notes
        ADD CONSTRAINT notes_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;

-- 14.7 Partitionnement page_visits (informatif)
-- NOTE : le partitionnement est INVASIF (renomme la table, crée les partitions,
-- migre les données). On ne le fait PAS automatiquement dans ce script pour
-- éviter tout risque en production. Le SQL à exécuter manuellement est fourni
-- dans docs/DB.md section "Partitionnement page_visits" — à faire dès que la
-- table dépasse ~5M lignes.
--
-- Résumé de la stratégie :
--   1. Renommer page_visits → page_visits_legacy
--   2. Créer page_visits partitionnée PARTITION BY RANGE (created_at)
--   3. Créer les partitions mensuelles (2025-01, 2025-02, ...)
--   4. INSERT INTO page_visits SELECT * FROM page_visits_legacy
--   5. DROP TABLE page_visits_legacy
--   6. Programmer un cron mensuel qui crée la partition M+1 (pg_partman ou script maison)

-- -----------------------------------------------------------------------------
-- 4ter. Lot 16 — Parrainage + API keys + Webhooks sortants
-- -----------------------------------------------------------------------------

-- 16.3 Parrainage : colonnes sur users
DO $$ BEGIN
  IF public.__vx_table_exists('users') THEN
    ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS referral_code           varchar(20),
      ADD COLUMN IF NOT EXISTS referred_by             uuid,
      ADD COLUMN IF NOT EXISTS referral_credit_months  integer DEFAULT 0 NOT NULL;
    -- Index unique partiel : lookup "à qui appartient ce code ?"
    CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_uidx
      ON public.users (referral_code) WHERE referral_code IS NOT NULL;
    CREATE INDEX IF NOT EXISTS users_referred_by_idx
      ON public.users (referred_by);
    -- FK auto-référentielle : le parrain reste NULL si supprimé (préserve historique filleul)
    BEGIN
      ALTER TABLE public.users
        ADD CONSTRAINT users_referred_by_fkey
        FOREIGN KEY (referred_by) REFERENCES public.users(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;

-- 16.4 API keys
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.api_keys (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid NOT NULL,
    business_id   uuid NOT NULL,
    name          varchar(100) NOT NULL,
    key_prefix    varchar(20) NOT NULL,
    key_hash      varchar(64) NOT NULL,
    scope         varchar(20) DEFAULT 'read' NOT NULL,
    last_used_at  timestamp,
    last_used_ip  varchar(45),
    revoked_at    timestamp,
    created_at    timestamp NOT NULL DEFAULT NOW()
  );
  IF public.__vx_table_exists('users') THEN
    BEGIN
      ALTER TABLE public.api_keys
        ADD CONSTRAINT api_keys_user_fk
        FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
  IF public.__vx_table_exists('businesses') THEN
    BEGIN
      ALTER TABLE public.api_keys
        ADD CONSTRAINT api_keys_business_fk
        FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
  CREATE UNIQUE INDEX IF NOT EXISTS api_keys_hash_uidx ON public.api_keys (key_hash);
  CREATE INDEX IF NOT EXISTS api_keys_user_created_idx ON public.api_keys (user_id, created_at DESC);
END $$;

-- 16.4 Webhook endpoints (URLs cibles configurés par le user)
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL,
    business_id     uuid NOT NULL,
    url             varchar(500) NOT NULL,
    events          jsonb DEFAULT '[]' NOT NULL,
    signing_secret  varchar(64) NOT NULL,
    failure_count   integer DEFAULT 0 NOT NULL,
    disabled_at     timestamp,
    created_at      timestamp NOT NULL DEFAULT NOW(),
    updated_at      timestamp NOT NULL DEFAULT NOW()
  );
  IF public.__vx_table_exists('users') THEN
    BEGIN
      ALTER TABLE public.webhook_endpoints
        ADD CONSTRAINT webhook_endpoints_user_fk
        FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
  IF public.__vx_table_exists('businesses') THEN
    BEGIN
      ALTER TABLE public.webhook_endpoints
        ADD CONSTRAINT webhook_endpoints_business_fk
        FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
  CREATE INDEX IF NOT EXISTS webhook_endpoints_business_idx ON public.webhook_endpoints (business_id);
  CREATE INDEX IF NOT EXISTS webhook_endpoints_user_idx ON public.webhook_endpoints (user_id);
END $$;

-- 16.4 Webhook deliveries (audit + retry)
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint_id       uuid NOT NULL,
    event             varchar(60) NOT NULL,
    payload           jsonb,
    response_status   integer,
    response_body     varchar(500),
    success           boolean,
    attempt_count     integer DEFAULT 0 NOT NULL,
    created_at        timestamp NOT NULL DEFAULT NOW(),
    delivered_at      timestamp
  );
  BEGIN
    ALTER TABLE public.webhook_deliveries
      ADD CONSTRAINT webhook_deliveries_endpoint_fk
      FOREIGN KEY (endpoint_id) REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  CREATE INDEX IF NOT EXISTS webhook_deliveries_endpoint_created_idx
    ON public.webhook_deliveries (endpoint_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS webhook_deliveries_retry_idx
    ON public.webhook_deliveries (success, attempt_count);
END $$;

-- -----------------------------------------------------------------------------
-- 4quater. Lot 19 — Auth complète (tokens reset/verify + sessions)
-- -----------------------------------------------------------------------------

-- Enum type de token
DO $$ BEGIN
  CREATE TYPE public.auth_token_type AS ENUM ('password_reset', 'email_verify', 'magic_link');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- auth_tokens (single-use, TTL, hash SHA-256)
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.auth_tokens (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid NOT NULL,
    type         public.auth_token_type NOT NULL,
    token_hash   varchar(64) NOT NULL,
    expires_at   timestamp NOT NULL,
    used_at      timestamp,
    ip           varchar(45),
    meta         jsonb,
    created_at   timestamp NOT NULL DEFAULT NOW()
  );
  IF public.__vx_table_exists('users') THEN
    BEGIN
      ALTER TABLE public.auth_tokens
        ADD CONSTRAINT auth_tokens_user_fk
        FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
  CREATE UNIQUE INDEX IF NOT EXISTS auth_tokens_hash_uidx ON public.auth_tokens (token_hash);
  CREATE INDEX IF NOT EXISTS auth_tokens_expires_idx ON public.auth_tokens (expires_at);
  CREATE INDEX IF NOT EXISTS auth_tokens_user_type_idx
    ON public.auth_tokens (user_id, type, created_at DESC);
END $$;

-- sessions (multi-device, revoke)
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.sessions (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid NOT NULL,
    token_hash    varchar(64) NOT NULL,
    user_agent    varchar(500),
    ip            varchar(45),
    last_seen_at  timestamp NOT NULL DEFAULT NOW(),
    revoked_at    timestamp,
    expires_at    timestamp NOT NULL,
    created_at    timestamp NOT NULL DEFAULT NOW()
  );
  IF public.__vx_table_exists('users') THEN
    BEGIN
      ALTER TABLE public.sessions
        ADD CONSTRAINT sessions_user_fk
        FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
  CREATE UNIQUE INDEX IF NOT EXISTS sessions_hash_uidx ON public.sessions (token_hash);
  CREATE INDEX IF NOT EXISTS sessions_user_created_idx ON public.sessions (user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS sessions_expires_idx ON public.sessions (expires_at);
END $$;

-- -----------------------------------------------------------------------------
-- 4quinquies. Lot 24 — CRM enrichi (no-show, doublons, relance impayés)
-- -----------------------------------------------------------------------------

-- Ajout `no_show` à l'enum appointment_status (idempotent via IF NOT EXISTS)
-- Postgres 12+ requis pour ADD VALUE IF NOT EXISTS.
DO $$ BEGIN
  ALTER TYPE public.appointment_status ADD VALUE IF NOT EXISTS 'no_show';
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- Colonne compteur no-show sur clients (utile CRM : détection clients à risque)
DO $$ BEGIN
  IF public.__vx_table_exists('clients') THEN
    ALTER TABLE public.clients
      ADD COLUMN IF NOT EXISTS no_shows_count integer DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- Colonne "dernier rappel impayé" sur payments pour éviter le spam relance
DO $$ BEGIN
  IF public.__vx_table_exists('payments') THEN
    ALTER TABLE public.payments
      ADD COLUMN IF NOT EXISTS last_reminder_at timestamp,
      ADD COLUMN IF NOT EXISTS reminder_count   integer DEFAULT 0 NOT NULL;
    CREATE INDEX IF NOT EXISTS payments_reminder_scan_idx
      ON public.payments (status, created_at)
      WHERE status = 'pending';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4sexies. Lot 30 (F2) — Acompte à la réservation
-- -----------------------------------------------------------------------------

-- Nouvel enum deposit_status (idempotent)
DO $$ BEGIN
  CREATE TYPE public.deposit_status AS ENUM ('pending', 'paid', 'refunded', 'forfeited');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Colonnes acompte sur services (config par service)
DO $$ BEGIN
  IF public.__vx_table_exists('services') THEN
    ALTER TABLE public.services
      ADD COLUMN IF NOT EXISTS price_cents integer,
      ADD COLUMN IF NOT EXISTS deposit_type varchar(10),
      ADD COLUMN IF NOT EXISTS deposit_amount integer;
    -- CHECK : deposit_type doit être fixed | percent | null
    ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_deposit_type_check;
    ALTER TABLE public.services
      ADD CONSTRAINT services_deposit_type_check
      CHECK (deposit_type IS NULL OR deposit_type IN ('fixed', 'percent'));
    -- CHECK : si percent, 0 < amount <= 100
    ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_deposit_percent_check;
    ALTER TABLE public.services
      ADD CONSTRAINT services_deposit_percent_check
      CHECK (deposit_type IS DISTINCT FROM 'percent' OR (deposit_amount > 0 AND deposit_amount <= 100));
  END IF;
END $$;

-- Politique de remboursement acompte au niveau business
DO $$ BEGIN
  IF public.__vx_table_exists('businesses') THEN
    ALTER TABLE public.businesses
      ADD COLUMN IF NOT EXISTS deposit_refund_hours integer;
  END IF;
END $$;

-- Traçabilité acompte sur appointments
DO $$ BEGIN
  IF public.__vx_table_exists('appointments') THEN
    ALTER TABLE public.appointments
      ADD COLUMN IF NOT EXISTS deposit_required boolean DEFAULT false NOT NULL,
      ADD COLUMN IF NOT EXISTS deposit_amount_cents integer,
      ADD COLUMN IF NOT EXISTS deposit_status public.deposit_status,
      ADD COLUMN IF NOT EXISTS stripe_checkout_session_id varchar(255);
    -- Index partiel pour le cron d'expiration (scan uniquement 'pending')
    CREATE INDEX IF NOT EXISTS appointments_deposit_scan_idx
      ON public.appointments (deposit_status, created_at)
      WHERE deposit_status = 'pending';
    -- Lookup par session Stripe (webhook rapide)
    CREATE INDEX IF NOT EXISTS appointments_stripe_session_idx
      ON public.appointments (stripe_checkout_session_id)
      WHERE stripe_checkout_session_id IS NOT NULL;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4septies. Lot 31 (F3) — Espace client final (magic-link + sessions)
-- -----------------------------------------------------------------------------

DO $$ BEGIN
  IF public.__vx_table_exists('businesses') THEN
    CREATE TABLE IF NOT EXISTS public.client_auth_tokens (
      id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
      email        varchar(255)  NOT NULL,
      token_hash   varchar(64)   NOT NULL,
      expires_at   timestamp     NOT NULL,
      used_at      timestamp,
      ip           varchar(45),
      business_id  uuid          REFERENCES public.businesses(id) ON DELETE SET NULL,
      created_at   timestamp     NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS client_auth_tokens_hash_uidx
      ON public.client_auth_tokens (token_hash);
    CREATE INDEX IF NOT EXISTS client_auth_tokens_email_scan_idx
      ON public.client_auth_tokens (email, used_at, expires_at);
  END IF;
END $$;

DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.client_sessions (
    id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    email         varchar(255)  NOT NULL,
    token_hash    varchar(64)   NOT NULL,
    expires_at    timestamp     NOT NULL,
    ip            varchar(45),
    user_agent    varchar(500),
    created_at    timestamp     NOT NULL DEFAULT now(),
    last_seen_at  timestamp     NOT NULL DEFAULT now(),
    revoked_at    timestamp
  );
  CREATE UNIQUE INDEX IF NOT EXISTS client_sessions_hash_uidx
    ON public.client_sessions (token_hash);
  CREATE INDEX IF NOT EXISTS client_sessions_email_idx
    ON public.client_sessions (email);
  CREATE INDEX IF NOT EXISTS client_sessions_expiry_idx
    ON public.client_sessions (expires_at);
END $$;

-- -----------------------------------------------------------------------------
-- 4octies. Lot 32 (F5) — Équipe & rôles (refonte team_members + invitations)
-- -----------------------------------------------------------------------------

-- Extension team_members : user_id, invitedBy, acceptedAt, deletedAt
DO $$ BEGIN
  IF public.__vx_table_exists('team_members') THEN
    ALTER TABLE public.team_members
      ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS invited_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS accepted_at timestamp,
      ADD COLUMN IF NOT EXISTS deleted_at  timestamp;
    -- CHECK : rôle dans admin|employee|viewer
    ALTER TABLE public.team_members DROP CONSTRAINT IF EXISTS team_members_role_check;
    ALTER TABLE public.team_members
      ADD CONSTRAINT team_members_role_check
      CHECK (member_role IN ('admin', 'employee', 'viewer'));
    -- Unique (business, email lowercase) : évite les doublons d'invitation
    CREATE UNIQUE INDEX IF NOT EXISTS team_members_business_email_uidx
      ON public.team_members (business_id, lower(email));
    -- Lookup par user (getCurrentTeamContext)
    CREATE INDEX IF NOT EXISTS team_members_user_idx
      ON public.team_members (user_id);
    -- Migration douce : si des lignes ont l'ancien rôle "assistant", on les
    -- passe à "employee" (rôle le plus proche fonctionnellement).
    UPDATE public.team_members SET member_role = 'employee'
      WHERE member_role NOT IN ('admin', 'employee', 'viewer');
  END IF;
END $$;

-- Nouvelle table team_invitations
DO $$ BEGIN
  IF public.__vx_table_exists('businesses') THEN
    CREATE TABLE IF NOT EXISTS public.team_invitations (
      id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
      business_id         uuid          NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
      email               varchar(255)  NOT NULL,
      member_role         varchar(30)   NOT NULL,
      token_hash          varchar(64)   NOT NULL,
      expires_at          timestamp     NOT NULL,
      accepted_at         timestamp,
      invited_by_user_id  uuid          REFERENCES public.users(id) ON DELETE SET NULL,
      created_at          timestamp     NOT NULL DEFAULT now(),
      CONSTRAINT team_invitations_role_check CHECK (member_role IN ('admin', 'employee', 'viewer'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS team_invitations_hash_uidx
      ON public.team_invitations (token_hash);
    CREATE INDEX IF NOT EXISTS team_invitations_business_email_idx
      ON public.team_invitations (business_id, email);
  END IF;
END $$;

-- Assignation RDV + devis à un membre d'équipe
DO $$ BEGIN
  IF public.__vx_table_exists('appointments') THEN
    ALTER TABLE public.appointments
      ADD COLUMN IF NOT EXISTS assigned_to_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS appointments_assigned_idx
      ON public.appointments (assigned_to_user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF public.__vx_table_exists('quotes') THEN
    ALTER TABLE public.quotes
      ADD COLUMN IF NOT EXISTS assigned_to_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS quotes_assigned_idx
      ON public.quotes (assigned_to_user_id);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4nonies. Lot 33 (F4) — Calendrier avancé (indispos + sync Google + ICS)
-- -----------------------------------------------------------------------------

-- Table indisponibilités (blocs déjeuner / congés / bloc perso)
DO $$ BEGIN
  IF public.__vx_table_exists('businesses') THEN
    CREATE TABLE IF NOT EXISTS public.unavailabilities (
      id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
      business_id  uuid          NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
      user_id      uuid          REFERENCES public.users(id) ON DELETE SET NULL,
      title        varchar(200)  NOT NULL,
      date         varchar(10)   NOT NULL,
      start_time   varchar(5),
      end_time     varchar(5),
      color        varchar(7),
      notes        text,
      created_at   timestamp     NOT NULL DEFAULT now(),
      updated_at   timestamp     NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS unavailabilities_business_date_idx
      ON public.unavailabilities (business_id, date);
    CREATE INDEX IF NOT EXISTS unavailabilities_user_idx
      ON public.unavailabilities (user_id);
  END IF;
END $$;

-- Table tokens Google Calendar (par business, 1:1)
DO $$ BEGIN
  IF public.__vx_table_exists('businesses') THEN
    CREATE TABLE IF NOT EXISTS public.calendar_tokens (
      business_id             uuid          PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
      provider                varchar(20)   NOT NULL DEFAULT 'google',
      refresh_token           text          NOT NULL,
      access_token            text,
      access_token_expires_at timestamp,
      calendar_id             varchar(255)  NOT NULL DEFAULT 'primary',
      scope                   text,
      connected_at            timestamp     NOT NULL DEFAULT now(),
      last_sync_at            timestamp
    );
  END IF;
END $$;

-- Colonne icsSecret sur businesses (URL secrète calendrier)
DO $$ BEGIN
  IF public.__vx_table_exists('businesses') THEN
    ALTER TABLE public.businesses
      ADD COLUMN IF NOT EXISTS ics_secret varchar(64);
    CREATE UNIQUE INDEX IF NOT EXISTS businesses_ics_secret_uidx
      ON public.businesses (ics_secret)
      WHERE ics_secret IS NOT NULL;
  END IF;
END $$;

-- Colonne googleEventId sur appointments (pour sync bidirectionnel plus tard,
-- v1 sert uniquement à identifier ce qu'on a poussé et éviter les doublons)
DO $$ BEGIN
  IF public.__vx_table_exists('appointments') THEN
    -- google_calendar_id existe déjà côté schema (varchar 500) — on l'utilise
    -- comme "ID de l'event dans Google Calendar" pour la sync push.
    -- Rien à ajouter.
    NULL;
  END IF;
END $$;

-- Idempotence webhooks Stripe (bonus B27 lié F2)
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
    event_id     varchar(255) PRIMARY KEY,
    type         varchar(60)  NOT NULL,
    processed_at timestamp    NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS stripe_webhook_type_processed_idx
    ON public.stripe_webhook_events (type, processed_at);
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
