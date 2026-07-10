# 🚀 Déploiement Vercel + Domaine IONOS

Guide pas-à-pas pour brancher votre domaine IONOS sur un déploiement Vercel de ce projet.

---

## 1. Préparer le projet sur Vercel

### 1.1 Créer le projet

1. Connectez-vous sur [vercel.com](https://vercel.com) avec votre compte GitHub.
2. **Add New… → Project** → sélectionnez ce repo GitHub.
3. Framework Preset : **Next.js** (détecté automatiquement).
4. **Root Directory** : `.` (racine).
5. **Build Command** : laissez la valeur par défaut (`next build`).
6. **Output Directory** : laissez la valeur par défaut.
7. **Install Command** : `npm install`.
8. Cliquez **Deploy** (le premier build peut échouer si les variables d'env ne sont pas encore là — c'est normal).

### 1.2 Variables d'environnement (Settings → Environment Variables)

Copiez toutes les variables suivantes en cochant **Production**, **Preview** et **Development** selon les cas.

| Variable                   | Prod | Preview | Dev  | Notes                                                                                                          |
| -------------------------- | ---- | ------- | ---- | -------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`             | ✅   | ✅      | ✅   | Connection pooler Supabase (`?pgbouncer=true&connection_limit=1`)                                              |
| `NEXTAUTH_SECRET`          | ✅   | ✅      | ✅   | `openssl rand -base64 32` — **≥ 32 caractères obligatoire**                                                    |
| `NEXTAUTH_URL`             | ✅   | ⛔      | ⛔   | `https://votre-domaine.fr` en prod                                                                             |
| `NEXT_PUBLIC_APP_URL`      | ✅   | ✅      | ✅   | Même valeur que `NEXTAUTH_URL` en prod                                                                         |
| `INSEE_API_KEY`            | ⭕   | ⭕      | ⭕   | Optionnel (fallback Luhn si absent)                                                                            |
| `STRIPE_SECRET_KEY`        | ✅   | test    | test | `sk_live_…` en prod, `sk_test_…` en preview                                                                    |
| `STRIPE_PUBLISHABLE_KEY`   | ✅   | test    | test | Idem                                                                                                           |
| `STRIPE_WEBHOOK_SECRET`    | ✅   | test    | ⛔   | Voir §3                                                                                                        |
| `STRIPE_PRICE_ID_PRO`      | ✅   | test    | test |                                                                                                                |
| `STRIPE_PRICE_ID_PREMIUM`  | ✅   | test    | test |                                                                                                                |
| `OPENAI_API_KEY`           | ⭕   | ⭕      | ⭕   | Le chat a un fallback sans IA                                                                                  |
| `RESEND_API_KEY`           | ⭕   | ⭕      | ⭕   | Nécessaire pour emails transac                                                                                 |
| `RESEND_FROM_EMAIL`        | ⭕   | ⭕      | ⭕   | `noreply@votre-domaine.fr`                                                                                     |
| `TWILIO_ACCOUNT_SID`       | ⭕   | ⛔      | ⛔   | SMS Premium uniquement                                                                                         |
| `TWILIO_AUTH_TOKEN`        | ⭕   | ⛔      | ⛔   |                                                                                                                |
| `TWILIO_PHONE_NUMBER`      | ⭕   | ⛔      | ⛔   |                                                                                                                |
| `CRON_SECRET`              | ✅   | ⛔      | ⛔   | Généré par Vercel automatiquement pour les crons. **Utilisez la même valeur** dans vos scripts d'appel manuel. |
| `GOOGLE_SITE_VERIFICATION` | ⭕   | ⛔      | ⛔   | Pour Google Search Console                                                                                     |
| `LOG_LEVEL`                | ⭕   | ⭕      | ⭕   | `info` par défaut en prod, `debug` recommandé en dev                                                           |

✅ = obligatoire · ⭕ = optionnel · ⛔ = ne pas définir

**Générer un secret fort :**

```bash
openssl rand -base64 48
```

### 1.3 Relancez un déploiement

Après avoir ajouté les variables : **Deployments → … → Redeploy**.

---

## 2. Brancher le domaine IONOS

### 2.1 Ajouter le domaine dans Vercel

1. Dans votre projet Vercel → **Settings → Domains**.
2. Cliquez **Add** et entrez votre domaine (ex. `vitrix.fr`).
3. Ajoutez également `www.vitrix.fr` — Vercel proposera automatiquement de rediriger l'un vers l'autre. Recommandation : **canonique = apex** (`vitrix.fr`), redirection `www → apex`.
4. Vercel vous montrera **exactement** les enregistrements DNS à créer chez IONOS.

### 2.2 Configurer les DNS chez IONOS

Connectez-vous sur [ionos.fr](https://www.ionos.fr) → **Domaines & SSL → votre domaine → DNS**.

Vous avez deux options :

#### Option A : Garder les DNS IONOS (recommandé)

Créez / modifiez ces enregistrements :

**Pour l'apex `vitrix.fr` :**

```
Type : A
Nom  : @   (ou vide)
Valeur : 76.76.21.21
TTL  : 3600
```

**Pour `www.vitrix.fr` :**

```
Type : CNAME
Nom  : www
Valeur : cname.vercel-dns.com.   (le point final est important)
TTL  : 3600
```

⚠️ **Supprimez** tout enregistrement `A` ou `CNAME` existant sur `@` et `www` qui pointerait ailleurs (page parking IONOS par défaut).

#### Option B : Déléguer les DNS à Vercel (pour usage avancé)

Chez IONOS : **DNS → Serveurs de noms → Utiliser des serveurs de noms personnalisés** et mettez :

```
ns1.vercel-dns.com
ns2.vercel-dns.com
```

Puis gérez tous vos enregistrements dans Vercel. Plus flexible mais vous perdez les enregistrements MX/mail IONOS (à recréer côté Vercel).

### 2.3 Enregistrements complémentaires

**Emails IONOS (si vous utilisez la messagerie IONOS)** — **ne pas les supprimer** :

```
Type : MX      Nom : @    Valeur : mx00.ionos.fr   Priorité : 10
Type : MX      Nom : @    Valeur : mx01.ionos.fr   Priorité : 10
Type : TXT     Nom : @    Valeur : "v=spf1 include:_spf-a.ionos.com ~all"
```

**Si vous utilisez Resend pour envoyer** (`RESEND_FROM_EMAIL=noreply@vitrix.fr`), suivez la procédure dans [Resend → Domains](https://resend.com/domains) qui vous demandera d'ajouter :

```
Type : TXT      Nom : resend._domainkey    Valeur : (fournie par Resend)
Type : TXT      Nom : @                    Valeur : "v=spf1 include:amazonses.com ~all"  (à combiner avec l'existant)
Type : TXT      Nom : _dmarc               Valeur : "v=DMARC1; p=quarantine; rua=mailto:dmarc@vitrix.fr"
```

### 2.4 Attente de propagation

- **5 minutes à 1 heure** en général chez IONOS.
- Vérifiez avec : `dig vitrix.fr +short` ou [dnschecker.org](https://dnschecker.org).
- Vercel affichera **✓ Valid Configuration** puis émettra automatiquement un certificat Let's Encrypt.

### 2.5 Cocher le domaine comme "Production"

Dans **Settings → Domains**, à côté de `vitrix.fr`, cliquez **Edit → Set as Production Domain**.

---

## 3. Webhook Stripe

Une fois le domaine actif :

1. Sur [dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks) → **Add endpoint**.
2. URL : `https://vitrix.fr/api/stripe/webhook`
3. Événements à écouter :
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copiez le **Signing secret** (`whsec_…`) et mettez-le dans `STRIPE_WEBHOOK_SECRET` sur Vercel.
5. **Redeploy** pour prendre en compte la variable.

---

## 4. Vérifications post-déploiement

Depuis votre navigateur / terminal :

```bash
# Site up
curl -I https://vitrix.fr
# Healthcheck DB
curl https://vitrix.fr/api/health
# Headers de sécurité (doit contenir HSTS, XCTO, Referrer-Policy)
curl -I https://vitrix.fr | grep -iE "strict-transport|x-content-type|referrer-policy"
# Manifest
curl https://vitrix.fr/manifest.webmanifest | head
# Favicon
curl -I https://vitrix.fr/favicon.ico
```

Lighthouse (dans Chrome DevTools) doit remonter :

- ✅ PWA installable
- ✅ Icônes correctes (192 + 512, maskable OK)
- ✅ HTTPS + HSTS
- ✅ SEO 100 (metadata bien configurée)

---

## 5. Crons Vercel

Les crons sont déclarés dans `vercel.json` (déjà présent dans le repo) :

| Path                        | Schedule (UTC) | Effet                              |
| --------------------------- | -------------- | ---------------------------------- |
| `/api/cron/quote-reminders` | `0 9 * * *`    | Relance quotidienne des devis > 7j |
| `/api/cron/weekly-summary`  | `0 18 * * 0`   | Rapport hebdo dimanche 18h         |
| `/api/cron/reminder-sms`    | `0 8 * * *`    | Rappels SMS avant RDV              |

Vercel ajoute automatiquement l'en-tête `Authorization: Bearer $CRON_SECRET` — les routes vérifient ce header. **Aucun setup manuel nécessaire** côté cron.

⚠️ Les crons Vercel sont **désactivés en Preview**, ils ne tournent qu'en Production.

---

## 6. Rollback rapide

En cas de problème après un déploiement :

1. **Deployments** → sélectionnez la dernière version stable.
2. **… → Promote to Production**.

Le rollback est instantané et n'affecte pas la DB.

---

## 7. Coûts

Config recommandée pour démarrer (< 100 users) :

| Service  | Plan                            | Coût mensuel           |
| -------- | ------------------------------- | ---------------------- |
| Vercel   | Hobby (personnel)               | 0 €                    |
| Vercel   | Pro (commercial)                | 20 $                   |
| Supabase | Free                            | 0 €                    |
| Supabase | Pro (backups quotidiens + 8 Go) | 25 $                   |
| Resend   | Free (100 mails/j)              | 0 €                    |
| Stripe   | Frais par transaction           | 1.4% + 0.25 € (Europe) |
| OpenAI   | Usage                           | ~0.15 $ / 1000 chats   |
| IONOS    | .fr                             | ~10 €/an               |

**Total démarrage** : ~10 €/an pour un usage perso, ~50 €/mois pour du commercial sérieux.
