# 🛠️ Améliorations issues de l'audit

Ce document liste **exactement** ce qui a changé. Rapport détaillé dans [`AUDIT_REPORT.md`](./AUDIT_REPORT.md) et [`AUDIT_FULL_V2.md`](./AUDIT_FULL_V2.md).

---

# 🟢 Tour 13 — Lot 14 Base de données

Adresse les 9 points du Lot 14 de l'audit :
- 14.1 Duplication enum `appointment_status`
- 14.2 Colonnes `text` sans limite → risque DoS
- 14.3 Pas de soft delete
- 14.4 Timestamps `updatedAt` pas déclenchés au UPDATE
- 14.5 `visits_reset_at` non documenté
- 14.6 Table `analytics` orpheline
- 14.7 Pas de partitionnement `page_visits`
- 14.8 Cascade delete manquants
- 14.9 Backups Supabase non documentés

## 14.1 — Suppression de l'enum dupliqué

`appointmentStatuses` (2ᵉ définition ligne 858) avait 6 valeurs et n'était **référencé nulle part**. Supprimé pour éviter une collision Postgres (`CREATE TYPE appointment_status ...` × 2 = erreur au push Drizzle). Commentaire pédagogique laissé sur place : si un jour on veut ajouter `in_progress`/`no_show`, faire `ALTER TYPE appointment_status ADD VALUE`, pas un doublon.

## 14.2 — CHECK longueurs texte

`sql/00_apply_safe.sql` ajoute des CHECK constraints idempotents :

| Colonne | Limite |
|---|---|
| `clients.notes` | 10 000 chars |
| `businesses.description` | 5 000 |
| `businesses.service_area` | 2 000 |
| `businesses.address` | 500 |
| `businesses.loyalty_reward` | 1 000 |
| `blog_posts.content` | 50 000 (≈8000 mots) |
| `blog_posts.excerpt` | 500 |
| `notes.content` | 10 000 |

Anti-DoS : plus possible de coller 1 GB dans une note client.

## 14.3 — Soft delete

Colonne `deleted_at TIMESTAMP` (nullable) ajoutée sur 6 tables critiques : `users`, `businesses`, `clients`, `appointments`, `quotes`, `blog_posts`. Index dédié `<table>_deleted_at_idx` sur chacune.

**Helper `src/lib/soft-delete.ts`** :
- `markDeleted()` : retourne `new Date()` — à passer dans `.set({ deletedAt })`
- `markRestored()` : retourne `null` — pour annuler un soft delete
- `notDeleted(col)` : `WHERE deleted_at IS NULL` (à combiner dans un `and(...)`)
- `onlyDeleted(col)` : inverse — pour vue "corbeille" admin

**Refactor `DELETE /api/account`** : ne fait plus un hard `db.delete()` mais un soft delete + purge cookies. Bénéfice RGPD : 30 jours de fenêtre de récupération avant purge finale.

**Refactor `DELETE /api/blog/[id]`** : soft delete `blogPosts.deletedAt = NOW()` au lieu de DROP row.

**Login refuse les comptes soft-deleted** : `src/app/api/auth/login/route.ts` retourne le même message générique que pour credentials invalides (anti-énumération).

**`getCurrentUser()` invalide la session** si le user est soft-deleted OU banni → cookie encore valide côté crypto mais ressource considérée absente.

**Pages publiques filtrées** — `WHERE deleted_at IS NULL` ajouté sur :
- `src/app/[slug]/page.tsx` (vitrine + generateMetadata + generateStaticParams)
- `src/app/[slug]/blog/page.tsx` (listing blog)
- `src/app/[slug]/blog/[postSlug]/page.tsx` (article individuel)
- `src/app/annuaire/page.tsx` (index général)
- `src/app/metier/[category]/page.tsx`
- `src/app/ville/[city]/page.tsx`
- `src/app/sitemap-businesses/[page]/route.ts`
- `src/app/sitemap-blog/[page]/route.ts`
- `src/app/sitemap-categories.xml/route.ts`
- `src/app/sitemap-cities.xml/route.ts`

**Route admin `POST /api/admin/users/[id]/restore`** : annule un soft delete (logge dans `admin_events`).

**Route admin `GET /api/admin/users?includeDeleted=1`** : vue "corbeille" pour admin.

## 14.4 — Trigger `updated_at` automatique

Fonction PG unique `public.__vx_set_updated_at()` + trigger `BEFORE UPDATE FOR EACH ROW` appliqué à toutes les tables ayant une colonne `updated_at` : `users`, `businesses`, `clients`, `appointments`, `quotes`, `blog_posts`, `services`, `faqs`, `working_hours`, `payments`, `reviews`, `notes`, `quote_items`, `notifications`.

Idempotent via `DROP TRIGGER IF EXISTS ... ; CREATE TRIGGER ...`.

**Effet** : `updated_at` est TOUJOURS à jour, même si le code Drizzle oublie de le passer. Le cron `quote-reminders` (WHERE updated_at < now - 7d) devient fiable.

## 14.5 — Documentation `visits_reset_at`

Commentaire ajouté au-dessus de la colonne dans `schema.ts` :
> Timestamp de "reset des stats de visites". Le dashboard analytics ne compte les visites que WHERE `created_at >= visits_reset_at`. Set via `DELETE /api/my-availability` (bouton "Réinitialiser mes stats"). Nullable = pas de reset → toutes les visites depuis le début.

## 14.6 — Table `analytics` supprimée du schéma

Aucune référence dans le code (grep exhaustif). La définition Drizzle + la relation `businessesRelations.analytics` supprimées. La table SQL reste en base pour ne rien perdre — un `DROP TABLE public.analytics;` manuel finalisera si besoin.

## 14.7 — Partitionnement `page_visits`

Non-appliqué automatiquement (trop invasif : rename + INSERT + drop). Documenté dans `docs/DB.md` section "Partitionnement page_visits" avec script SQL complet prêt à copier-coller.

Stratégie recommandée :
1. `RENAME` legacy
2. `CREATE TABLE ... PARTITION BY RANGE (created_at)`
3. Boucle plpgsql qui crée les partitions mensuelles [–6 mois, +12 mois]
4. `INSERT INTO ... SELECT * FROM legacy`
5. `DROP TABLE legacy`
6. Cron mensuel qui crée la partition M+1 (idéalement `pg_partman`)

À déclencher dès que la table dépasse ~5M lignes.

## 14.8 — Cascade delete

Sur les 4 FKs concernées :

| FK | Avant | Après | Justif |
|---|---|---|---|
| `businesses.owner_id → users` | (rien) | `CASCADE` | User supprimé → ses vitrines aussi |
| `appointments.created_by → users` | (rien) | `SET NULL` | RDV conservés (historique) |
| `quotes.created_by → users` | (rien) | `SET NULL` | Devis conservés |
| `notes.created_by → users` (NOT NULL) | (rien) | `CASCADE` | Notes = données perso du créateur |

Le `sql/00_apply_safe.sql` DROP + ADD les FKs avec la bonne politique. Sûr car idempotent + noms de contraintes anciens couverts (`_fkey` et `_users_id_fk`).

## 14.9 — Documentation backups Supabase

`docs/DB.md` section "Backups" :
- Free : 7j quotidiens, pas de PITR
- Pro : 7j + PITR 7j (~$25/mois)
- Team : 30j + PITR 30j
- Reco : passer Pro à > 10 payants actifs, + `pg_dump` mensuel externe S3, + test restauration annuel
- Script `pg_dump | aws s3 cp` fourni pour cron externe

## Fichiers modifiés

- `src/db/schema.ts` — suppression enum dupliqué + table `analytics` + colonnes `deletedAt` + index + doc `visits_reset_at`
- `src/lib/soft-delete.ts` — **NOUVEAU**
- `src/lib/session.ts` — `getCurrentUser` invalide soft-deleted + banned
- `src/app/api/account/route.ts` — soft delete
- `src/app/api/auth/login/route.ts` — refuse soft-deleted
- `src/app/api/blog/[id]/route.ts` — soft delete
- `src/app/api/admin/users/route.ts` — filtre `?includeDeleted=1`
- `src/app/api/admin/users/[id]/restore/route.ts` — **NOUVEAU**
- 8 pages publiques + 4 sitemaps — filtre `deleted_at IS NULL`
- `sql/00_apply_safe.sql` — bloc "Lot 14" (soft delete, trigger, CHECK, cascade) idempotent
- `tests/unit/soft-delete.test.ts` — **NOUVEAU** (5 tests)
- `docs/DB.md` — **NOUVEAU** (400 lignes)

## Validation

```
✅ npx tsc --noEmit          → 0 erreur
✅ npx vitest run            → 164/164 tests passent (19 fichiers)
✅ npx next build            → 0 warning, compilé en 20s
```

## Impact business

- **RGPD-ready** : soft delete + fenêtre 30j de restauration → conforme article 17 + safeguard contre les suppressions accidentelles ("j'ai supprimé mon compte par erreur")
- **Zéro donnée orpheline** : les cascades garantissent la propreté DB après suppression d'un user
- **Pilotage fiable** : `updated_at` toujours à jour → crons reminder / weekly-summary basés dessus deviennent exacts
- **Anti-DoS DB** : personne ne peut plus stocker 1 GB dans une note
- **Roadmap scale** : partitionnement documenté, à activer sans stress dès 5M rows
- **Backups** : plan clair, la boîte survit à un drop DB accidentel

## Actions post-déploiement

1. **Jouer le SQL** dans Supabase (idempotent, ~15 s) :
   ```sql
   -- sql/00_apply_safe.sql
   ```
   Vérifier dans les NOTICES que les triggers `set_updated_at_*` sont bien créés.

2. **Vérifier les CHECK** :
   ```sql
   SELECT conname, pg_get_constraintdef(oid)
   FROM pg_constraint
   WHERE contype = 'c' AND conname LIKE '%length_chk';
   ```

3. **(Optionnel) Purger la table `analytics`** :
   ```sql
   DROP TABLE IF EXISTS public.analytics;
   ```

4. **(Optionnel plus tard) Partitionner `page_visits`** : suivre `docs/DB.md` section 7.

5. **Passer Supabase en plan Pro** dès que le MRR le justifie → active le PITR.

## Historique commits

```
e6c7b4e  lot 14 DB: soft delete, triggers updated_at, CHECK, cascade, partitionnement doc
1b616dc  lot 13 monitoring: Sentry optionnel, alerting webhook, healthcheck étendu, dashboard admin
e4bb4e2  lot 11 stripe: webhook complet (9 events), grace period, portal, trial 14j
6fc7625  lot 10 IA & coûts: client centralisé, quotas mensuels, streaming, prompts externalisés
5c8ccea  lot 9 emails: queue, unsubscribe RGPD, budget SMS, healthcheck DKIM/SPF
11211b5  lot 8 i18n: dictionnaire complet + interpolation + emails + détection auto
8fcc196  lot 6 SEO: sitemap-index paginé, rich snippets, hreflang, slugs propres
7beadb6  lot 5 perf: ISR + SSG, index DB, next/image, next/font, proxy.ts
2c928bb  lot 4 a11y: WCAG AA complet (modal accessible, skip link, focus, contrastes)
5380ed0  lot 3 UI/UX complet: theme, toast, skeletons, onboarding, OG dynamique
f5b3f2b  lots 1+2: sécurité complète + code mort/duplications/dette
```

---

# 🟢 Tour 12 — Lot 13 Monitoring & Observabilité

Adresse les 5 points du Lot 13 de l'audit :
- 13.1 Aucun Sentry
- 13.2 Pas de metrics business
- 13.3 Healthcheck simpliste
- 13.4 Pas de dashboard admin
- 13.5 Pas d'alerting

## 13.1 — Sentry intégré (dépendance optionnelle)

`src/lib/monitoring.ts` centralise `captureException()`, `captureMessage()`, `setMonitoringUser()`.

- Dépendance **optionnelle** : `@sentry/nextjs` chargé via `Function("return require")()` → aucun warning bundler si absent, aucune friction pour un dev qui clone
- Fallback logs structurés (aucun crash sans DSN)
- `severity: "critical"` → alerte webhook automatique
- `instrumentation.ts` initialise Sentry côté node/edge au boot
- `sentry.{client,server,edge}.config.example.ts` fournis pour activation en 30s
- Handler `onRequestError` remonte auto les erreurs non catchées
- Edge runtime détecté et sauté (interdit d'y utiliser `eval`)

Intégré dans :
- `src/lib/api-error.ts` : `handleApiError` → 5xx envoyées à Sentry, 4xx filtrées (bruit)
- `src/app/error.tsx` : boundary route → `captureException` avec severity error
- `src/app/global-error.tsx` (NOUVEAU) : boundary racine → severity critical → alerte immédiate

## 13.2 — Metrics business

`src/lib/metrics.ts` : `getBusinessMetrics()` + `getConversionRate30d()` + `formatEurCents()`.

Agrégats SQL natifs (`COUNT ... FILTER WHERE`), cache 60 s par process, wrapper `safe()` pour tolérer une table absente sans crash :

| Metric | Description |
|---|---|
| **MRR** | Nombre de Pro × 29€ + Premium × 79€ (source : `plans.ts`) |
| **Users** | Total, nouveaux 7j/30j, vérifiés |
| **Subscriptions** | Free/Pro/Premium/trialing/past_due, churn 30j |
| **Appointments** | Total, 7j/30j, à venir (date+start_time futur) |
| **Businesses** | Total, actifs 30j (au moins 1 RDV) |
| **AI** | Nb appels 30j, coût USD cumulé |
| **Conversion 30j** | ratio users payants / nouveaux inscrits |

Route `GET /api/admin/metrics` (auth admin).

## 13.3 — Healthcheck étendu

`GET /api/health` refondu — 6 checks parallèles :

- **db** (critique) : `SELECT 1` avec latence en ms
- **stripe** : `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` présents
- **resend** : `RESEND_API_KEY` + `RESEND_FROM_EMAIL` présents
- **openai** : `OPENAI_API_KEY` présent
- **monitoring** : Sentry actif ou fallback logs
- **alerts** : `ALERT_WEBHOOK_URL` configuré

Réponse 200 si tous les checks critiques passent, 503 sinon. Format compatible **Uptime Kuma / Better Uptime / UptimeRobot**. Inclut `version` (7 premiers chars du commit Vercel) + `env`.

`GET /api/health/email` reste dédié aux checks DNS SPF/DKIM/DMARC (Lot 9).

## 13.4 — Dashboard admin `/dashboard/admin`

Page Server Component avec garde `getAdminUser()` (redirect si pas admin, aucune fuite API).

**Sections** :
- 8 KPI cards : MRR, users, conversion, trials, RDV, vitrines actives, IA, churn
- Table users : recherche live (email/nom/prénom), pagination 25/page, ban/unban inline
- Journal audit : 50 dernières actions admin avec filtres par type

**Composants clients** (`_components/`) :
- `AdminUsersTable.tsx` : recherche + pagination + ban/unban avec toast
- `AdminEventsLog.tsx` : audit log filtrable

**Routes API admin** :
- `GET /api/admin/metrics` : metrics business (cache 60s)
- `GET /api/admin/users?q=&page=&limit=` : liste paginée (max 200/page)
- `POST /api/admin/users/:id/ban` `{ reason }` : ban avec raison, refuse self-ban
- `DELETE /api/admin/users/:id/ban` : unban
- `POST /api/admin/users/:id/plan` `{ plan, expiresAt?, reason? }` : override plan manuel (n'écrit PAS dans Stripe, pour comps/fix)
- `GET /api/admin/events?limit=&action=` : audit log filtrable

**Nouvelles colonnes / tables** :
- `users.banned_at` (timestamp) + `users.ban_reason` (varchar 500) — soft ban
- Table `admin_events` (id, actor_user_id, target_user_id, action, payload jsonb, ip, created_at) + 3 index (actor, target, action) tous DESC créés_at
- FKs `ON DELETE SET NULL` pour préserver l'audit même si l'user est supprimé
- `sql/00_apply_safe.sql` mis à jour (idempotent)

**Login blocké pour user banni** : `src/app/api/auth/login/route.ts` refuse avec message explicite (safe car user connait déjà l'existence de son compte).

**Sidebar** : entrée Admin ajoutée conditionnellement si `role === "admin"`, i18n `adminNav` dans FR/EN/ES/DE.

## 13.5 — Alerting webhook

`src/lib/alerts.ts` : `sendAlert()` non-bloquant, timeout 3s hard, formats Slack (Block Kit) / Discord (embeds) / generic JSON.

**Env vars** :
- `ALERT_WEBHOOK_URL`
- `ALERT_WEBHOOK_TYPE` : `slack` (défaut) | `discord` | `generic`
- `ALERT_MIN_LEVEL` : `warning` | `error` (défaut) | `critical`

**Anti-spam** : throttle 5min par clé `(niveau, titre, route)` — évite le flood en cascade. Purge auto au-delà de 500 entries.

**Déclencheurs** :
- Auto via `captureException(..., { severity: "critical" })`
- Manuel via `sendAlert({ title, level, route, extra })`

## Sécurité / helpers

`src/lib/admin.ts` :
- `requireAdmin()` : throw 401/403 si pas admin, retourne le user sinon
- `getAdminUser()` : version safe pour Server Components (retourne null au lieu de throw)
- `logAdminEvent()` : écrit dans `admin_events` avec IP extraite des headers, non-bloquant (fail silencieux avec log warn)

## Tests

**+ 17 tests, tous verts** (18 fichiers, 159 tests) :
- `monitoring.test.ts` : 5 tests (fallback sans DSN, safe null/undefined, context, edge runtime)
- `alerts.test.ts` : 6 tests (format Slack/Discord, throttle, timeout, min level)
- `metrics.test.ts` : 6 tests (agrégation SQL, cache 60s, safe wrapper, conversion, format EUR)

## Validation

```
✅ npx tsc --noEmit          → 0 erreur
✅ npx vitest run            → 159/159 tests passent (18 fichiers)
✅ npx next build            → 0 warning, compilé en 16s
```

## Impact business

- **Fin de l'aveuglement prod** : erreurs 5xx désormais tracées (logs + Sentry si activé)
- **Alertes temps réel** sur Slack/Discord dès qu'un webhook Stripe échoue, la DB tombe, etc.
- **Ownership métier** : dashboard admin livre MRR, conversion, churn en direct → décisions data-driven
- **Support client accéléré** : recherche user + ban/override plan en 2 clics, plus besoin d'ouvrir Supabase Studio
- **RGPD-ready** : audit trail complet des actions admin (qui a banni qui, quand, IP, raison)
- **Healthcheck compatible** avec tout outil d'uptime → SLA mesurable

## Actions post-déploiement

1. **Jouer le SQL** dans Supabase :
   ```sql
   -- sql/00_apply_safe.sql (idempotent)
   ```
2. **Se promouvoir admin** :
   ```sql
   UPDATE users SET role = 'admin' WHERE email = 'votre-email@example.com';
   ```
3. **(Optionnel) Sentry** (recommandé, offre gratuite 5k events/mois) :
   ```bash
   npm i @sentry/nextjs
   cp sentry.client.config.example.ts sentry.client.config.ts
   cp sentry.server.config.example.ts sentry.server.config.ts
   cp sentry.edge.config.example.ts sentry.edge.config.ts
   # Décommenter le contenu, ajouter SENTRY_DSN + NEXT_PUBLIC_SENTRY_DSN dans Vercel
   ```
4. **(Optionnel) Webhook Slack** : créer un Incoming Webhook et set `ALERT_WEBHOOK_URL` sur Vercel
5. **Uptime monitoring externe** : brancher `https://votredomaine.fr/api/health` sur Better Uptime / Uptime Kuma / UptimeRobot (check chaque 5 min)

## Historique commits

```
1b616dc  lot 13 monitoring: Sentry optionnel, alerting webhook, healthcheck étendu, dashboard admin
e4bb4e2  lot 11 stripe: webhook complet (9 events), grace period, portal, trial 14j
6fc7625  lot 10 IA & coûts: client centralisé, quotas mensuels, streaming, prompts externalisés
5c8ccea  lot 9 emails: queue, unsubscribe RGPD, budget SMS, healthcheck DKIM/SPF
11211b5  lot 8 i18n: dictionnaire complet + interpolation + emails + détection auto
8fcc196  lot 6 SEO: sitemap-index paginé, rich snippets, hreflang, slugs propres
7beadb6  lot 5 perf: ISR + SSG, index DB, next/image, next/font, proxy.ts
2c928bb  lot 4 a11y: WCAG AA complet (modal accessible, skip link, focus, contrastes)
5380ed0  lot 3 UI/UX complet: theme, toast, skeletons, onboarding, OG dynamique
f5b3f2b  lots 1+2: sécurité complète + code mort/duplications/dette
096b2aa  fix(sql): rendre 00_apply_safe.sql tolérant aux tables absentes
89d448b  sql idempotent + audit complet v2 + quick-wins sécurité
```

---

# 🟢 Tour 11 — Lot 11 Stripe & Facturation

## 11.1 — Webhook Stripe complet (7 events)

Avant : 3 events (`checkout.session.completed`, `subscription.updated`, `subscription.deleted`).
Après : **9 events** couvrant tout le cycle de vie SaaS :

| Event | Handler | Effet |
|---|---|---|
| `checkout.session.completed` | `handleCheckoutCompleted` | Active le plan payant |
| `customer.subscription.updated` | `handleSubscriptionUpdated` | Gère active/past_due + grace period |
| `customer.subscription.deleted` | `handleSubscriptionDeleted` | Downgrade `free` |
| `customer.subscription.trial_will_end` | `handleTrialWillEnd` | Email J-3 avant fin de trial |
| `invoice.paid` | `handleInvoicePaid` | **Email de reçu + lien PDF facture Stripe** |
| `invoice.payment_succeeded` | `handleInvoicePaid` | Alias historique |
| `invoice.payment_failed` | `handleInvoicePaymentFailed` | Log (email envoyé par subscription.updated) |
| `invoice.upcoming` | `handleInvoiceUpcoming` | **Email rappel J-3 avant renouvellement** |
| `charge.dispute.created` | `handleDisputeCreated` | Log ERROR + alerte support par email |

Handlers extraits dans **`src/lib/stripe-events.ts`** (testables unitairement, mockables).

Le webhook `/api/stripe/webhook` devient un **simple dispatcher** de 40 lignes qui vérifie la signature et route vers le bon handler.

## 11.2 — Grace period (paiement échoué)

Nouvelles colonnes DB `users` :
- `subscription_status` — miroir du statut Stripe (`active` / `past_due` / `trialing` / `canceled` / `unpaid`)
- `subscription_expires_at` — date de fin de grace period (NULL en temps normal)

**Logique** :
1. `invoice.payment_failed` → Stripe envoie aussi `subscription.updated` avec `status: past_due`
2. Notre handler calcule `now() + GRACE_PERIOD_DAYS[plan]` (3j Pro, 7j Premium) et l'écrit
3. **L'user garde son plan** pendant N jours
4. Email envoyé : "votre paiement a échoué, mettez à jour votre carte"
5. Si le user paye → `subscription.updated` avec `active` → on nettoie `expires_at`
6. Sinon Stripe retente auto (jusqu'à 4× en 3 semaines) → si final échec → `subscription.deleted` → downgrade
7. **Filet de sécurité** : nouveau cron `/api/cron/grace-period-expired` (1×/jour à 3h) downgrade les grace periods expirées si le webhook a été manqué

## 11.3 — Facture PDF envoyée automatiquement

Nouveau handler `handleInvoicePaid` :
- Récupère l'URL du PDF facture Stripe (`invoice.invoice_pdf` — URL signée temporaire)
- Envoie un email "✅ Facture Vitrix — 29 €" avec bouton "Télécharger la facture PDF" + lien vers l'hosted invoice URL
- Utilise le système de queue email (Lot 9) → non-bloquant + retry si Resend down

Pas besoin de générer un PDF nous-mêmes, Stripe le fait mieux (mention légale FR, TVA, numérotation propre).

## 11.4 — Stripe Customer Portal

Nouvelle route **`POST /api/stripe/portal`** :
- Ouvre le Stripe Customer Portal pour le user courant
- Le user peut y : mettre à jour sa CB, télécharger l'historique factures PDF, annuler son abonnement, changer de plan
- Zéro UI custom à maintenir côté nous (Stripe gère tout)
- Retour : `{ url }` que le front redirige

À brancher côté dashboard : bouton "Gérer mon abonnement" → POST puis `window.location = url`.

## 11.5 — Source unique des plans (`src/lib/plans.ts`)

Avant : prix éclatés dans `PricingSection.tsx`, `utils.ts`, Stripe Dashboard → divergence garantie.
Après : **module canonique** :

- `PLANS: Record<PlanId, PlanDefinition>` = source de vérité (nom, tagline, prix mensuel/annuel, trial, features)
- `getDisplayPlans()` : plans + économies annuelles pour la UI
- `getStripePriceId(plan, billing)` : lookup Stripe Price ID depuis env
- `getPriceCents(plan, billing)` : cents attendus par Stripe (pour vérif)
- `GRACE_PERIOD_DAYS` : `{ pro: 3, premium: 7 }`

`stripe.ts createSubscriptionSession()` refondu :
- Utilise `getStripePriceId()` (plus de duplication du mapping)
- **Active le trial 14 jours** sur la 1ère subscription (`isFirstSubscription`)
- `end_behavior.missing_payment_method: "cancel"` → si pas de CB à J-14 → annulation propre (RGPD friendly)
- `payment_method_collection: "always"` → CB requise dès inscription
- `allow_promotion_codes: true` → codes promos disponibles au checkout
- Nouvelle fonction `createPortalSession()` pour le Customer Portal

## 11.6 — Doc `stripe listen` complète

Nouveau **`docs/STRIPE.md`** (400+ lignes) :
- Configuration Stripe Dashboard (Products, Prices, Webhook endpoint)
- Installation Stripe CLI (macOS + Linux)
- Commandes `stripe login` + `stripe listen --forward-to`
- 6 commandes `stripe trigger` pour tester chaque event
- Cartes de test Stripe utiles (succès, refus, 3DS, dispute)
- Explication détaillée du flow grace period
- Section trial 14 jours
- Debugging (webhook 400, past_due éternel, vérif SQL état d'un user)
- Coûts Stripe

## Cron additionnel : grace-period-expired

Nouvelle route **`/api/cron/grace-period-expired`** :
- Sélectionne les users avec `subscription != 'free' AND subscription_expires_at < now()`
- Downgrade en `free`
- Envoie un email "votre compte est repassé en Gratuit"
- Ajouté à `vercel.json` avec cron `0 3 * * *` (3h du matin, hors pic Stripe)

## Tests unitaires (+22 : 120 → 142)

- `tests/unit/plans.test.ts` (12 tests) :
  - Définition des 3 plans + trial + rabais annuel (-20%)
  - `getPriceCents` → 2900, 27800, 7900, 75800
  - `getDisplayPlans` : ordre + économies + effectiveMonthly
  - `getStripePriceId` (free → null, lecture env, env vide)
  - `GRACE_PERIOD_DAYS` : pro=3, premium=7

- `tests/unit/stripe-events.test.ts` (10 tests) avec **mocks db/email/logger** :
  - `handleCheckoutCompleted` : active pro, ignore metadata manquant, ignore plan invalide
  - `handleSubscriptionUpdated` past_due → grace 3j (Pro) ou 7j (Premium)
  - `handleSubscriptionUpdated` active → nettoie expiration
  - `handleSubscriptionUpdated` free en past_due → no-op
  - `handleSubscriptionDeleted` → downgrade immédiat

## Validations finales

```
tsc --noEmit  → 0 erreur
vitest run    → 142/142 tests OK
next build    → Compiled successfully, 42/42 pages, 0 warning
              → Nouvelles routes: /api/stripe/portal, /api/cron/grace-period-expired
```

## Migration DB requise

Rejouer `sql/00_apply_safe.sql` sur Supabase → ajoute 2 colonnes à `users` :
- `subscription_status varchar(30)`
- `subscription_expires_at timestamp`
+ un index `users_subscription_expires_idx`

## Nouvelles variables d'environnement (optionnelles)

| Variable | Défaut | Description |
|---|---|---|
| `STRIPE_SUPPORT_EMAIL` | — | Email d'alerte reçoit les notifications `charge.dispute.created` |

Les 4 `STRIPE_PRICE_ID_*` étaient déjà attendus.

## Configuration Dashboard Stripe requise

Ajouter ces events dans Webhooks → Add endpoint :
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.trial_will_end`
- `invoice.paid` (ou `invoice.payment_succeeded`)
- `invoice.payment_failed`
- `invoice.upcoming` *(nécessite d'activer dans Settings → Billing → Notifications)*
- `charge.dispute.created`

Activer aussi Settings → Billing → Customer Portal (voir `docs/STRIPE.md`).

---

# Historique tours précédents

- `6fc7625` — Tour 10 : Lot 10 IA & coûts (client centralisé, quotas, streaming, prompts)
- `5c8ccea` — Tour 9 : Lot 9 emails (queue, unsubscribe RGPD, budget SMS)
- `11211b5` — Tour 8 : Lot 8 i18n
- `8fcc196` — Tour 7 : Lot 6 SEO
- `7beadb6` — Tour 6 : Lot 5 perf
- `2c928bb` — Tour 5 : Lot 4 a11y
- `5380ed0` — Tour 4 : Lot 3 UI/UX
- `f5b3f2b` — Tour 3 : Lots 1+2 (sécurité + code mort)
- `096b2aa` — Fix SQL tolérant tables absentes
- `89d448b` — SQL idempotent + audit v2
- `e642e8b` — Tour 2 : favicon, Vercel/IONOS
- `4c25f9c` — Tour 1 : sécurité fondamentale
