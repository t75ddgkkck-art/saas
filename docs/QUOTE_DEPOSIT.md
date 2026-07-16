# Acompte à la signature du devis (Lot 43 — Fusion F2 + F8)

Objectif : encaisser un acompte Stripe **au moment exact** où le client signe le devis,
en un seul flow — sans lui demander de "rappeler pour l'acompte".

## Cadre business

Avant Lot 43 :
- Le devis pouvait avoir un `depositAmount` configuré → affiché en **texte informatif**
  sur la page de signature (« Acompte demandé à la signature : 300 € »)
- Aucune collecte réelle. Le pro devait relancer manuellement.

Après Lot 43 :
- Signature → redirection auto Stripe Checkout → paiement → confirmation
- L'acompte est encaissé **directement sur le compte Stripe Connect du pro**
  (pas de transit Vitrix)
- Traçabilité complète : `payments` (type=deposit, quoteId lié) + `quotes.depositPaidAt`

## Conditions cumulatives pour proposer l'acompte

Toutes doivent être vraies dans `POST /api/quotes/sign` :

1. `quote.depositAmount > 0`
2. Montant en centimes ≥ 50 (min Stripe EUR)
3. `business.enableStripe = true` ET `business.stripeAccountId` renseigné (Connect actif)
4. Owner du business a l'entitlement `payments.stripe` (plan Pro+)
5. `STRIPE_SECRET_KEY` configuré en env (via `isStripeConfigured()`)

**Si une seule condition manque → retour classique** (signature confirmée sans checkoutUrl).
La signature reste toujours prioritaire : jamais bloquée par un problème d'acompte.

## Flow complet

```
Client → /devis/[token]                        (peek)
       → POST /api/quotes/sign
              ├── UPDATE quote (signature persistée)
              ├── notifyAsync(quote.accepted)
              ├── void generateInvoiceForSignedQuote(quoteId)  ← Lot 42, F&F
              └── createQuoteDepositCheckoutSession()          ← Lot 43
                    └── réponse { ok, checkoutUrl, depositAmountCents }
       ← QuoteSignFlow détecte checkoutUrl
       ← Affiche "Devis signé ✍️ — Payer l'acompte 300 € maintenant"
       ← Auto-redirect Stripe après 4s (ou clic bouton immédiat)
       → Stripe Checkout
       → success → /devis/paye?quote=<id>
                    └── SELECT quote → si depositPaidAt renseigné : "Merci"
                                     → sinon (webhook pas encore arrivé) : "En cours" + meta-refresh 5s

Stripe webhook (async) → handleCheckoutCompleted
                         └── metadata.type === "quote_deposit"
                             └── handleQuoteDepositCompleted
                                   ├── UPDATE quote (depositPaidAt=now)
                                   ├── INSERT payments (type=deposit, quoteId=...)
                                   └── notifyAsync(deposit.paid) au pro
```

## Découplage strict signature ↔ paiement

**Règle d'or** : la signature du devis ne dépend JAMAIS du succès Stripe.

- Si `createQuoteDepositCheckoutSession()` throw → `POST /sign` catch et renvoie
  la signature sans checkoutUrl. Le pro pourra relancer manuellement.
- Si le client abandonne le Stripe Checkout → le devis reste signé, `deposit_paid_at`
  reste null. Le pro peut le voir dans son dashboard et relancer.
- Si le webhook n'arrive jamais (rare, mais possible en cas de panne) → la signature
  n'est pas impactée. Le paiement peut être rejoué manuellement via portail Stripe.

## Colonnes DB ajoutées

Bloc SQL idempotent `4sexdecies` :

```sql
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS stripe_deposit_session_id varchar(255),
  ADD COLUMN IF NOT EXISTS deposit_amount_cents      integer,
  ADD COLUMN IF NOT EXISTS deposit_paid_at           timestamp;

CREATE INDEX IF NOT EXISTS quotes_stripe_deposit_session_idx
  ON quotes (stripe_deposit_session_id)
  WHERE stripe_deposit_session_id IS NOT NULL;
```

- `stripe_deposit_session_id` — id session Checkout Stripe, renseigné à la création
- `deposit_amount_cents` — snapshot centimes au moment de la signature (immuable
  même si le pro change le `depositAmount` du devis après)
- `deposit_paid_at` — renseigné par le webhook, source de vérité pour "acompte reçu"

## Webhook Stripe — dispatch

`handleCheckoutCompleted(event)` dispatche selon `session.metadata.type` :

| Type              | Handler                              | Table cible    | Lot |
| ----------------- | ------------------------------------ | -------------- | --- |
| `booking_deposit` | `handleBookingDepositCompleted`      | `appointments` | 30  |
| `quote_deposit`   | `handleQuoteDepositCompleted`        | `quotes`       | 43  |
| _(absent)_        | subscription flow (`users`)          | `users`        | 11  |

`handleCheckoutExpired(event)` — pour `quote_deposit` : on nettoie juste le pointeur
`stripe_deposit_session_id` (contrairement à `booking_deposit` qui libère le slot RDV).
La signature n'est pas révoquée.

## Lien avec Lot 42 (facture)

Quand `generateInvoiceForSignedQuote()` s'exécute (fire-and-forget à la signature) :
- Si le webhook Stripe est déjà passé → `quote.depositPaidAt` est set → la facture
  PDF affiche automatiquement dans ses `notes` :
  ```
  Acompte de 300.00 € déjà versé le 2026-07-16 (paiement Stripe).
  Reste à régler : 900.00 €.
  ```
- Si le webhook n'est pas encore passé (cas fréquent, race async) → la facture est
  émise sans mention acompte. C'est OK légalement : l'acompte apparaîtra sur la
  ligne `payments` du dashboard.

Pour une facture toujours à jour post-webhook, prévoir en Lot 44+ une régénération
automatique de la facture au webhook `deposit.paid`.

## UX écrans

**QuoteSignFlow** (dans `/devis/[token]`) :
- Nouvel écran intercalaire quand `checkoutUrl` reçu :
  - Icône ✅ verte
  - "Devis signé ✍️ — Dernière étape : verrouiller votre créneau avec un acompte de 300 €"
  - Bouton "Payer l'acompte maintenant" (redirect Stripe)
  - Auto-redirect après 4s
- Si pas d'acompte → écran "Merci" classique inchangé

**`/devis/paye?quote=X`** (nouveau) :
- 3 états :
  - Success + `depositPaidAt` renseigné → "Acompte reçu ✅"
  - Success + `depositPaidAt` absent → "Paiement en cours…" + `<meta refresh=5>`
  - `?canceled=1` → "Paiement annulé. Le devis reste signé"

## Sécurité

- Aucune modification possible du montant côté client : `depositAmount` lu depuis
  la DB (jamais depuis le body du POST)
- Le webhook Stripe vérifie la signature `whsec_` (existant depuis Lot 11)
- Idempotence webhook garantie par `stripe_deposit_session_id` unique + check
  `depositPaidAt` avant update

## Tests unitaires

`tests/unit/quote-deposit-webhook.test.ts` — 7 tests couvrant :
- Dispatch metadata.type (route quote vs booking)
- Insert payments avec metadata correct
- Idempotence (rejoue = no-op)
- Metadata manquante (warn silent)
- Devis introuvable (warn silent)
- amount_total = 0 (défensif)

## Actions post-déploiement

1. **DB migration** : `bash sql/apply.sh` — bloc `4sexdecies` s'ajoute
2. **Configurer Stripe Connect** pour les pros qui veulent recevoir des acomptes
   (déjà en place depuis Lot 30, rien à faire côté infra)
3. **Vérifier webhook** : dans le dashboard Stripe, le webhook doit écouter
   `checkout.session.completed` ET `checkout.session.expired`
4. **Test end-to-end recommandé** :
   - Créer un devis test avec `depositAmount = 50 €`
   - Générer lien signature → signer via `/devis/[token]`
   - Vérifier redirect Stripe
   - Payer avec carte test `4242 4242 4242 4242`
   - Vérifier : `quotes.deposit_paid_at` renseigné, `payments` avec `quoteId` créé,
     notif `deposit.paid` dans le dashboard pro
