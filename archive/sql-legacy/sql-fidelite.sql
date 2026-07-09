-- ============================================
-- VITRIX - Système de points de fidélité
-- À exécuter dans Supabase → SQL Editor → Run
-- ============================================

-- 1. Colonnes de configuration fidélité sur les businesses
-- (si elles n'existent pas déjà)
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "loyalty_enabled" boolean DEFAULT false;
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "loyalty_points_per_euro" integer DEFAULT 1;
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "loyalty_reward" text;

-- Colonnes de personnalisation vitrine (si manquantes)
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "primary_color" varchar(20) DEFAULT '#0f172a';
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "hide_branding" boolean DEFAULT false;
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "language" varchar(5) DEFAULT 'fr';
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "enable_stripe" boolean DEFAULT false;
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "stripe_account_id" varchar(255);
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "accept_cash" boolean DEFAULT true;
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "accept_apple_pay" boolean DEFAULT false;

-- 2. Table des points de fidélité par client
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

-- 3. Historique des points (gains et utilisations)
CREATE TABLE IF NOT EXISTS "loyalty_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "business_id" uuid NOT NULL,
  "client_id" uuid NOT NULL,
  "points" integer NOT NULL,            -- positif = gain, négatif = utilisation
  "reason" varchar(200),                -- ex: "Paiement 150€", "Récompense utilisée"
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "loyalty_tx_business_id_fk" FOREIGN KEY ("business_id")
    REFERENCES "public"."businesses"("id") ON DELETE cascade,
  CONSTRAINT "loyalty_tx_client_id_fk" FOREIGN KEY ("client_id")
    REFERENCES "public"."clients"("id") ON DELETE cascade
);

-- 4. Index pour les performances
CREATE INDEX IF NOT EXISTS "idx_loyalty_points_client" ON "loyalty_points" ("business_id", "client_id");
CREATE INDEX IF NOT EXISTS "idx_loyalty_tx_client" ON "loyalty_transactions" ("business_id", "client_id");

-- 5. Vérification
SELECT 'loyalty_points' as table_name, count(*) as rows FROM loyalty_points
UNION ALL
SELECT 'loyalty_transactions', count(*) FROM loyalty_transactions;
