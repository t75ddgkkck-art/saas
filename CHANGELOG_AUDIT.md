# 🛠️ Améliorations issues de l'audit

Ce document liste **exactement** ce qui a changé. Rapport détaillé dans [`AUDIT_REPORT.md`](./AUDIT_REPORT.md) et [`AUDIT_FULL_V2.md`](./AUDIT_FULL_V2.md).

---

# 🟢 Tour 9 — Lot 9 Emails & Communications

## 9.1 — Config email centralisée + branding correct

Nouveau **`src/lib/email-core.ts`** :
- `sendEmailRaw(opts)` : transport pur (Resend), pas de logique métier
- Config env : `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`, `RESEND_REPLY_TO`
- `from` par défaut : `"Vitrix <noreply@vitrix.fr>"` (nom affiché avant l'adresse)
- **Support `replyTo`** : le client peut répondre au pro (pas au noreply)
- **Support `headers` custom** : pour List-Unsubscribe RFC 8058

## 9.2 — Queue email non-bloquante avec retry exponentiel

Nouveau **`src/lib/email-queue.ts`** :
- `enqueueEmail(opts)` = fire-and-forget, jamais throw
- **Retry** 3 tentatives : 1s → 5s → 30s (exponentiel)
- **API répond immédiatement** au user ; l'email part quelques ms plus tard
- **Skip automatique** si le destinataire a opt-out (sauf `transactional`)
- **List-Unsubscribe** ajouté automatiquement pour marketing/reminders/review-request

`sendEmail(opts, meta?)` refondu :
- Compat 100% ascendante (signature `sendEmail({to, subject, html})`)
- 2ᵉ arg optionnel `{ category?, sync? }` pour opt-in
- Par défaut passe par la queue ; `{ sync: true }` = envoi bloquant

## 9.3 — Templates : footer légal + wrapper i18n

Le `baseWrapper` accepte maintenant :
- `unsubscribeEmail`, `unsubscribeCategory` → lien de désabonnement en footer
- `lang` → labels footer traduits ("Sent by / for / Unsubscribe")

Les templates existants restent inchangés (compat totale) mais peuvent maintenant recevoir ces options.

## 9.4 — Budget SMS/WhatsApp Twilio

Nouveau **`src/lib/sms-budget.ts`** :
- `checkAndRecordSmsSend(businessId, channel)` = check + increment atomique
- **Limite quotidienne par business** : 100 SMS / 500 WhatsApp par défaut (env `SMS_DAILY_LIMIT`, `WHATSAPP_DAILY_LIMIT`)
- **Compteur en mémoire** par instance (suffisant <1000 pros, sinon migrer Redis)
- **Log coût estimé** (prix Twilio 2026 : 0.075 € / SMS, 0.005 € / WA)
- **Alerte 80%** logguée quand un business approche sa limite
- **Purge auto** des compteurs > 2 jours

Intégré dans `/api/cron/reminder-sms` : chaque envoi passe par `checkAndRecordSmsSend`. Un business qui saturerait sa limite ne peut plus dépenser (garde-fou anti-bug de facturation).

## 9.5 — Unsubscribe RGPD complet

Nouveau **`src/lib/unsubscribe.ts`** :
- Token HMAC-SHA256 signé, format `base64url(email|category|expiry|sig)`
- **5 catégories** : `transactional` (jamais désabonnable), `reminders`, `review-request`, `marketing`, `all`
- **Expiration 1 an** (rechargeable en renvoyant un email)
- **Comparaison temps constant** contre les timing attacks
- **Stateless** : aucun stockage nécessaire pour créer/valider un token
- Helper `buildListUnsubscribeHeaders()` pour headers RFC 8058 one-click Gmail/Yahoo

Nouvelle table **`email_optouts`** (schéma + SQL idempotent) :
- Colonnes : `email`, `category`, `reason`, `createdAt`
- Index unique `(lower(email), category)` : anti-doublon + lookup O(1)
- Migration ajoutée dans `sql/00_apply_safe.sql`

Nouveau **`src/lib/email-optout-check.ts`** : `isEmailOptedOut(email, category)` utilisé par la queue avant chaque envoi non-transactional.

Nouvelle route **`/api/unsubscribe`** :
- `GET ?token=XYZ` → page HTML branded "vous êtes désabonné" (auto-inscrite en DB)
- `POST ?token=XYZ` → RFC 8058 one-click Gmail/Yahoo (200 OK vide)
- Refus explicite si catégorie = `transactional` (obligation contractuelle)
- Message d'erreur clair si token expiré/malformé

## 9.6 — Health check email DKIM/SPF/DMARC

Nouvelle route **`/api/health/email`** :
- Vérifie `RESEND_API_KEY` présent
- Résout les records DNS TXT :
  - **SPF** sur le domaine (`v=spf1 ... include:amazonses.com`)
  - **DMARC** sur `_dmarc.<domain>` (`v=DMARC1; p=...`)
  - **DKIM** sur `resend._domainkey.<domain>` (`v=DKIM1`)
- Renvoie JSON avec `ok: bool` + **recommandations exactes** à ajouter si un record manque
- Status 503 si un check échoue → intégrable à un monitoring externe (UptimeRobot)

Exemple de sortie quand tout est OK :
```json
{
  "ok": true,
  "domain": "vitrix.fr",
  "resend": { "apiKeyConfigured": true, "fromEmail": "noreply@vitrix.fr", "fromName": "Vitrix" },
  "dns": { "spf": { "ok": true, "raw": "v=spf1 include:amazonses.com ~all" }, ... }
}
```

## Tests unitaires (+14 : 88 → 102)

- `tests/unit/unsubscribe.test.ts` (8 tests) :
  - Token créé/vérifié (normalisation email)
  - Rejet signature altérée
  - Rejet catégorie modifiée
  - Rejet token vide/malformé
  - `isValidCategory`
  - `buildUnsubscribeUrl` génère URL avec token
  - `buildListUnsubscribeHeaders` RFC 8058 (2 headers)

- `tests/unit/sms-budget.test.ts` (6 tests) :
  - Autorise le 1er envoi + increment
  - Respect limite quotidienne (bloque au N+1)
  - Isolation SMS/WhatsApp
  - Isolation entre business
  - `getSmsUsage` ne modifie pas le compteur
  - Coût estimé cohérent (0.075 €/SMS)

## Validations finales

```
tsc --noEmit  → 0 erreur
vitest run    → 102/102 tests OK
next build    → Compiled successfully, 42/42 pages, 0 warning
              → Nouvelles routes: /api/unsubscribe, /api/health/email
```

## Variables d'environnement (à ajouter sur Vercel)

Optionnelles mais recommandées :

| Variable | Défaut | Description |
|---|---|---|
| `RESEND_FROM_NAME` | `"Vitrix"` | Nom affiché avant l'email dans la boîte de réception |
| `RESEND_REPLY_TO` | — | Email de réponse par défaut (sinon = FROM) |
| `SMS_DAILY_LIMIT` | `100` | Limite SMS par business par jour |
| `WHATSAPP_DAILY_LIMIT` | `500` | Limite WhatsApp par business par jour |

## Migration DB requise (Supabase)

Rejouer `sql/00_apply_safe.sql` sur ta DB : la nouvelle table `email_optouts` sera créée avec son index unique (safe rejouable, aucun impact sur les données existantes).

## À faire (roadmap suivante)

- Templates emails via **React Email** (aujourd'hui HTML string monolithique)
- Migrer la queue in-memory vers **Vercel KV / Redis** à mesure du trafic
- Ajouter un dashboard "Consommation SMS/mois" pour les pros
- Preview email dans le dashboard vitrine (avant envoi cron)
- Bounce handling (webhook Resend `email.bounced` → auto-optout)

---

# Historique tours précédents

- `11211b5` — Tour 8 : Lot 8 i18n (116 clés, interpolation, emails multi-langues)
- `8fcc196` — Tour 7 : Lot 6 SEO (sitemap-index paginé, rich snippets)
- `7beadb6` — Tour 6 : Lot 5 perf (ISR, index DB, next/image, next/font)
- `2c928bb` — Tour 5 : Lot 4 a11y (WCAG AA)
- `5380ed0` — Tour 4 : Lot 3 UI/UX (theme, toast, skeletons, onboarding)
- `f5b3f2b` — Tour 3 : Lots 1+2 (sécurité + code mort)
- `096b2aa` — Fix SQL tolérant tables absentes
- `89d448b` — SQL idempotent + audit v2
- `e642e8b` — Tour 2 : favicon, Vercel/IONOS
- `4c25f9c` — Tour 1 : sécurité fondamentale
