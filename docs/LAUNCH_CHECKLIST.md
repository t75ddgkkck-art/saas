# 🚀 Checklist de lancement Vitrix

Guide pratique pour passer de "code sur GitHub" à "app en production sur son domaine".

**Temps estimé** : 2-3 heures pour un premier déploiement complet.

---

## 📋 Étape 0 : Prérequis (compte à créer avant tout)

- [ ] **GitHub** — pour héberger le code (le repo est déjà là)
- [ ] **Vercel** — hébergement Next.js (plan gratuit OK pour démarrer, Pro à 20$/mois quand > 100 GB bandwidth)
- [ ] **Supabase** — base PostgreSQL + Storage (plan gratuit : 500 MB DB, 1 GB storage — largement suffisant pour démarrer)
- [ ] **Stripe** — paiements (compte gratuit, commissions ~1.5% + 0.25€/transaction)
- [ ] **Resend** — emails transactionnels (3000 emails/mois gratuits)
- [ ] **Ionos** (ou Namecheap/OVH) — nom de domaine (~10€/an pour un .fr)
- [ ] **OpenAI** — pour features IA (crédit initial 5$ suffit pour tester)
- [ ] **Cloudflare** — DNS + Turnstile captcha (gratuit)

---

## 🗄️ Étape 1 : Base de données (Supabase)

- [ ] Créer un nouveau projet Supabase (région `eu-west-3` pour France, latence < 50ms depuis Vercel `cdg1`)
- [ ] Récupérer la connection string **Pooler** (Settings → Database → Connection string → **Transaction** mode)
      Format : `postgresql://postgres.[REF]:[PWD]@aws-0-eu-west-3.pooler.supabase.com:6543/postgres`
- [ ] Créer un bucket Storage `vitrix-uploads` en **public** (Storage → New bucket)
- [ ] Récupérer `SUPABASE_URL` + `service_role_key` (Settings → API)
- [ ] **Appliquer le schéma DB** :

  ```bash
  psql "$DATABASE_URL" -f sql/00_apply_safe.sql
  ```

  Ce script est **100% idempotent** — safe à rejouer N fois, même sur une DB déjà partielle. Il applique 14 blocs de migrations (lots 14 → 38).

- [ ] Vérifier : `psql "$DATABASE_URL" -c "\dt public.*"` → doit lister ~35 tables.

---

## 💳 Étape 2 : Stripe

- [ ] Créer un compte Stripe (mode test d'abord, live plus tard après KYB)
- [ ] Récupérer `STRIPE_SECRET_KEY` (`sk_test_...` → `sk_live_...` en prod)
- [ ] Créer **4 produits récurrents** dans Dashboard Stripe → Products :
  - "Vitrix Pro mensuel" — prix 29€/mois → copier le `price_id`
  - "Vitrix Pro annuel" — prix 278€/an
  - "Vitrix Premium mensuel" — prix 79€/mois
  - "Vitrix Premium annuel" — prix 758€/an
- [ ] Créer un webhook endpoint (Dashboard Stripe → Developers → Webhooks) :
  - URL : `https://votre-app.vercel.app/api/stripe/webhook`
  - Events à cocher (10) :
    - `checkout.session.completed`
    - `checkout.session.expired`
    - `customer.subscription.updated`
    - `customer.subscription.deleted`
    - `customer.subscription.trial_will_end`
    - `invoice.paid`
    - `invoice.payment_succeeded`
    - `invoice.payment_failed`
    - `invoice.upcoming`
    - `charge.dispute.created`
  - Récupérer le `whsec_...` → `STRIPE_WEBHOOK_SECRET`

---

## 📧 Étape 3 : Emails (Resend)

- [ ] Créer un compte Resend
- [ ] **Ajouter votre domaine** (Domains → Add domain → `votre-domaine.fr`)
- [ ] Copier les 3 records DNS (SPF, DKIM, DMARC) → ajouter dans Ionos/Cloudflare
- [ ] Attendre la vérification (10 min à 24h selon TTL)
- [ ] Récupérer `RESEND_API_KEY` (API Keys → Create)
- [ ] Set `RESEND_FROM_EMAIL=noreply@votre-domaine.fr` (DOIT être sur le domaine vérifié)

**Test rapide** :

```bash
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"from":"noreply@votre-domaine.fr","to":"votre@email","subject":"Test","html":"<p>OK</p>"}'
```

---

## 🤖 Étape 4 : OpenAI (features IA)

- [ ] Créer un compte sur https://platform.openai.com
- [ ] Ajouter 5$ de crédit (couvre ~5000 devis IA générés)
- [ ] Créer une clé API projet-scoped (sk-proj-...) → `OPENAI_API_KEY`
- [ ] (Optionnel) Set `OPENAI_MODEL=gpt-4o-mini` (meilleur ratio coût/qualité)
- [ ] Set un **hard limit** dans le dashboard OpenAI (Billing → Usage limits) — protection contre les emballements

---

## 🌐 Étape 5 : Domaine (Ionos → Vercel)

- [ ] Acheter le domaine sur Ionos (ex : `vitrix.fr`)
- [ ] Sur Vercel : Project Settings → Domains → Add `vitrix.fr` + `www.vitrix.fr`
- [ ] Suivre les instructions Vercel pour ajouter les records DNS chez Ionos :
  - `A` pour apex : `76.76.21.21`
  - `CNAME` pour www : `cname.vercel-dns.com`
- [ ] Attendre la propagation DNS (5 min à 4h)
- [ ] Vercel émet automatiquement le certificat SSL Let's Encrypt

**Redirect www → apex** (ou l'inverse selon préférence) : géré nativement par Vercel.

---

## 🚢 Étape 6 : Déploiement Vercel

- [ ] Push le code sur GitHub (`main` par défaut)
- [ ] Sur Vercel : Import Project → sélectionner le repo
- [ ] Framework preset : Next.js (auto-détecté)
- [ ] Node.js version : `>= 20.18` (fichier `.nvmrc`)
- [ ] Region : `cdg1` (Paris — pour utilisateurs FR)
- [ ] **Environment Variables** — coller la liste complète du `.env.example` avec vos vraies valeurs :
  - REQUIS BASE : `NEXT_PUBLIC_APP_URL`, `DATABASE_URL`, `NEXTAUTH_SECRET`, `CRON_SECRET`
  - REQUIS PAIEMENT : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, 4 price IDs
  - REQUIS EMAIL : `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
  - Puis les optionnelles selon vos besoins
- [ ] **Vérifier avant deploy** : lancer localement `npm run env:check` avec les mêmes vars pour attraper les erreurs de config
- [ ] Deploy → attendre le premier build (~2 min)

**Post-deploy** :

- [ ] Ouvrir `https://votre-app.vercel.app/api/health` → vérifier `ok: true` et le statut de chaque intégration
- [ ] Créer un compte test sur `/register`
- [ ] Vérifier réception email de vérification

---

## 🔐 Étape 7 : Sécurité renforcée (recommandé)

### Cloudflare Turnstile (captcha)

- [ ] Créer un site sur https://dash.cloudflare.com/?to=/:account/turnstile
- [ ] Récupérer `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`
- [ ] Ajouter dans Vercel env vars → redeploy

### Push notifications OS

- [ ] `npm install web-push` (localement pour générer les keys)
- [ ] `npx web-push generate-vapid-keys` → 2 clés
- [ ] Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:contact@votre-domaine.fr`
- [ ] **Important** : `npm install web-push --save` doit être fait dans le repo pour que Vercel ait la dep au runtime
- [ ] Redeploy

### Google Calendar sync

- [ ] Créer un projet Google Cloud Console
- [ ] Activer les APIs : Calendar API + People API + Google Business Profile (si utilisé)
- [ ] Créer un OAuth 2.0 Client ID (Web application)
- [ ] Redirect URIs autorisés :
  - `https://votre-domaine.fr/api/google/calendar/callback`
  - `https://votre-domaine.fr/api/google/callback` (Business Profile)
- [ ] `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` dans Vercel

### Sentry monitoring (production only)

- [ ] Créer un projet Sentry (5 GB/mois gratuit)
- [ ] `npm install @sentry/nextjs --save`
- [ ] `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN`
- [ ] Redeploy

---

## ⏰ Étape 8 : Crons Vercel

**Automatique via `vercel.json`** — dès le premier deploy, Vercel active les 8 crons :

| Cron                                  | Fréquence         | Rôle                                  |
| ------------------------------------- | ----------------- | ------------------------------------- |
| `/api/cron/quote-reminders`           | 9h quotidien      | Rappels devis en attente 7j           |
| `/api/cron/weekly-summary`            | Dimanche 18h      | Résumé hebdo au pro                   |
| `/api/cron/reminder-sms`              | 8h quotidien      | Rappels SMS RDV du jour               |
| `/api/cron/grace-period-expired`      | 3h quotidien      | Downgrade Pro/Premium expirés         |
| `/api/cron/purge-deleted`             | 3h30 quotidien    | Purge RGPD comptes soft-deleted > 30j |
| `/api/cron/payment-reminders`         | 10h quotidien     | Relance impayés J+7/J+15/J+30         |
| `/api/cron/expire-deposits`           | Toutes les 30 min | Libère créneaux acompte non payé      |
| `/api/cron/reactivation`              | Mardi 11h         | Email users inactifs 30-90j           |
| `/api/cron/quote-signature-reminders` | 10h quotidien     | Rappels signature devis J+3/J+7/J+15  |

- [ ] Vérifier que les crons s'exécutent : Vercel Dashboard → Cron Jobs → voir les runs
- [ ] Chaque cron requiert `CRON_SECRET` (Vercel l'injecte automatiquement dans header `Authorization`)

---

## 📊 Étape 9 : Monitoring & uptime

- [ ] Configurer un uptime checker externe pointant sur `/api/health` :
  - **Better Stack** — gratuit 10 monitors, ping /min
  - **Uptime Kuma** — self-hosted gratuit
  - **UptimeRobot** — gratuit 50 monitors, ping /5min
- [ ] Alerte email/SMS si `status != 200` pendant > 2 min
- [ ] (Optionnel) Alertes Slack/Discord via `ALERT_WEBHOOK_URL` pour les erreurs 5xx internes

---

## ⚖️ Étape 10 : Conformité légale (avant lancement public)

- [ ] Compléter les mentions légales : `/mentions-legales` (SIRET, RCS, hébergeur, éditeur)
- [ ] Vérifier `/confidentialite` et `/cgu` (déjà pré-remplis mais à personnaliser)
- [ ] Enregistrer un DPO externe si CA > 250K€ ou données sensibles (RGPD art. 37)
- [ ] Signer un DPA (Data Processing Agreement) avec Supabase, Stripe, Resend, OpenAI (les 4 en fournissent)
- [ ] Déclarer un fichier RGPD interne (traitement des données clients — modèle CNIL)
- [ ] Vérifier que le bandeau CookieConsent apparaît bien au premier visite
- [ ] Souscrire une assurance RC pro (~200€/an pour un SaaS solo)

---

## 🎯 Étape 11 : Post-lancement (H+1 à H+24)

- [ ] Créer un compte utilisateur de test réel et exécuter tout le parcours :
  1. Register → verify email → login
  2. Onboarding : compléter le business
  3. Créer un service → publier la vitrine
  4. Réserver un RDV en tant que client (autre navigateur)
  5. Confirmer le RDV côté pro
  6. Générer un devis IA → envoyer à signature → signer
  7. Encaisser un paiement depuis /dashboard/today
  8. Vérifier tous les emails reçus
- [ ] Vérifier `/api/health` : tous les checks critical à `ok: true`
- [ ] Vérifier logs Vercel (Functions logs) : pas d'erreur 500 récurrente
- [ ] Vérifier `/dashboard/analytics` : la visite du parcours apparaît
- [ ] Soumettre le sitemap à Google Search Console : `https://votre-domaine/sitemap.xml`
- [ ] Soumettre à Bing Webmaster Tools

---

## 🆘 Rollback rapide en cas de problème

**Vercel Instant Rollback** :

1. Dashboard Vercel → Deployments → sélectionner le deploy précédent
2. Cliquer "Promote to Production" → rollback en < 30 secondes
3. Aucune perte de données (rollback du CODE uniquement, DB inchangée)

**Rollback DB** (si migration SQL a cassé quelque chose) :

1. Supabase Dashboard → Database → Backups → PITR (Point-in-time recovery)
2. Restore à H-1 (les backups quotidiens automatiques suffisent la plupart du temps)
3. **Attention** : perte des données créées entre le backup et maintenant

---

## 🎁 Bonus : accélérateurs de croissance

- [ ] Activer Google Analytics (GA4) pour tracking marketing (le tracker interne est technique, GA c'est pour comprendre l'acquisition)
- [ ] Créer un compte Meta Business + pixel Facebook si campagnes ads FB/Insta prévues
- [ ] Configurer LinkedIn Insight Tag si campagnes LinkedIn
- [ ] Ajouter les 4 réseaux dans Cookies Consent (déjà supporté côté code)

---

## 📞 Contacts d'urgence à préparer

- Support Supabase : https://supabase.com/support (24h en Team plan, 4h en Enterprise)
- Support Vercel : https://vercel.com/support (48h Free, 4h Pro, 1h Enterprise)
- Support Stripe : https://support.stripe.com (chat 24/7)
- Support Resend : support@resend.com (email uniquement)
- Cabinet RGPD (à identifier localement, France : consultation ~500€ pour audit)

---

**Bon lancement ! 🚀**
