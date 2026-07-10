# Acompte à la réservation (F2 — Lot 30)

## Objectif business

Un acompte non-remboursable élimine 80% des no-show chez les artisans (source : études sectorielles France Bleu). Différenciateur MAJEUR vs concurrents français (Simplébo, Solocal, ProwebCE).

## Flow visiteur

1. Sur `/[slug]`, le client sélectionne un service qui a un acompte configuré
2. Il remplit le formulaire de RDV normalement
3. Le front POST `/api/book-appointment/deposit-checkout` (au lieu de `/api/book-appointment`)
4. Le backend :
   - Vérifie la config (business Stripe connecté, service existe, acompte > 0.50€)
   - Vérifie l'entitlement `payments.stripe` du pro
   - Réserve le slot (`isBooked = true`)
   - Crée un RDV en **`status: pending`**, `depositStatus: pending`
   - Crée une session Stripe Checkout Connect (expire dans 30 min)
   - Retourne l'URL Checkout
5. Le client est redirigé vers Stripe pour payer
6. Deux issues :
   - **Paiement réussi** → webhook `checkout.session.completed` → RDV `confirmed`, `depositStatus: paid`, ligne dans `payments` (type=deposit)
   - **Abandon/expiration** → webhook `checkout.session.expired` → RDV soft-deleted, slot libéré

## Configuration pro

### Par service (`dashboard/vitrine > Services & Tarifs`)

Un composant `<ServiceDepositEditor>` s'affiche sous chaque service :

- **Prix du service** (obligatoire pour acompte en %)
- **Type d'acompte** : Aucun / Montant fixe / Pourcentage
- **Montant** : centimes si fixed, 0-100 si percent

Le composant montre un **preview live** du montant que le client paiera.

Gaté sur `payments.stripe` : les users Free voient un lien vers `/pricing`.

### Politique de remboursement (business)

`dashboard/vitrine > Paiements > Politique de remboursement d'acompte` :

- Jamais remboursé automatiquement (gestion manuelle)
- Toujours remboursé si annulation
- Remboursé si annulation ≥ 24h / 48h / 72h / 7j avant

## Modèle de données

### `services` (nouvelles colonnes)

- `price_cents INTEGER` — prix numérique en centimes (parallèle au champ legacy `price VARCHAR`)
- `deposit_type VARCHAR(10)` — `"fixed"` | `"percent"` | `NULL`
- `deposit_amount INTEGER` — centimes si fixed, 0-100 si percent

CHECK : `deposit_type IN ('fixed','percent') OR NULL` + si `percent`, `1 ≤ deposit_amount ≤ 100`.

### `businesses` (nouvelle colonne)

- `deposit_refund_hours INTEGER` — fenêtre de remboursement (heures avant RDV). `NULL` = jamais auto.

### `appointments` (nouvelles colonnes)

- `deposit_required BOOLEAN NOT NULL DEFAULT false`
- `deposit_amount_cents INTEGER`
- `deposit_status deposit_status` — `"pending"` | `"paid"` | `"refunded"` | `"forfeited"`
- `stripe_checkout_session_id VARCHAR(255)`

Index :
- `appointments_deposit_scan_idx` sur `(deposit_status, created_at) WHERE deposit_status = 'pending'` — pour le cron d'expiration
- `appointments_stripe_session_idx` sur `stripe_checkout_session_id` — lookup rapide webhook

### `stripe_webhook_events` (nouvelle table, bonus B27)

- `event_id VARCHAR PRIMARY KEY`
- `type VARCHAR NOT NULL`
- `processed_at TIMESTAMP DEFAULT now()`

**Idempotence** : `INSERT ON CONFLICT DO NOTHING` sur `event.id` — si l'event a déjà été traité (retry Stripe), on skip proprement.

## Logique métier centralisée (`src/lib/deposit.ts`)

- `computeDepositCents(service)` — calcul fixed/percent avec cap au prix total + arrondi entier
- `requiresDeposit(service)` — booléen
- `decideRefundOnCancel({refundHours, appointmentStart, cancelledAt})` — retourne `"refunded"` ou `"forfeited"`
- `formatCentsEur(cents)` — locale fr-FR
- `describeDeposit(service)` — phrase humaine ("20 % soit 6,00 €")

Toutes les valeurs manipulées en **centimes** pour éviter les erreurs float.

## Handlers Stripe (`src/lib/stripe-events.ts`)

- `handleCheckoutCompleted(event)` — dispatch :
  - `metadata.type === "booking_deposit"` → `handleBookingDepositCompleted`
  - sinon → flow subscription classique (inchangé)
- `handleBookingDepositCompleted(event)` :
  - Récupère le RDV par `stripe_checkout_session_id`
  - Si déjà `depositStatus = "paid"` → skip (idempotence métier double)
  - Update RDV `status=confirmed`, `depositStatus=paid`
  - Insert ligne `payments` (type=deposit)
- `handleCheckoutExpired(event)` :
  - Cible uniquement les RDV `depositStatus=pending` avec la session correspondante
  - Libère le slot
  - Soft-delete le RDV (status=cancelled, deletedAt=now)

## Cron sanity (`/api/cron/expire-deposits`)

Ceinture-bretelles : passe toutes les 30 min et nettoie les RDV `pending` créés il y a > 45 min qui n'auraient pas reçu de webhook `checkout.session.expired`.

Sécurisé par `CRON_SECRET`.

## Sécurité

- Route publique `/api/book-appointment/deposit-checkout` rate-limitée **3/10min/IP** (créer une session Stripe coûte + risque de flood les créneaux pending)
- Validation Zod stricte (`serviceId` UUID obligatoire, prix ≥ 50 cts Stripe min)
- Gate d'entitlement sur le pro (`payments.stripe`)
- Idempotence webhook via `stripe_webhook_events`
- Idempotence métier : `depositStatus === "paid"` bloque le rejeu
- Metadata Stripe échelonnées sur session ET payment_intent pour tracing

## Environnements requis

- `STRIPE_SECRET_KEY` — clé Stripe secrète (déjà présente pour les subs)
- `STRIPE_WEBHOOK_SECRET` — secret webhook (déjà présent)
- `CRON_SECRET` — pour le cron sanity (déjà présent)

Aucune nouvelle env var.

## Tests (33 unit)

- `tests/unit/deposit.test.ts` — 26 tests
  - `computeDepositCents` : fixed, percent, cap prix, arrondi banquier, priceCents null, 100%, > 100 ceinture-bretelles
  - `decideRefundOnCancel` : null hours, 0 hours, exactement à la fenêtre, dans/hors fenêtre, string ISO
  - `formatCentsEur`, `describeDeposit`
- `tests/unit/deposit-webhook.test.ts` — 7 tests
  - Dispatch `handleCheckoutCompleted` deposit vs subscription
  - Cas nominal deposit : update RDV + insert payment
  - **Idempotence** : rejouer un event déjà traité = no-op
  - RDV introuvable → no-op
  - Metadata incomplet → no-op

## Roadmap

- **v1** (livré) : acompte fixed/percent, refund policy, cron sanity, webhook idempotent
- **v2** : bouton "Rembourser" dans le dashboard avec `refundDeposit()` déjà implémentée dans `stripe.ts`
- **v3** : rappel J-1 email/SMS avec bouton "Confirmer ma venue" — réduit encore les no-show
- **v4** : politique de report (déplacer le RDV plutôt qu'annuler garde l'acompte)
