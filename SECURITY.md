# Politique de sécurité

## Signaler une vulnérabilité

Merci de **ne pas ouvrir d'issue publique** pour un problème de sécurité.
Envoyez un email à `security@vitrix.fr` (ou l'adresse de contact du repo) avec :

- Une description du problème et son impact estimé.
- Les étapes pour reproduire.
- Une éventuelle proposition de correctif.

Nous nous engageons à répondre sous **72 heures ouvrées** et à publier un correctif dans les meilleurs délais.

## Bonnes pratiques appliquées dans ce dépôt

- **Sessions signées HMAC-SHA256** (voir `src/lib/session.ts`).
- **`NEXTAUTH_SECRET` obligatoire en production** (fail-fast au boot).
- **Cookies `httpOnly` + `sameSite=lax` + `secure` en HTTPS**.
- **Comparaison de signature en temps constant** (`crypto.timingSafeEqual`).
- **Rate-limiting** sur `/api/auth/login`, `/api/auth/register`.
- **Headers de sécurité** via middleware Edge + `next.config.ts` :
  `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`, `Strict-Transport-Security` (prod).
- **Vérification d'appartenance** systématique (`businessId` du user courant)
  sur les routes qui modifient une ressource (fix des failles IDOR).
- **Erreurs neutres** exposées au client, détails/stack loggés côté serveur.
- **Validation d'entrée** via [Zod](https://zod.dev/) sur les routes auth
  (à généraliser aux autres routes).
- **Transactions DB** sur les mutations multi-tables (`/api/auth/register`).

## À faire (roadmap sécurité)

- [ ] Généraliser Zod à toutes les routes API.
- [ ] Ajouter un rate-limiter distribué (Upstash Redis) pour multi-instance.
- [ ] Content Security Policy stricte avec `nonce`.
- [ ] Rotation périodique de `NEXTAUTH_SECRET` (avec liste de secrets valides).
- [ ] 2FA (TOTP) optionnel pour les comptes.
- [ ] Audit log immuable des actions sensibles (upgrade plan, suppression business).
- [ ] Migrer les uploads base64 (`quote-request`) vers un stockage objet
      (Supabase Storage / S3 / R2) avec URLs signées.
- [ ] Vérifier / renforcer la RLS Postgres au niveau Supabase.
