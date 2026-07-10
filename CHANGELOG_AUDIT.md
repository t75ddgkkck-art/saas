# 🛠️ Améliorations issues de l'audit

Ce document liste **exactement** ce qui a changé. Rapport détaillé dans [`AUDIT_REPORT.md`](./AUDIT_REPORT.md) et [`AUDIT_FULL_V2.md`](./AUDIT_FULL_V2.md).

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
