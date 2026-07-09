-- ============================================================
-- NETTOYAGE DES DONNÉES DE DÉMO (VERSION CORRIGÉE)
-- À exécuter dans Supabase → SQL Editor → Run
-- Cela supprime les faux paiements, RDV, devis, clients, etc.
-- Cela garde tes utilisateurs et tes businesses (vitrines).
-- ============================================================

DELETE FROM "loyalty_transactions";
DELETE FROM "loyalty_points";
DELETE FROM "review_requests";
DELETE FROM "notifications";
DELETE FROM "page_visits";
DELETE FROM "payments";
DELETE FROM "quote_attachments";
DELETE FROM "quotes";
DELETE FROM "appointments";
DELETE FROM "clients";
DELETE FROM "blog_posts";
DELETE FROM "faqs";
DELETE FROM "team_members";
DELETE FROM "quote_form_fields";
DELETE FROM "services";

SELECT 'Nettoyage terminé avec succès !' as status;
