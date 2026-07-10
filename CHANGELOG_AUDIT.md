# 🛠️ Améliorations issues de l'audit

Ce document liste **exactement** ce qui a changé. Rapport détaillé dans [`AUDIT_REPORT.md`](./AUDIT_REPORT.md) et [`AUDIT_FULL_V2.md`](./AUDIT_FULL_V2.md).

---

# 🟢 Tour 16 — Lot 18 Quick-fixes bloquants + 404 devis

Adresse les bugs bloquants identifiés dans l'audit "état actuel" :
- B1 Dark mode Tailwind v4 cassé (toggle inefficace)
- B2 + B3 ai-chat "Assistant Dupont Plomberie" hardcodé
- B9 Register n'envoyait pas `referralCode` (Lot 16 mort-né côté client)
- B11 NotifBell + ThemeToggle inaccessibles sur mobile (enfermés dans sidebar)
- B12 Badge notification qui déborde du parent
- B13 CookieConsent + SupportBubble superposés en bas d'écran
- B14 Dates render-time dans CGU/Confidentialité → hydration mismatch
- B15 **404 devis** — pages 100% mock, pas de vraie route API
- B18 Button sans `type="button"` par défaut → submit accidentel
- B19 `<img>` natifs dans blog + gallery
- +170 remplacements ciblés `text-slate-400 → text-slate-500` (contraste AA)

## B1 — Dark mode Tailwind v4 CLASS-based

`src/app/globals.css` : ajout de `@custom-variant dark (&:where(.dark, .dark *))`.

**Cause** : Tailwind v4 par défaut n'active `dark:` que via `prefers-color-scheme`. Notre `THEME_INIT_SCRIPT` ajoutait bien `.dark` sur `<html>` mais les classes `dark:bg-slate-900` étaient ignorées → **le toggle clair/sombre ne faisait rien**.

**Fix** : la custom-variant re-branche `dark:` sur la présence de la classe `.dark` (ou sur ses enfants). Toggle fonctionnel.

**Test de non-régression** : `tests/unit/theme-dark-mode.test.ts` (2 tests) lit `globals.css` et vérifie la présence de la directive.

## B2 + B3 — Assistant IA dynamique

`src/app/dashboard/ai-chat/page.tsx` :
- Titre `<CardTitle>Assistant {businessName ?? "IA"}</CardTitle>` — jamais "Dupont Plomberie" en dur
- Message d'accueil construit par `buildInitialMessage(businessName)` : "notre équipe" tant que le business n'est pas chargé, puis remplacé automatiquement par le vrai nom
- Ne remplace le message d'accueil QUE s'il n'y a pas déjà eu de conversation (évite d'écraser un chat en cours)

## B9 — Register envoie `referralCode`

`src/app/register/page.tsx` :
- Lecture de `?ref=VX-XXXXXX` via `window.location.search` en `useEffect` (évite le wrap Suspense de `useSearchParams` Next 15)
- Validation format côté client (`/^VX-[0-9A-Z]{6}$/`) avant envoi
- Payload `POST /api/auth/register` inclut désormais `referralCode` (Lot 16 accepte déjà)
- **Feedback visuel** : badge vert "Parrainé par VX-XXXXXX" affiché sous le titre du formulaire → rassure l'user, incite à finaliser

## B11 — Topbar mobile persistante

**Nouveau composant** `src/components/layout/MobileTopBar.tsx` :
- Fixed top-right, `<lg` uniquement (`.lg:hidden`)
- Reprend `ThemeToggle` + `NotificationBell` (source unique de vérité)
- Backdrop blur pour lisibilité au-dessus de tout contenu
- Ne recouvre pas le burger (positionnement `right-3 top-3` vs burger `left-4 top-4`)

Branché dans `src/app/dashboard/layout.tsx`.

## B12 — Badge NotificationBell dans les clous

`src/components/layout/NotificationBell.tsx` :
- Repositionné `top-1.5 right-1.5` (à l'intérieur du bouton) au lieu de `-top-0.5 -right-0.5` (débordait)
- Taille réduite `h-4 min-w-4` + `border-2 border-white dark:border-slate-900` pour la séparation visuelle
- Cap à `9+` au-dessus de 9 (évite le grossissement avec grands nombres)

## B13 — CookieConsent + SupportBubble empilés proprement

`src/components/layout/SupportBubble.tsx` : `bottom-40` sur mobile (au-dessus de la bannière consent qui fait ~140px), `sm:bottom-6` en desktop (bannière consent centrée max-w-3xl → plus d'overlap).

## B14 — Dates figées au build

`src/app/cgu/page.tsx` et `src/app/confidentialite/page.tsx` :
- Const `LAST_UPDATED = "10/07/2026"` au lieu de `new Date().toLocaleDateString("fr-FR")` render-time
- Élimine le risque d'hydration mismatch (timezone/locale server ≠ client)
- À bumper manuellement quand on modifie vraiment le texte

## B15 — 404 devis + vraies pages CRUD (le gros du lot)

**Cause** : `dashboard/quotes/page.tsx` = liste 100% mock (Marie Dupont, DEV-2025-001), `quotes/[id]/page.tsx` = détail 100% mock (Ambiance Service, business hardcodé), `/api/quote-pdf?quoteId=DEV-2025-001` retournait 404 car ces IDs n'existent pas en DB.

**Nouvelles routes API** :
- `GET /api/quotes` — liste des devis du business courant, jointure clients, filtre `deleted_at IS NULL`
- `POST /api/quotes` — création : Zod strict (max 50 lignes, quantité 1-9999, prix 0-999999, taxRate 0-100), rate-limit 20/h, résolution client par UUID OU upsert-par-phone à la volée, anti-IDOR sur `clientId`, génération auto `DEV-YYYY-NNNN` par business+année, transaction quote+items atomique, dispatch webhook `quote.sent`
- `GET /api/quotes/[id]` — détail avec items + client, ownership check business (anti-IDOR)

**Refonte totale `dashboard/quotes/page.tsx`** :
- Fetch réel `/api/quotes`, `useState<QuoteRow[] | null>` pour distinguer chargement vs vide
- Skeletons pendant le loading, EmptyState avec CTA "Créer un devis"
- KPIs calculés à la volée (total, en attente, acceptés, montant total)
- Modal création COMPLET : client à la volée, N lignes ajoutables/supprimables, sous-total live, TVA affichée, validation avant POST
- Toasts d'erreur/succès (plus d'`alert()`)
- Lien détail `/dashboard/quotes/${q.id}` avec UUID réel
- Lien PDF `/api/quote-pdf?quoteId=${q.id}` avec UUID réel → **plus de 404**
- Responsive mobile : grid `sm:` propres, actions accessibles

**Refonte totale `dashboard/quotes/[id]/page.tsx`** :
- `use(params)` (Next 15+), fetch réel `/api/quotes/${id}` + `/api/my-business` en parallèle
- État d'erreur clean : page "Devis introuvable" avec bouton retour au lieu de crash blanc
- **B7 corrigé** : `generateProfessionalPDF` reçoit le vrai business context (nom, adresse, SIRET, phone, email) au lieu d'"Ambiance Service" en dur
- Aperçu PDF inline avec vrai UUID
- Signature affichée via `next/image unoptimized` (data-URL)
- Loading state en Skeletons

**Test contract** : `tests/unit/quotes-api.test.ts` (8 tests) valide le schéma Zod (accepte valide, rejette items vides, titre vide, quantité 0/négative, email invalide, clientId non-UUID = anti-IDOR côté schéma qui rejette l'ancien format mock, plafond 50 lignes).

## B18 — Button `type="button"` par défaut

`src/components/ui/Button.tsx` :
- `type={type ?? "button"}` — le default HTML `submit` était piégeux dans un `<form>`
- Aucune régression : les 6 usages `type="submit"` (register step 3, login) restent explicites

## B19 — `<img>` → `next/image`

- `src/app/[slug]/blog/[postSlug]/page.tsx` : cover article
- `src/app/[slug]/blog/page.tsx` : cover cards blog listing
- `src/app/dashboard/gallery/page.tsx` : gallery cards (import lucide `Image` renommé en `ImageIcon` pour laisser `NextImage` clair)

Bénéfice : AVIF/WebP auto, lazy loading, dimensions responsive via `sizes`, LCP amélioré.

Non modifiés (data-URL ou HTML string interne) : `qr-code/page.tsx`, template imprimable inline.

## Contraste AA — pass ciblé

Remplacement `text-sm text-slate-400` → `text-sm text-slate-500` et `text-xs text-slate-400` → `text-xs text-slate-500` sur ~13 fichiers (descriptions, paragraphes info). Reste `text-slate-400` = 257 usages (dessin/icônes/decoratif) → à traiter en Lot 22 UX cohérente avec un audit visuel.

## Fichiers modifiés/créés

**Nouveaux** :
- `src/components/layout/MobileTopBar.tsx`
- `src/app/api/quotes/route.ts` (GET + POST)
- `src/app/api/quotes/[id]/route.ts` (GET)
- `tests/unit/theme-dark-mode.test.ts` (2 tests)
- `tests/unit/quotes-api.test.ts` (8 tests)

**Modifiés** :
- `src/app/globals.css` — `@custom-variant dark`
- `src/app/dashboard/ai-chat/page.tsx` — business dynamique
- `src/app/register/page.tsx` — `?ref=` + envoi backend + badge visuel
- `src/app/dashboard/layout.tsx` — branche `MobileTopBar`
- `src/components/layout/NotificationBell.tsx` — badge repositionné
- `src/components/layout/SupportBubble.tsx` — `bottom-40 sm:bottom-6`
- `src/components/ui/Button.tsx` — `type="button"` default
- `src/app/cgu/page.tsx` — LAST_UPDATED const
- `src/app/confidentialite/page.tsx` — LAST_UPDATED const
- `src/app/dashboard/quotes/page.tsx` — refonte totale
- `src/app/dashboard/quotes/[id]/page.tsx` — refonte totale + business context réel
- `src/app/[slug]/blog/page.tsx` — next/image
- `src/app/[slug]/blog/[postSlug]/page.tsx` — next/image
- `src/app/dashboard/gallery/page.tsx` — next/image (rename Image → ImageIcon)
- ~13 fichiers : `text-slate-400` → `text-slate-500` sur descriptions

## Validation

```
✅ npx tsc --noEmit    → 0 erreur
✅ npx vitest run      → 199/199 tests (26 fichiers, +10 nouveaux)
✅ npx next build      → 0 warning, compilé en 18s
```

## Impact business

- **Dark mode fonctionnel** : le toggle utilisateur marche enfin (un user sur deux préfère le mode sombre)
- **Assistant IA crédible** : plus jamais "Assistant Dupont Plomberie" sur le compte d'un autre pro
- **Parrainage réellement branché** : Lot 16 devient vraiment utilisable (croissance virale débloquée)
- **Mobile utilisable** : notifications + toggle theme accessibles sans ouvrir le menu
- **Devis 100% fonctionnels** : plus de 404, création + listing + détail + PDF avec vrai business context
- **Formulaires safes** : plus de submit accidentel
- **Perf blog + gallery** : LCP -20 à -40% probable (AVIF/WebP + lazy)

## Actions post-déploiement

Aucune migration SQL nécessaire (Lot 18 = pure code).

**Le user devrait** :
1. Purger son cache navigateur pour tester le nouveau dark mode
2. Vérifier que le badge notification s'affiche bien dans les clous sur mobile
3. Créer un devis test pour valider le flow complet (création → liste → détail → PDF)
4. Tester `/register?ref=VX-XXXXXX` avec un code parrain existant → doit afficher le badge vert

## Historique commits

```
6c6632c  lot 18 quick-fixes: dark mode v4, ai-chat dynamique, mobile topbar, badge notif, devis 404 fixé
a8a2908  lot 16 business: parrainage, API v1 + webhooks sortants, support bubble, statuspage
725b991  lot 15 légal/RGPD: CGU+DPA, confidentialité, mentions légales, export, consent, cron purge
2696a9f  lot 14 DB: soft delete, triggers updated_at, CHECK, cascade, partitionnement doc
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

# 🟢 Tour 15 — Lot 16 Business & Produit

Adresse les 6 points du Lot 16 :
- 16.1 Aucune analytique de conversion → **déjà couvert Lot 13** (dashboard admin `conversion 30j`, MRR, churn)
- 16.2 Pas de trial 14 jours → **déjà couvert Lot 11** (Stripe trial + grace period)
- 16.3 Pas de parrainage → **fait**
- 16.4 Pas de public API / webhooks sortants → **fait**
- 16.5 Support (chat + statuspage) → **fait**
- 16.6 Programme d'affiliation → **structure prête** (réutilise le parrainage, dashboard reporting TODO)

## 16.3 — Parrainage complet

**Schéma** (`sql/00_apply_safe.sql` idempotent) :
- `users.referral_code` varchar(20) — code unique `VX-XXXXXX` généré au register (base32 Crockford sans I/O/L/U)
- `users.referred_by` uuid FK → users(id) `ON DELETE SET NULL` (préserve historique filleul)
- `users.referral_credit_months` integer DEFAULT 0
- Index unique partiel `users_referral_code_uidx WHERE referral_code IS NOT NULL`
- Index `users_referred_by_idx` pour reverse lookup

**Code** (`src/lib/referral.ts`) :
- `generateReferralCode()` : format `VX-XXXXXX` — 32^6 = 1 milliard d'entrée, collision quasi-impossible
- `generateUniqueReferralCode()` : re-tirage jusqu'à 10× si collision DB
- `resolveReferralCode(code)` : safe (retourne null si banni/soft-deleted/format invalide)
- `creditReferrer(id, months)` : `UPDATE ... SET credit = credit + N` (fire and forget côté webhook Stripe)
- `consumeReferralCredit(id, months)` : décrément avec `greatest(x - n, 0)` (jamais négatif)

**Intégration register** : `src/app/api/auth/register/route.ts` accepte `referralCode` en body, résout côté serveur AVANT la transaction, stocke `referredBy` sur le nouveau user. Génération d'un `referralCode` unique pour le nouveau user dans la même transaction.

**Intégration webhook Stripe** : `src/lib/stripe-events.ts` → `handleCheckoutCompleted` relit le user, si `referredBy` défini → `creditReferrer(referredBy, 1)`. Fire-and-forget : jamais bloquant sur le happy path Stripe.

**Route dashboard** : `GET /api/account/referral` → code + shareUrl pré-formatée + stats (totalReferred, paidReferred) + creditMonths accumulés.

## 16.4 — API publique v1

**Auth API keys** (`src/lib/api-keys.ts`) :
- Format `vx_live_<24 chars base32>` (ou `vx_test_` en dev)
- Stockage : **SHA-256 hex** uniquement, jamais la clé claire
- Prefix visible 12 chars pour identifier dans logs (ex: `vx_live_A3F7`)
- `authenticateApiKey(req)` : lit `Authorization: Bearer` OU `X-Api-Key`, update `last_used_at` fire-and-forget
- Scopes : `read` (défaut) / `read_write`
- Table `api_keys` : userId + businessId FK (isolation stricte), révocation soft via `revoked_at`

**Helper `src/lib/public-api.ts`** : `requireApiKey(req, requireWrite?)` retourne `{ ok, auth }` ou `{ ok: false, response }`. Rate-limit 60/min par clé automatique.

**Routes v1 livrées** :
- `GET /api/v1/me` → business info (sans données sensibles user/Stripe)
- `GET /api/v1/appointments?limit=&cursor=&status=` → paginé cursor-based, filtre `deleted_at IS NULL`
- `POST /api/v1/appointments` (scope=read_write) → crée RDV, résout client via `clientId` OU création à la volée par `phone`, anti-IDOR, dispatch webhook `appointment.created`
- `GET /api/v1/clients?limit=&cursor=` → paginé cursor-based

**Routes de gestion (dashboard)** :
- `GET /api/account/api-keys` — liste sans hash/raw
- `POST /api/account/api-keys` `{ name, scope }` — retourne rawKey **1×** avec warning
- `DELETE /api/account/api-keys/[id]` — révocation soft
- Limite : 10 clés actives / user

## 16.4 — Webhooks sortants

**Tables** :
- `webhook_endpoints` (url HTTPS requise, events jsonb array, signingSecret 64 chars, failureCount, disabledAt)
- `webhook_deliveries` (event, payload, responseStatus, responseBody 500 chars, success, attemptCount) + 2 index (endpoint+created, retry)

**Lib `src/lib/webhooks-out.ts`** :
- `dispatchWebhook(event, businessId, data)` — fire-and-forget non-bloquant
- `deliverWebhooks()` (interne, testable) : récupère endpoints actifs abonnés, POST parallèle avec signature HMAC
- `signWebhookBody(body, secret, ts)` — format compat Stripe `t=<ts>,v1=<hex>`
- Timeout 5s hard via `AbortController`
- Chaque tentative loggée dans `webhook_deliveries` (audit/debug)
- **5 échecs consécutifs → `disabled_at = NOW()` auto**
- 7 events : `appointment.{created,updated,cancelled}`, `payment.received`, `quote.{sent,signed}`, `review.received`
- `events: []` = catch-all (utile Zapier)

**Routes gestion** :
- `POST /api/account/webhooks` `{ url (HTTPS), events? }` → retourne signingSecret **1×**
- `GET /api/account/webhooks` → liste + `availableEvents`
- `DELETE /api/account/webhooks/[id]` → hard delete (historique préservé dans deliveries)
- Limite : 5 endpoints / user

**Câblage initial** : `dispatchWebhook("appointment.created", ...)` déjà appelé dans `POST /api/v1/appointments`. Les autres events (payment, quote, review) sont à câbler au fil des lots futurs — la lib est prête.

## 16.5 — Support

**`src/components/layout/SupportBubble.tsx`** — bouton flottant bas-droite du dashboard, 3 modes :
- `NEXT_PUBLIC_CRISP_ID` défini → charge widget Crisp officiel (aucune dépendance NPM ajoutée, script injecté dynamiquement)
- `NEXT_PUBLIC_INTERCOM_APP_ID` défini → charge Intercom idem
- Sinon → fallback `mailto:` vers `NEXT_PUBLIC_LEGAL_EMAIL`

Aucune requête externe si pas d'env → build reste léger et privacy-safe par défaut.

**Statuspage `/status`** :
- Server Component avec revalidate ISR 30s
- Fetch `/api/health` (Lot 13), affichage par service avec latence + détail
- Bandeau global vert/rouge selon `ok`
- Ajoutée au footer landing + sitemap statique
- Version commit + env affichés en bas

## 16.6 — Affiliation (structure prête)

Le parrainage 16.3 fournit toute la fondation :
- Code unique par user
- Tracking filleuls + crédit
- Route dashboard `/api/account/referral` avec stats

Extensions futures marketing (hors scope Lot 16) :
- Landing dédiée `/affiliation`
- Dashboard reporting clics/conversions
- Commission via Stripe Connect payout

Documenté dans `docs/BUSINESS.md` section 5.

## Fichiers modifiés/créés

**Schéma DB** :
- `src/db/schema.ts` — colonnes users (referral_*), tables `api_keys`, `webhook_endpoints`, `webhook_deliveries`, import `AnyPgColumn`
- `sql/00_apply_safe.sql` — bloc "4ter Lot 16" idempotent (~110 lignes SQL)

**Libs nouvelles** :
- `src/lib/referral.ts` (3 tests)
- `src/lib/api-keys.ts` (7 tests)
- `src/lib/webhooks-out.ts` (5 tests)
- `src/lib/public-api.ts`

**Routes API publiques v1** :
- `src/app/api/v1/me/route.ts`
- `src/app/api/v1/appointments/route.ts` (GET + POST)
- `src/app/api/v1/clients/route.ts`

**Routes gestion dashboard** :
- `src/app/api/account/api-keys/route.ts` (GET + POST)
- `src/app/api/account/api-keys/[id]/route.ts` (DELETE)
- `src/app/api/account/webhooks/route.ts` (GET + POST)
- `src/app/api/account/webhooks/[id]/route.ts` (DELETE)
- `src/app/api/account/referral/route.ts` (GET)

**UI & pages** :
- `src/app/status/page.tsx` — statuspage publique ISR 30s
- `src/components/layout/SupportBubble.tsx` — Crisp/Intercom/mailto
- `src/app/dashboard/layout.tsx` — branche SupportBubble
- `src/app/page.tsx` — footer lien Statut
- `src/app/sitemap-static.xml/route.ts` — ajout `/status`

**Register + webhook Stripe** :
- `src/app/api/auth/register/route.ts` — accepte `referralCode`, résout, génère code unique
- `src/lib/stripe-events.ts` — crédit parrain au `checkout.session.completed`

**Tests (+15)** :
- `tests/unit/referral.test.ts` (3)
- `tests/unit/api-keys.test.ts` (7)
- `tests/unit/webhooks-out.test.ts` (5)

**Doc** :
- `docs/BUSINESS.md` — spec complète parrainage + API + webhooks + support + affiliation

## Validation

```
✅ npx tsc --noEmit    → 0 erreur
✅ npx vitest run      → 189/189 tests (24 fichiers, +15 nouveaux)
✅ npx next build      → 0 warning, compilé en 17s
```

## Impact business

- **Croissance virale gratuite** : parrainage automatisé → chaque user peut ramener +N filleuls sans marketing spend
- **Marché B2B débloqué** : API publique + webhooks = branchement Zapier / Make / n8n / compta / Sage → gros deals possibles
- **Confiance** : statuspage publique montre la transparence sur les incidents → réduction du churn en cas de panne
- **Réduction coût support** : Crisp/Intercom optionnels, sinon mailto suffisant en early stage
- **Développeur experience** : la doc API est prête pour publier une v1 sur GitBook / Redocly le jour où on veut

## Actions post-déploiement

1. **Jouer `sql/00_apply_safe.sql`** dans Supabase (idempotent, ~20s)
2. **Rétroactif référent** : les users existants n'ont pas de code — script SQL fourni dans `docs/BUSINESS.md` §6 pour en attribuer un
3. **(Optionnel) Setup Crisp** : `NEXT_PUBLIC_CRISP_ID` sur Vercel — l'app détecte et charge le widget
4. **Documenter l'API publique en externe** : `docs/BUSINESS.md` peut être publié tel quel en Markdown sur GitBook / Notion / `/docs/api`
5. **Câbler les autres `dispatchWebhook`** au fil des lots suivants (`payment.received` dans webhook Stripe, `quote.signed` dans route de signature, `review.received` dans création avis)

## Historique commits

```
a8a2908  lot 16 business: parrainage, API v1 + webhooks sortants, support bubble, statuspage
725b991  lot 15 légal/RGPD: CGU+DPA, confidentialité, mentions légales, export, consent, cron purge
2696a9f  lot 14 DB: soft delete, triggers updated_at, CHECK, cascade, partitionnement doc
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

# 🟢 Tour 14 — Lot 15 Légal & RGPD

Adresse les 5 points du Lot 15 de l'audit :
- 15.1 CGU / Confidentialité : contenu manquait (DPO, base légale, transferts hors UE, durées)
- 15.2 Aucun consent banner cookies
- 15.3 Pas de mention légale visible (obligation LCEN)
- 15.4 Aucun DPA (Data Processing Agreement) pour la sous-traitance
- 15.5 Pas d'export ni de vraie suppression compte RGPD

## 15.1 — Refonte CGU et politique de confidentialité

**CGU (`src/app/cgu/page.tsx`)** — refonte complète, 14 sections + sommaire ancré :
1. Objet et acceptation
2. Éditeur (renvoi mentions légales)
3. Inscription et accès (SIRET INSEE, ID/pass personnels)
4. Abonnements, prix, résiliation (trial 14j, grace period 3/7j)
5. Droit de rétractation B2B (art. L221-3 CC)
6. Paiements Stripe Connect (délimitation responsabilité)
7. Contenu publié (garanties, LCEN)
8. Avis clients (anti-faux avis)
9. Responsabilité (limitation au montant annuel versé)
10. Données personnelles (renvoi confidentialité)
11. **DPA article 28** ← 15.4 (voir ci-dessous)
12. Force majeure (art. 1218 CC)
13. Modification des CGU (préavis 30j)
14. Droit applicable + juridictions

**Confidentialité (`src/app/confidentialite/page.tsx`)** — refonte complète, 9 sections avec tableaux :
- Distinction responsable/sous-traitant explicite
- Tableau 8 catégories de données avec finalité + base légale (art. 6.1)
- Tableau 6 sous-traitants nominatifs avec localisation et garanties
- Section transferts hors UE (CCT + EU-US DPF)
- Tableau 6 durées de conservation (compte, factures 10 ans, logs 12 mois…)
- Section sécurité (bcrypt, TLS, HMAC, rate-limit, Sentry, backups)
- Détail des droits RGPD art. 15-22 avec liens vers actions produit
- Lien vers CNIL pour réclamation
- Contact DPO séparé du contact général

Toutes les données volatiles (nom éditeur, email, SIREN…) sont **paramétrées via env vars** (`NEXT_PUBLIC_LEGAL_*`) — voir `docs/RGPD.md` section 2.

## 15.2 — Consent banner cookies

**`src/lib/consent.ts`** : helper pur (7 tests unitaires) :
- `readConsent()` / `writeConsent(value)` / `resetConsent()`
- Version stockée dans `localStorage` avec check de version (invalidation possible si politique change)
- Valeurs : `"essential"` (défaut safe) | `"all"` (préparé pour futur analytics)
- Safe SSR (no-op si `window` absent), safe mode privé strict (try/catch silencieux)
- **Pas de cookie** pour stocker le consent (ironique mais nécessaire pour éviter le paradoxe)

**`src/components/layout/CookieConsent.tsx`** : bannière bas d'écran :
- role="dialog" + aria-labelledby + aria-describedby (a11y AA)
- 2 boutons : "Essentiels uniquement" / "Tout accepter"
- Auto-masque si choix déjà fait
- Message précise que Vitrix n'a **actuellement aucun cookie non-essentiel** → transparence maximale
- Branchée dans `src/app/layout.tsx` sous ToastProvider

⚠ **Aucun tracker ajouté par ce lot** — la bannière prépare le terrain pour un futur Plausible/GA/PostHog. À ce moment-là, respecter le choix `essential` de l'user avant d'injecter le script.

## 15.3 — Mentions légales

**`src/app/mentions-legales/page.tsx`** — obligatoire LCEN 2004-575 :
- Éditeur : dénomination, forme, capital, adresse, RCS, SIREN, TVA, email, téléphone
- Directeur de la publication
- Hébergeur (Vercel Inc., 340 S Lemon Ave Walnut CA)
- Registrar (IONOS SARL, Sarreguemines)
- Section signalement de contenu illicite (LCEN art. 6-I-5, accusé sous 48h)
- Propriété intellectuelle (Vitrix + contenu users)

Ajoutée au sitemap statique + footer landing + settings dashboard.

## 15.4 — DPA (Data Processing Agreement)

Intégré comme **section 11 des CGU** — accepté par tout user à la souscription. Couvre les 7 obligations RGPD art. 28 :
1. Objet du traitement
2. Durée (abonnement + 30j)
3. Catégories de données
4. Obligations sous-traitant (instructions documentées, confidentialité, notif 72h)
5. Sous-traitants ultérieurs (autorisation générale + liste)
6. Transferts hors UE (CCT + EU-US DPF)
7. Fin du contrat (restitution export JSON en 30j)
+ clause audit

Un DPA formel séparé peut être signé sur demande (mailto).

## 15.5 — Export RGPD + soft suppression (branchée Lot 14)

**Portabilité (art. 20)** — `GET /api/account/export` :
- Rate limit strict : 3/heure/user
- Retourne un JSON téléchargeable `vitrix-mes-donnees-YYYY-MM-DD.json` avec header `Content-Disposition`
- Helper `src/lib/rgpd-export.ts` : collecte user + businesses + clients + appointments + quotes + payments + blogPosts + reviews + services + aiUsage + emailOptouts
- **passwordHash exclu** (via déstructuration, jamais dans l'output) — testé
- Format versionné `meta.format: "vitrix-rgpd-v1"`
- Bouton "Télécharger mes données" dans `Settings → Suppression`

**Droit à l'oubli (art. 17)** — chaîne complète :
- T0 : `DELETE /api/account` (Lot 14) fait un soft delete immédiat + purge cookies
- T+30j : **nouveau cron** `/api/cron/purge-deleted` fait le vrai `DELETE` sur users/businesses/clients/appointments/quotes/blog_posts où `deleted_at < NOW() - 30 days`
- Message settings amélioré : explique clairement les 30 jours de rétention
- Rétention overridable via env `RGPD_PURGE_DAYS` (1-365)
- Erreur cron → alerte Sentry `severity: "critical"` + webhook Slack

**vercel.json** : cron `purge-deleted` schedulé `30 3 * * *` (30min après grace-period-expired pour éviter la collision).

## Fichiers modifiés/créés

- `src/app/cgu/page.tsx` — refonte complète (14 sections + DPA)
- `src/app/confidentialite/page.tsx` — refonte complète (9 sections + 3 tableaux)
- `src/app/mentions-legales/page.tsx` — **NOUVEAU**
- `src/lib/consent.ts` — **NOUVEAU** (7 tests)
- `src/components/layout/CookieConsent.tsx` — **NOUVEAU**
- `src/app/layout.tsx` — branche `<CookieConsent />`
- `src/lib/rgpd-export.ts` — **NOUVEAU** (3 tests)
- `src/app/api/account/export/route.ts` — **NOUVEAU**
- `src/app/api/cron/purge-deleted/route.ts` — **NOUVEAU**
- `src/app/dashboard/settings/page.tsx` — bouton "Télécharger mes données" + message 30j
- `src/app/page.tsx` — footer : lien Mentions légales
- `src/app/sitemap-static.xml/route.ts` — ajout `/mentions-legales`
- `vercel.json` — cron `purge-deleted` à 3h30
- `tests/unit/consent.test.ts` — **NOUVEAU** (7 tests)
- `tests/unit/rgpd-export.test.ts` — **NOUVEAU** (3 tests, dont vérif exclusion passwordHash)
- `docs/RGPD.md` — **NOUVEAU** (~250 lignes)

## Validation

```
✅ npx tsc --noEmit    → 0 erreur
✅ npx vitest run      → 174/174 tests (21 fichiers, +10 nouveaux)
✅ npx next build      → 0 warning, compilé en 19s
```

## Impact business

- **Conformité RGPD réelle** (plus juste "on prétend") : DPA, exercice des droits automatisé, notification CNIL préparée
- **Vend-ready B2B** : les clients pros qui ont eux-mêmes des obligations RGPD envers leurs propres clients peuvent maintenant demander notre DPA (clause CGU) ou un DPA formel séparé
- **Anti-friction juridique** : mentions légales visibles → pas de mise en demeure LCEN, pas de blocage APB / CCI
- **Réputation** : bannière cookies **honnête** (annonce zéro tracker) → point différenciant vs concurrents envahis de GA/FB pixel
- **Automatisation de la purge** : plus jamais de "j'ai supprimé mon compte il y a 6 mois pourquoi mes données sont encore là" → conformité article 17 vraiment appliquée

## Actions post-déploiement

1. **Remplir toutes les env vars `NEXT_PUBLIC_LEGAL_*` sur Vercel** (voir liste dans `docs/RGPD.md` §2)
2. **Faire relire les CGU + confidentialité par un avocat** — le contenu est un cadre technique solide, PAS une validation juridique
3. **Setup `CRON_SECRET`** sur Vercel si pas déjà fait — protège tous les crons
4. **Optionnel** : setup `RGPD_PURGE_DAYS` si vous voulez une rétention différente de 30 jours
5. **Optionnel** : signer un DPA formel avec chaque sous-traitant (téléchargeable sur leurs sites : stripe.com/legal/dpa, supabase.com/dpa…)
6. **Vérifier le cron** dans Vercel dashboard après J+31 : `total` > 0 dans les logs
7. **Tester l'export** sur son propre compte admin : ouvrir `/dashboard/settings → Suppression → Télécharger mes données` → vérifier JSON complet

## Historique commits

```
725b991  lot 15 légal/RGPD: CGU+DPA, confidentialité, mentions légales, export, consent, cron purge
2696a9f  lot 14 DB: soft delete, triggers updated_at, CHECK, cascade, partitionnement doc
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
2696a9f  lot 14 DB: soft delete, triggers updated_at, CHECK, cascade, partitionnement doc
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
