# Intégration Stripe — Guide dev & prod

## Vue d'ensemble

Vitrix utilise Stripe pour :

1. **Abonnements SaaS** (Pro/Premium mensuel/annuel) — souscription des pros
2. **Stripe Connect** (Standard) — paiements client → pro sur la vitrine
3. **Customer Portal** — gestion CB/factures par l'utilisateur

Source de vérité côté code : `src/lib/plans.ts`. Doit rester synchronisé avec le Dashboard Stripe.

---

## 1. Configuration Stripe Dashboard

### Créer les Prix (Products & Prices)

Dans Stripe Dashboard → **Products → Add product** :

| Product            | Prix mensuel | Prix annuel |
| ------------------ | ------------ | ----------- |
| **Vitrix Pro**     | 29 €/mois    | 278 €/an    |
| **Vitrix Premium** | 79 €/mois    | 758 €/an    |

Après création, notez les 4 **Price IDs** (`price_xxx...`).

### Variables d'env Vercel

```
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_ID_PRO_MONTHLY=price_xxx
STRIPE_PRICE_ID_PRO_YEARLY=price_xxx
STRIPE_PRICE_ID_PREMIUM_MONTHLY=price_xxx
STRIPE_PRICE_ID_PREMIUM_YEARLY=price_xxx
# Optionnel : email d'alerte pour les litiges (chargebacks)
STRIPE_SUPPORT_EMAIL=support@vitrix.fr
```

### Configurer le Webhook

Stripe Dashboard → **Developers → Webhooks → Add endpoint** :

- **URL** : `https://vitrix.fr/api/stripe/webhook`
- **Events à écouter** (7 obligatoires) :
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `customer.subscription.trial_will_end`
  - `invoice.paid` (ou `invoice.payment_succeeded`)
  - `invoice.payment_failed`
  - `invoice.upcoming` _(activer aussi dans Settings → Billing → Notifications)_
  - `charge.dispute.created`

- Récupérez le **Signing secret** → `STRIPE_WEBHOOK_SECRET`

### Activer le Customer Portal

Dashboard Stripe → **Settings → Billing → Customer Portal** :

- Activer "Allow customers to update payment methods"
- Activer "Allow customers to view invoices and receipts"
- Activer "Allow customers to cancel subscriptions"

---

## 2. Test local avec Stripe CLI

### Installation

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Linux
curl -s https://packages.stripe.dev/api/security/keypair/stripe-cli-gpg/public | gpg --dearmor > /usr/share/keyrings/stripe.gpg
echo "deb [signed-by=/usr/share/keyrings/stripe.gpg] https://packages.stripe.dev/stripe-cli-debian-local stable main" | sudo tee /etc/apt/sources.list.d/stripe.list
sudo apt update && sudo apt install stripe
```

### Login

```bash
stripe login
```

### Forwarder les webhooks vers le local

Dans un terminal, laisser tourner :

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Stripe affiche un secret temporaire → à coller dans votre `.env.local` :

```
STRIPE_WEBHOOK_SECRET=whsec_temp_xxx
```

### Déclencher un événement manuellement

Dans un autre terminal :

```bash
# Cycle complet checkout + subscription
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger invoice.paid

# Simuler un paiement échoué (test grace period)
stripe trigger invoice.payment_failed

# Simuler la fin de trial
stripe trigger customer.subscription.trial_will_end

# Simuler un litige (chargeback)
stripe trigger charge.dispute.created
```

Chaque `stripe trigger` créé un compte Stripe test + subscription et envoie l'event. Vos handlers `src/lib/stripe-events.ts` doivent recevoir l'event et logger correctement.

### Cartes de test utiles

- `4242 4242 4242 4242` — Visa succès
- `4000 0000 0000 9995` — Visa refusée (fond insuffisant)
- `4000 0025 0000 3155` — 3D Secure requis
- `4000 0000 0000 0341` — Génère un dispute automatiquement 24h après

Documentation complète : https://docs.stripe.com/testing

---

## 3. Grace period (paiement échoué)

Quand `invoice.payment_failed` arrive :

1. `customer.subscription.updated` avec `status: "past_due"` est aussi envoyé
2. Notre handler `handleSubscriptionUpdated` détecte `past_due` et fixe `subscription_expires_at = now() + N jours` (3j Pro, 7j Premium)
3. Le user garde son plan pendant N jours
4. Un email "mettez à jour votre carte" est envoyé
5. Si le user paye → `customer.subscription.updated` avec `status: "active"` → on nettoie `subscription_expires_at`
6. Sinon Stripe retente automatiquement (jusqu'à 4 fois sur 3 semaines)
7. Si tout échoue → `customer.subscription.deleted` → downgrade `free`
8. **Filet de sécurité** : cron `/api/cron/grace-period-expired` (1×/jour) rattrape si le webhook n'a pas été traité

---

## 4. Trial 14 jours

Configuré dans `src/lib/plans.ts` (`trialDays: 14`). Actif automatiquement :

- Uniquement sur la **première** subscription (`isFirstSubscription` check)
- `end_behavior.missing_payment_method: "cancel"` → si pas de CB à J-14, annulation propre
- `payment_method_collection: "always"` → CB requise dès l'inscription (pas de trial anonyme)
- Email J-3 avant fin : `handleTrialWillEnd`

---

## 5. Types d'événements traités

| Event                                  | Handler                      | Effet                                        |
| -------------------------------------- | ---------------------------- | -------------------------------------------- |
| `checkout.session.completed`           | `handleCheckoutCompleted`    | Active le plan payant du user                |
| `customer.subscription.updated`        | `handleSubscriptionUpdated`  | Gère active/past_due/canceled + grace period |
| `customer.subscription.deleted`        | `handleSubscriptionDeleted`  | Downgrade `free` immédiat                    |
| `customer.subscription.trial_will_end` | `handleTrialWillEnd`         | Email J-3 avant fin de trial                 |
| `invoice.paid`                         | `handleInvoicePaid`          | Email de reçu + lien PDF facture Stripe      |
| `invoice.payment_succeeded`            | `handleInvoicePaid`          | Alias historique                             |
| `invoice.payment_failed`               | `handleInvoicePaymentFailed` | Log (email envoyé par subscription.updated)  |
| `invoice.upcoming`                     | `handleInvoiceUpcoming`      | Email rappel J-3 avant renouvellement        |
| `charge.dispute.created`               | `handleDisputeCreated`       | Log ERROR + alerte support par email         |

Tout autre event reçu → loggé en `debug`, réponse 200 OK (Stripe considère comme traité).

---

## 6. Débogage

### Le webhook renvoie 400 "Signature invalide"

- Vérifier `STRIPE_WEBHOOK_SECRET` correspond au bon endpoint (test vs live)
- Le body doit être lu en **texte brut** (pas parsé JSON avant vérif) — c'est bien le cas dans notre route

### Le webhook renvoie 200 mais rien ne se passe côté DB

- `event.type` n'est peut-être pas dans `HANDLERS` → check `logger` : `stripe.webhook.unhandled { type }`
- `metadata.userId` manque dans la subscription/session → check qu'on la passe bien à la création (voir `stripe.ts createSubscriptionSession`)

### Le user est bloqué en "past_due" éternellement

- Le webhook `customer.subscription.updated` avec `status: "active"` doit être arrivé après le paiement retenté
- Filet de sécurité : `/api/cron/grace-period-expired` va downgrader à J+3/J+7
- En dernier recours : depuis le Stripe Dashboard, annuler la subscription → `customer.subscription.deleted`

### Vérifier l'état DB d'un user

```sql
SELECT id, email, subscription, subscription_status, subscription_expires_at,
       stripe_customer_id, stripe_subscription_id
FROM users
WHERE email = 'user@example.com';
```

---

## 7. Coûts Stripe

- Abonnements : **0.4 % + 25c** par transaction (frais européens)
- Sur 29 €/mois : ~0.37 € de frais → **28.63 € nets**
- Webhook events : gratuits
- Customer Portal : gratuit
- Stripe Connect Standard : gratuit pour vous (les pros paient les frais sur leurs propres transactions)
