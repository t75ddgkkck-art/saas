-- =============================================================================
-- Vitrix / ArtisanPro — Vérification de schéma (LECTURE SEULE)
-- =============================================================================
-- À exécuter avant/après le SQL d'application pour voir ce qui manque.
-- Ne modifie RIEN. Renvoie 4 requêtes de diagnostic.
-- =============================================================================

-- 1. Tables présentes ------------------------------------------------------
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. Colonnes manquantes attendues par le code -----------------------------
-- (Compare une liste hardcodée à ce qui existe.)
WITH expected(table_name, column_name) AS (VALUES
  ('users','stripe_customer_id'),
  ('users','stripe_subscription_id'),
  ('users','email_verified'),
  ('users','phone'),
  ('businesses','primary_color'),
  ('businesses','hide_branding'),
  ('businesses','template'),
  ('businesses','custom_domain'),
  ('businesses','public_chat_enabled'),
  ('businesses','auto_review_request'),
  ('businesses','loyalty_enabled'),
  ('businesses','enable_stripe'),
  ('businesses','stripe_account_id'),
  ('businesses','highlights_data'),
  ('businesses','menu_data'),
  ('businesses','google_place_id'),
  ('clients','source'),
  ('clients','total_spent'),
  ('clients','appointments_count'),
  ('clients','quotes_count'),
  ('clients','last_contact'),
  ('quotes','category'),
  ('quotes','signed_at'),
  ('quotes','signature_url'),
  ('quotes','reminder_sent_at'),
  ('notifications','data'),
  ('notifications','read'),
  ('team_members','active'),
  ('blog_posts','meta_title'),
  ('blog_posts','meta_description'),
  ('blog_posts','published_at')
)
SELECT e.table_name, e.column_name, 'MANQUANTE' AS status
FROM expected e
LEFT JOIN information_schema.columns c
  ON c.table_schema='public' AND c.table_name=e.table_name AND c.column_name=e.column_name
WHERE c.column_name IS NULL
ORDER BY e.table_name, e.column_name;

-- 3. Enums : valeurs attendues -----------------------------------------------
WITH expected(enum_name, enum_value) AS (VALUES
  ('role','admin'),('role','professional'),('role','employee'),('role','assistant'),
  ('subscription','free'),('subscription','pro'),('subscription','premium'),
  ('appointment_status','pending'),('appointment_status','confirmed'),
  ('appointment_status','in_progress'),('appointment_status','completed'),
  ('appointment_status','cancelled'),('appointment_status','no_show'),
  ('quote_status','draft'),('quote_status','sent'),('quote_status','accepted'),
  ('quote_status','rejected'),('quote_status','signed'),('quote_status','expired'),
  ('payment_status','pending'),('payment_status','completed'),
  ('payment_status','failed'),('payment_status','refunded'),
  ('client_source','website'),('client_source','google'),
  ('client_source','referral'),('client_source','social'),('client_source','other')
)
SELECT e.enum_name, e.enum_value, 'MANQUANTE' AS status
FROM expected e
LEFT JOIN (
  SELECT t.typname AS enum_name, ev.enumlabel AS enum_value
  FROM pg_type t
  JOIN pg_enum ev ON ev.enumtypid = t.oid
) existing ON existing.enum_name = e.enum_name AND existing.enum_value = e.enum_value
WHERE existing.enum_value IS NULL
ORDER BY e.enum_name, e.enum_value;

-- 4. Index de performance recommandés absents --------------------------------
WITH expected(idx_name) AS (VALUES
  ('businesses_slug_uidx'), ('businesses_owner_idx'), ('businesses_city_idx'),
  ('businesses_cat_idx'), ('businesses_siret_uidx'), ('users_email_uidx'),
  ('clients_business_idx'), ('clients_business_phone_idx'), ('clients_business_email_idx'),
  ('appointments_business_date_idx'), ('appointments_status_idx'), ('appointments_client_idx'),
  ('quotes_business_status_idx'), ('quotes_client_idx'), ('quotes_updated_idx'),
  ('payments_business_created_idx'), ('payments_status_idx'),
  ('notifications_user_read_idx'), ('reviews_business_idx'),
  ('page_visits_business_date_idx'),
  ('blog_business_published_idx'), ('blog_business_slug_uidx'),
  ('quotes_sent_updated_idx')
)
SELECT e.idx_name, 'MANQUANT' AS status
FROM expected e
LEFT JOIN pg_indexes p ON p.schemaname='public' AND p.indexname = e.idx_name
WHERE p.indexname IS NULL
ORDER BY e.idx_name;

-- 5. Stats globales -----------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM users)         AS users_count,
  (SELECT COUNT(*) FROM businesses)    AS businesses_count,
  (SELECT COUNT(*) FROM clients)       AS clients_count,
  (SELECT COUNT(*) FROM quotes)        AS quotes_count,
  (SELECT COUNT(*) FROM appointments)  AS appointments_count,
  (SELECT COUNT(*) FROM payments)      AS payments_count;
