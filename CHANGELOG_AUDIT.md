# 🛠️ Améliorations issues de l'audit

Ce document liste **exactement** ce qui a changé. Rapport détaillé dans [`AUDIT_REPORT.md`](./AUDIT_REPORT.md).

---

# 🟢 Tour 2 — Favicon, Vercel/IONOS, roadmap complète

## Favicon & PWA

- Nouveau SVG source `branding/icon-source.svg` (V blanc sur fond bleu marine + point cyan).
- Génération complète de **14 tailles PNG** (16, 32, 48, 64, 96, 128, 144, 152, 167, 180, 192, 256, 384, 512).
- Fichiers produits :
  - `public/favicon.ico` (multi-résolutions 16/32/48)
  - `public/favicon.svg`
  - `public/apple-icon.png` (180×180)
  - `public/icons/icon-*.png` (toutes les tailles)
  - Doublons `src/app/favicon.ico|svg`, `src/app/icon.png|svg`, `src/app/apple-icon.png|svg` (Next.js App Router auto-détection).
- `src/app/layout.tsx` : `metadata.icons` complet (ICO + SVG + PNG + apple + shortcut).
- `src/app/manifest.webmanifest/route.ts` : réécrit avec icônes **any + maskable** séparées, cache 1h, `scope`, `lang`.
- Suppression de `public/manifest.webmanifest` (doublon avec la route dynamique).

## Configuration Vercel / IONOS

- `vercel.json` refondu : `framework`, `regions: ["cdg1"]`, crons multiples, `headers` fins (cache immutable pour icônes, no-cache pour SW, MIME manifest), `functions.maxDuration` par route (PDF 30s, IA 60s, cron 300s).
- Nouveau guide `DEPLOY_VERCEL_IONOS.md` : DNS IONOS (A + CNAME + email MX/SPF conservés), variables d'env par environnement, webhook Stripe, vérifs post-déploiement, rollback, coûts.

## Nettoyage dépendances

- **Retirées** : `next-auth`, `@auth/drizzle-adapter` (installées, jamais utilisées).
- **Déplacées** en `devDependencies` : `@types/bcryptjs`, `@types/qrcode`.
- **Ajoutée** : `vitest ^2.1.8` (dev).
- `package.json` renommé `vitrix-saas`, nouveaux scripts : `test`, `test:watch`, `db:generate`.

## Tests unitaires (Vitest)

Nouveau `vitest.config.ts` + 4 suites (**27 tests, tous verts**) :

- `tests/unit/session.test.ts` — token HMAC : création, vérif, expiration, falsification signature, tampering userId.
- `tests/unit/rate-limit.test.ts` — sous limite, au-delà (429 + Retry-After), isolation IP/clé.
- `tests/unit/permissions.test.ts` — matrice free/pro/premium + cohérence de forme.
- `tests/unit/utils.test.ts` — slugify (accents, spéciaux), formatPrice, isValidEmail, téléphone FR.

## Uploads : abstraction storage

- Nouveau `src/lib/storage.ts` : helper `uploadFile()` avec **Supabase Storage** si configuré, sinon fallback base64 (compatibilité rétro).
  - Support `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` + `SUPABASE_STORAGE_BUCKET`.
  - Filtrage MIME (image, video, pdf), cap 10 Mo, safe filename.
- `src/app/api/quote-request/route.ts` refondu : Zod, rate limit (5/10min), `uploadFile()`, cap de **6 pièces jointes max**, logger structuré, gestion d'erreur unifiée.

## Migrations DB

- 5 fichiers SQL racine déplacés dans `archive/sql-legacy/` avec `README.md` explicatif.
- `drizzle.config.json` durci (`strict: true`, `verbose: true`, `out: ./drizzle`).
- Migration Drizzle générée : `drizzle/0000_initial_schema.sql` (source de vérité).

## Correctifs ESLint préexistants

- Script `/tmp/fix_apos.py` : échappement automatique des apostrophes dans le **texte JSX uniquement** (pas dans le JS/attributs).
- **74 → 29 erreurs ESLint** (les 45 fixées sont toutes des apostrophes).
- 12 fichiers UI corrigés : `a-propos`, `cgu`, `confidentialite`, `PricingSection`, `PublicPage`, `dashboard/{ai-chat, analytics, blog, my-businesses, outils, qr-code, reviews, settings, vitrine}/page.tsx`.

## Vérifications finales

```
✅ npx tsc --noEmit         → 0 erreur
✅ npx vitest run           → 27/27 tests passés
✅ npx next build           → Compiled successfully + 39/39 static pages
✅ npx eslint .             → 29 erreurs (contre 74), tous des faux positifs résiduels ou <a>→<Link>
```

---

# 🟢 Tour 1 — Sécurité, robustesse, config (rappel)

## Lot A — Sécurité (critique)

| Fichier | Change |
|---|---|
| `src/lib/session.ts` | Fail-fast si `NEXTAUTH_SECRET` manquant en prod ; `timingSafeEqual`. |
| `src/middleware.ts` | Vérifie la **signature** du token ; headers sécurité (`XCTO`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS prod) ; purge cookies invalides. |
| `src/lib/auth.ts` | Suppression des fonctions mortes (`registerUser`, `loginUser`, `generateToken` non signés). |
| `src/app/api/auth/session/route.ts` | Réécrit en `GET` (introspection) + `DELETE` (logout). |
| `src/app/api/auth/login/route.ts` | Zod ; rate limit 5/60s ; suppression cookie `auth_user` non-httpOnly. |
| `src/app/api/auth/register/route.ts` | Zod + rate limit 3/h ; **transaction** DB user + business + hours + faqs. |
| `src/contexts/AuthContext.tsx` | Hydratation via `GET /api/auth/session` (plus de lecture cookie non-httpOnly). |
| `src/app/api/blog/[id]/route.ts` | **Fix IDOR** (vérif appartenance business avant PUT/DELETE) + Zod. |
| `src/app/api/blog/[id]/publish/route.ts` | **Fix IDOR** identique. |

## Lot B — Robustesse

| Fichier | Change |
|---|---|
| `src/lib/logger.ts` | Logger structuré JSON en prod, texte en dev. |
| `src/lib/rate-limit.ts` | Token bucket mémoire (à remplacer par Redis en multi-instance). |
| `src/lib/api-error.ts` | `HttpError` + `handleApiError()` centralisé (log détaillé, réponse client neutre). |

## Lot C — Config

| Fichier | Change |
|---|---|
| `next.config.ts` | `poweredByHeader: false`, `compress: true`, `optimizePackageImports`, `images.remotePatterns`, headers sécurité. |
| `eslint.config.mjs` | Règles renforcées : `no-console`, `eqeqeq`, `no-var`, `prefer-const`, `no-unused-vars`. |
| `.gitignore` | Complet (test-results, .vercel, .env.*.local, drizzle/meta, …). |
| `.nvmrc` | Épingle Node 20.18. |
| `package.json` | `engines.node >= 20.18`. |
| Pages DB (`/annuaire`, `/[slug]`, `/[slug]/blog/**`, `/blog`, `/metier/[c]`, `/ville/[c]`) | `dynamic = "force-dynamic"` → fix prerender build. |

## Lot D — Documentation

- `AUDIT_REPORT.md` : rapport complet avec sévérité par point.
- `SECURITY.md` : politique de divulgation + checklist appliquée + roadmap.
- `CHANGELOG_AUDIT.md` : ce fichier.

---

# 🟡 Reste optionnel (non bloquant)

| Item | Priorité | Effort |
|---|---|---|
| Zod sur les ~45 routes API restantes | Moyen | 3-4h |
| Retirer `<a href="/">` → `<Link>` (3 occurrences) | Faible | 15min |
| Nettoyer les 27 apostrophes résiduelles dans blocs multi-lignes | Faible | 30min |
| Rate limiter Upstash Redis (multi-instance) | Élevé si scaling | 1h |
| CSP stricte avec nonce | Élevé pour banque | 2h |
| 2FA TOTP optionnel | Selon besoin | 1 jour |
| Tests E2E supplémentaires (Playwright) | Moyen | 2-3h |
| Audit RLS Supabase (défense en profondeur DB) | Élevé | 1-2h |
