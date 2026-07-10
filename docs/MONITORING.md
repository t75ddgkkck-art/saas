# Monitoring & Observabilité (Lot 13)

Ce document couvre :
- Sentry (optionnel)
- Alerting webhook (Slack/Discord)
- Healthcheck étendu
- Metrics business
- Dashboard admin

---

## 1. Sentry (optionnel)

### Pourquoi ?

Les logs Vercel sont conservés 30 jours max sur le plan Pro. Sentry centralise les erreurs prod avec stack trace, tags user/route, dédupe, alerting natif.

### Activation en 3 étapes

```bash
# 1. Installer le SDK
npm install @sentry/nextjs

# 2. Copier les configs exemples
cp sentry.client.config.example.ts sentry.client.config.ts
cp sentry.server.config.example.ts sentry.server.config.ts
cp sentry.edge.config.example.ts sentry.edge.config.ts

# 3. Décommenter le contenu de chaque fichier
```

### Env vars

```
SENTRY_DSN=https://xxx@sentry.io/xxx        # server + edge
NEXT_PUBLIC_SENTRY_DSN=https://xxx@...      # client (peut être identique)
```

Sans DSN, l'app tourne normalement — le monitoring retombe sur les logs structurés.

### Utilisation dans le code

```ts
import { captureException, captureMessage } from "@/lib/monitoring";

// Erreur inattendue
try {
  await doSomething();
} catch (err) {
  captureException(err, {
    route: "POST /api/xxx",
    userId: currentUser.id,
    severity: "error", // info | warning | error | critical
    extra: { orderId: "abc" },
  });
}

// Message contextuel (pas d'erreur)
captureMessage("Webhook Stripe retried 3x", { level: "warning" });
```

**⚠ Ne PAS appeler `captureException` sur des `HttpError` métier (4xx)** — ils sont déjà catchés proprement par `handleApiError` qui filtre les 4xx (bruit inutile).

---

## 2. Alerting webhook

Envoie des notifications Slack, Discord ou webhook générique quand une erreur critique survient.

### Env vars

```
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/xxx
ALERT_WEBHOOK_TYPE=slack           # slack (défaut) | discord | generic
ALERT_MIN_LEVEL=error              # warning | error | critical
```

### Déclenchement

- **Automatique** : toute `captureException(..., { severity: "critical" })` envoie une alerte
- **Manuel** :
  ```ts
  import { sendAlert } from "@/lib/alerts";
  await sendAlert({
    title: "Queue email pleine",
    level: "warning",
    route: "cron/reminders",
    extra: { queueSize: 5000 },
  });
  ```

### Anti-spam

Une même alerte (même titre + route) est throttlée à 1/5min par process pour éviter le flood en cas d'erreur en cascade.

---

## 3. Healthcheck étendu

`GET /api/health` retourne :

```json
{
  "ok": true,
  "checks": [
    { "name": "db", "ok": true, "critical": true, "latencyMs": 12 },
    { "name": "stripe", "ok": true, "critical": false },
    { "name": "resend", "ok": true, "critical": false },
    { "name": "openai", "ok": true, "critical": false },
    { "name": "monitoring", "ok": false, "critical": false, "detail": "SENTRY_DSN non défini" },
    { "name": "alerts", "ok": false, "critical": false }
  ],
  "version": "e4bb4e2",
  "env": "production",
  "timestamp": "2026-07-10T..."
}
```

- **200** si tous les checks CRITIQUES passent (DB)
- **503** sinon
- Compatible **Uptime Kuma**, **Better Uptime**, **Uptime Robot**

`GET /api/health/email` reste dédié aux checks DNS SPF/DKIM/DMARC.

---

## 4. Metrics business

`GET /api/admin/metrics` (auth admin requise, cache 60s) :

```json
{
  "users": { "total": 1200, "newLast7d": 45, "newLast30d": 180, "verified": 950 },
  "subscriptions": {
    "free": 800, "pro": 300, "premium": 100,
    "trialing": 25, "pastDue": 3,
    "canceledLast30d": 12,
    "mrrEurCents": 1660000
  },
  "appointments": { "total": 5400, "last7d": 320, "last30d": 1500, "upcoming": 140 },
  "businesses": { "total": 450, "activeLast30d": 380 },
  "ai": { "totalCallsLast30d": 12000, "totalCostUsd": 34.20 },
  "conversion": { "ratio": 0.14, "registered": 180, "paid": 25 }
}
```

Les agrégats sont calculés en SQL natif (`COUNT ... FILTER WHERE`) pour la perf. Mise en cache 60 s dans chaque process (pas de Redis pour éviter la dépendance).

---

## 5. Dashboard admin

Accessible à `/dashboard/admin` pour les users `role = 'admin'`.

Fonctionnalités :

- **KPIs** : MRR, users, conversion, RDV, coût IA, churn
- **Table users** : recherche, pagination, ban/unban avec raison
- **Audit log** : dernières 50 actions admin (`admin_events`)

### Actions admin loggées

Chaque action est écrite dans `admin_events` avec :
- `actor_user_id` : admin qui a fait l'action
- `target_user_id` : user impacté
- `action` : `ban_user`, `unban_user`, `override_plan`, `refund`, ...
- `payload` : détails (raison, nouveau plan, montant...)
- `ip` : X-Forwarded-For de l'admin

### Ban user

- `POST /api/admin/users/:id/ban` avec `{ reason: string }` → set `banned_at`
- `DELETE /api/admin/users/:id/ban` → unset
- Un user banni ne peut plus se connecter (message explicite au login)

### Override plan

- `POST /api/admin/users/:id/plan` avec `{ plan, expiresAt?, reason? }`
- ⚠ Ne touche PAS à la subscription Stripe. Utile pour comps VIP ou fix webhook raté.
- Le prochain webhook Stripe écrasera ces valeurs si actif.

---

## 6. Global error boundary

`src/app/global-error.tsx` capture les erreurs qui plantent AVANT le root layout (rare, mais critique).

L'erreur est envoyée à Sentry avec `severity: "critical"` → alerte webhook immédiate.

---

## 7. Checklist post-déploiement

1. Jouer `sql/00_apply_safe.sql` (colonnes `banned_at`, table `admin_events`)
2. Set `role = 'admin'` sur votre user :
   ```sql
   UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
   ```
3. (Optionnel) Configurer Sentry via `npm i @sentry/nextjs` + DSN
4. (Optionnel) Configurer webhook Slack : `ALERT_WEBHOOK_URL`
5. Ajouter le healthcheck à Uptime Kuma / Better Uptime : `GET /api/health`
