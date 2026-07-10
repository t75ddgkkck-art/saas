# Authentification complète (Lot 19)

## 1. Vue d'ensemble

| Fonction               | Route API                             | Page UI                            | État                                   |
| ---------------------- | ------------------------------------- | ---------------------------------- | -------------------------------------- |
| Login                  | `POST /api/auth/login`                | `/login`                           | ✅ (avec captcha + resetOk banner)     |
| Register               | `POST /api/auth/register`             | `/register`                        | ✅ (avec captcha + envoi verify email) |
| Mot de passe oublié    | `POST /api/auth/forgot-password`      | `/forgot-password`                 | ✅                                     |
| Reset password         | `POST /api/auth/reset-password`       | `/reset-password?token=`           | ✅                                     |
| Verify email (envoi)   | `POST /api/auth/verify-email/send`    | (bouton settings + bannière)       | ✅                                     |
| Verify email (confirm) | `POST /api/auth/verify-email/confirm` | `/verify-email?token=`             | ✅                                     |
| Changer mdp            | `PUT /api/account/password`           | `/dashboard/settings?tab=securite` | ✅                                     |
| Logout                 | `DELETE /api/auth/session`            | (bouton sidebar)                   | ✅ (existant)                          |

## 2. Architecture tokens

**Table `auth_tokens`** — un enregistrement par lien à usage unique.

- Type : `password_reset` | `email_verify` | `magic_link` (prévu)
- Stockage : **hash SHA-256** du token brut (le brut ne quitte jamais l'email/URL)
- Single-use : `used_at` marqué atomiquement (`UPDATE ... WHERE used_at IS NULL`) → replay bloqué
- TTL par type : password_reset 1h, email_verify 24h, magic_link 15min
- Anti-spam : max 3-5 tokens actifs simultanés par (user, type)
- Purge : `purgeExpiredTokens()` supprime les tokens expirés > 7j (à ajouter au cron RGPD)

**Table `sessions`** — infrastructure prête (Lot 19), câblage complet côté "Mes sessions" au Lot ultérieur.

## 3. Captcha Cloudflare Turnstile

- Gratuit, RGPD-friendly (alternative à reCAPTCHA)
- **Optionnel** : sans `TURNSTILE_SECRET_KEY` set, verify auto-skip (dev friendly)
- Env vars nécessaires en prod :
  ```
  NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x...   # côté widget
  TURNSTILE_SECRET_KEY=0x...             # côté vérif serveur
  ```
- Widget composant `<CaptchaWidget onToken={setCaptchaToken} />` — ne rend rien si pas de site key
- Vérif serveur `verifyCaptcha(token, { ip })` — timeout 3s, safe si Cloudflare lag

**Routes protégées** : `/api/auth/login`, `/api/auth/register`, `/api/auth/forgot-password`.

## 4. Flow password reset

```
1. User → /forgot-password
   → POST /api/auth/forgot-password { email, captchaToken }
   → toujours répondre pareil (anti-énumération)
   → si user existe : createAuthToken(password_reset) + envoi email

2. User reçoit email → clique le lien
   → arrive sur /reset-password?token=xxx

3. User saisit nouveau mdp + confirme
   → POST /api/auth/reset-password { token, password }
   → consumeAuthToken (atomique) → change hash + set emailVerified=true (bonus)
   → redirect /login?resetOk=1
```

Rate limits :

- Forgot : 3/h/IP + max 3 tokens actifs/user
- Reset : 10/h/IP (protège contre brute-force token, mais l'entropie 256 bits rend inutile)

## 5. Flow email verify

```
1. Register → sendVerifyEmail() auto post-création
2. User reçoit email → clique le lien
   → /verify-email?token=xxx → POST /api/auth/verify-email/confirm
   → set emailVerified=true

Ré-envoi possible :
- Bannière dashboard "Vérifiez votre email" → bouton "Renvoyer"
- Settings → onglet Sécurité → bouton "Renvoyer"
```

La bannière est **dismissable 7 jours** via localStorage (`vx_verify_dismissed_until`).

## 6. Change password (settings)

- Requiert **ancien mot de passe** (protège si session volée)
- Nouveau mdp validé identique au register (min 8, max 200)
- Nouveau ≠ ancien (refine Zod)
- Rate limit 5/h/IP

## 7. Actions post-déploiement

1. **Jouer `sql/00_apply_safe.sql`** (idempotent) — ajoute `auth_tokens` + `sessions` + enum
2. **(Optionnel prod) Setup Turnstile** :
   - Créer un site sur https://dash.cloudflare.com/?to=/:account/turnstile
   - Copier site key + secret key sur Vercel :
     ```
     NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAA...
     TURNSTILE_SECRET_KEY=0x4AAAAAAA...
     ```
3. **Vérifier envoi emails** : créer un compte test → email verify doit arriver dans les 30s
4. **Vérifier reset flow** : /forgot-password avec email valide → email reçu → lien fonctionne
5. **Rétroactif** : les users existants n'ont pas d'`emailVerified=true` — décider :
   - Soit forcer la re-vérification (leur envoyer un email one-shot)
   - Soit passer tout le monde à `true` en SQL (moins strict) :
     ```sql
     UPDATE users SET email_verified = true WHERE email_verified = false;
     ```

## 8. Prochaines étapes suggérées (Lot 27 tests ou lots ultérieurs)

- **Sessions multi-device** : câbler `sessions` table + page "Mes sessions" avec révocation
- **2FA TOTP** : `speakeasy` + QR code + backup codes
- **Magic link** : type déjà prévu dans `auth_tokens.type`
- **Cron purge tokens** : ajouter `purgeExpiredTokens()` au cron `/api/cron/purge-deleted` (Lot 15)
- **Audit trail login** : ajouter `login_events` table pour "voir mes connexions récentes"
