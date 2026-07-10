# Sécurité durcie (Lot 26)

Ce document décrit les mécanismes de sécurité en place. Pour signaler une vulnérabilité, voir `SECURITY.md` à la racine (procédure responsible disclosure).

## 1. Headers HTTP (proxy Edge)

Toutes les réponses passent par `src/proxy.ts` qui ajoute :

| Header                         | Valeur                                                                             | Rôle                                         |
| ------------------------------ | ---------------------------------------------------------------------------------- | -------------------------------------------- |
| `Content-Security-Policy`      | script-src whitelisté (Stripe, Turnstile, Sentry…) + `frame-ancestors 'none'`      | Anti-XSS + anti-clickjacking                 |
| `Strict-Transport-Security`    | `max-age=63072000; includeSubDomains; preload`                                     | Force HTTPS (2 ans)                          |
| `X-Content-Type-Options`       | `nosniff`                                                                          | Anti-MIME sniffing                           |
| `X-Frame-Options`              | `SAMEORIGIN`                                                                       | Legacy anti-clickjacking (vieux navigateurs) |
| `Referrer-Policy`              | `strict-origin-when-cross-origin`                                                  | Limite fuites URL sortantes                  |
| `Permissions-Policy`           | `camera=(), microphone=(), geolocation=(self), payment=(self), interest-cohort=()` | Bloque APIs sensibles + FLoC                 |
| `Cross-Origin-Opener-Policy`   | `same-origin`                                                                      | Anti-Spectre + isolation `window.open`       |
| `Cross-Origin-Resource-Policy` | `same-origin`                                                                      | Empêche l'inclusion cross-origin             |

### CSP whitelistée

Le CSP est construit dynamiquement selon les env vars actives (voir `buildCsp()` dans `proxy.ts`) :

- **Toujours** : Stripe (js.stripe.com, api.stripe.com), Cloudflare Turnstile
- **Si `NEXT_PUBLIC_SENTRY_DSN`** : *.sentry.io
- **Si `NEXT_PUBLIC_CRISP_ID`** : client.crisp.chat
- **Si `NEXT_PUBLIC_INTERCOM_APP_ID`** : widget.intercom.io
- **frame-src** : YouTube, Vimeo, OpenStreetMap, Stripe (lightbox Lot 23 + payments)
- **img-src** : `'self' data: blob: https:` (large mais nécessaire pour avatars Google, unsplash…)

Pour ajouter un nouveau tier (ex: PostHog), ajouter le domaine à `scriptSrc` + `connectSrc` puis re-tester.

## 2. Uploads sécurisés (`src/lib/file-security.ts`)

Chaque upload passe par `validateUploadBytes()` qui :

1. **Rejette les fichiers vides** (`empty`)
2. **Match les magic bytes** contre une allow-list (JPEG, PNG, GIF, WebP, AVIF, PDF, MP4, WebM). Un `.exe` renommé en `.png` est détecté (`unknown_type`).
3. **Scan les SVG** pour `<script>`, event handlers `on*=`, `javascript:` URI, `<foreignObject>`, `xlink:href="data:"` → rejette si XSS potentielle
4. **Stocke le vrai MIME** dans `Content-Type` (pas celui déclaré par le client)

Le rate-limit `/api/upload` reste à 40 requêtes / 5 min / user pour l'anti-abus.

## 3. Détection brute-force login

`src/lib/brute-force-detector.ts` compte les échecs login par IP (fenêtre 1h). Dès que le seuil est atteint (défaut 30, configurable via `BRUTE_FORCE_THRESHOLD`) :

- **`captureMessage`** Sentry (level warning)
- **`sendAlert`** critical → webhook Slack/Discord (si `ALERT_WEBHOOK_URL` défini, Lot 13)
- Cooldown 1h par IP → pas de spam d'alertes

Un login **réussi** reset le compteur pour cette IP (l'user légitime qui a tapé 5× son mdp n'est pas flag).

**Limite** : store en mémoire par process. Suffit pour détecter les vraies attaques concentrées. Un credential stuffing distribué sur 1000 IPs passe → contre-mesure = captcha Turnstile (Lot 19) déjà en place.

## 4. Audit dépendances

```bash
npm run audit:check  # échoue si vulnérabilité >= moderate dans les deps prod
```

Recommandation CI (Lot 27) : lancer `npm run audit:check` sur chaque PR.

## 5. Rotation des secrets

À rotate au minimum tous les 90 jours OU immédiatement en cas de fuite :

| Secret                      | Où                                                                               | Comment rotate                                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `NEXTAUTH_SECRET`           | Vercel env                                                                       | Générer 32 bytes hex, mettre à jour Vercel, invalide toutes les sessions actives (users doivent se reconnecter) |
| `CRON_SECRET`               | Vercel env                                                                       | Idem, aucun impact user                                                                                         |
| `STRIPE_SECRET_KEY`         | Vercel env + Stripe dashboard                                                    | Créer nouvelle clé sur dashboard, mettre à jour Vercel, révoquer l'ancienne 24h après                           |
| `STRIPE_WEBHOOK_SECRET`     | Vercel env + Stripe dashboard                                                    | Recréer le webhook endpoint                                                                                     |
| `RESEND_API_KEY`            | Vercel + Resend dashboard                                                        | Créer nouvelle clé, migrer, révoquer                                                                            |
| `TURNSTILE_SECRET_KEY`      | Vercel + Cloudflare dashboard                                                    | Créer nouveau widget si compromise, sinon rotation soft                                                         |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠ ne peut PAS être rotate sans regen le projet Supabase — traiter comme critique |
| `OPENAI_API_KEY`            | Vercel + platform.openai.com                                                     | Créer nouvelle clé, révoquer l'ancienne                                                                         |

## 6. Checklist post-incident

En cas de fuite ou compromission suspectée :

1. **Rotate tous les secrets** listés section 5 (dans l'ordre : `NEXTAUTH_SECRET` en premier → invalide toutes les sessions)
2. Check les logs Vercel + Sentry sur les 30 derniers jours
3. Query `admin_events` (Lot 13) pour identifier les actions admin suspectes
4. Query `sessions` (Lot 19) pour lister toutes les sessions actives → forcer déconnexion si nécessaire (soft delete `revoked_at`)
5. Envoyer email transactionnel aux users concernés (obligation RGPD art. 33-34 si risque élevé)
6. Notifier CNIL sous 72h si données perso touchées
7. Post-mortem interne + update `docs/SECURITY.md`

## 7. Checklist pré-lancement commercial

- [ ] `NEXTAUTH_SECRET` >= 32 bytes hex sur Vercel prod
- [ ] `CRON_SECRET` défini (sans → crons publiquement accessibles)
- [ ] `TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (Lot 19 captcha)
- [ ] `ALERT_WEBHOOK_URL` (Lot 13 alerting Slack/Discord)
- [ ] `SENTRY_DSN` (recommandé, Lot 13)
- [ ] Bucket Supabase Storage en **public** (pour uploads) ou signed URLs
- [ ] Backup Supabase en Pro (7j PITR minimum)
- [ ] `NEXT_PUBLIC_APP_URL` = domaine prod (pas localhost)
- [ ] Tester `/api/health` → retour 200 avec tous les checks
- [ ] Vérifier CSP en console navigateur : aucune erreur "Refused to load…"
- [ ] `npm run audit:check` → 0 vulnérabilité moderate+

## 8. Ce qui n'est PAS couvert (roadmap sécurité)

- **2FA TOTP** — table `auth_tokens` prête (Lot 19), UI + libs à ajouter
- **Sessions révocables côté user** — table `sessions` prête (Lot 19), UI "Mes sessions actives" à faire
- **Scan antivirus des uploads** — magic bytes = 90% de la protection, ClamAV pour les 10% restants (fichiers "polyglotes" complexes)
- **WAF (Web Application Firewall)** — à activer côté Vercel/Cloudflare en prod
- **Audit externe pentest** — recommandé annuellement au-delà de 100 payants
