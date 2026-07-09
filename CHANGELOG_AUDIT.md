# 🛠️ Améliorations issues de l'audit

Ce document liste **exactement** ce qui a changé dans ce lot d'audit + refonte partielle. Le rapport détaillé est dans [`AUDIT_REPORT.md`](./AUDIT_REPORT.md).

## Lot A — Sécurité (critique)

| Fichier | Change |
|---|---|
| `src/lib/session.ts` | Fail-fast si `NEXTAUTH_SECRET` manquant en prod ; comparaison HMAC en temps constant (`timingSafeEqual`) ; validation stricte du format token. |
| `src/middleware.ts` | Vérifie désormais la **signature** du token (pas juste la présence du cookie) ; ajoute les headers de sécurité (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `HSTS` en prod) ; purge les cookies invalides. |
| `src/lib/auth.ts` | Suppression des fonctions mortes/dangereuses (`registerUser`, `loginUser`, `generateToken`) qui doublonnaient `session.ts` avec un token non signé. |
| `src/app/api/auth/session/route.ts` | Réécrit : ne réimplémente plus le login (redondant). Expose `GET` (introspection session) + `DELETE` (logout). |
| `src/app/api/auth/login/route.ts` | Validation **Zod** ; **rate limit** 5/60s ; suppression du cookie `auth_user` **non-httpOnly** (fuite de rôle/plan) ; gestion d'erreur centralisée. |
| `src/app/api/auth/register/route.ts` | Zod + rate limit 3/h ; **transaction** DB pour user + business + workingHours + faqs (plus de compte orphelin) ; `emailVerified: false` par défaut. |
| `src/contexts/AuthContext.tsx` | Ne lit plus le cookie non-httpOnly. Hydrate via `GET /api/auth/session`. Ajoute `refresh()`. |
| `src/app/api/blog/[id]/route.ts` | **Fix IDOR** : vérifie l'appartenance de l'article au business courant avant `PUT`/`DELETE`. Validation Zod. |
| `src/app/api/blog/[id]/publish/route.ts` | **Fix IDOR** : idem sur `PUT publish`. |

## Lot B — Robustesse

| Fichier | Change |
|---|---|
| `src/lib/logger.ts` | Nouveau logger structuré JSON en prod, texte en dev. Filtrage par `LOG_LEVEL`. |
| `src/lib/rate-limit.ts` | Nouveau rate-limiter mémoire (token bucket). Prévu pour être remplacé par Redis/Upstash en multi-instance. |
| `src/lib/api-error.ts` | Nouveau : `HttpError`, `handleApiError()`, helpers `badRequest/unauthorized/…`. Log serveur complet, réponse client neutre. |

## Lot C — Config

| Fichier | Change |
|---|---|
| `next.config.ts` | `poweredByHeader: false`, `compress: true`, `optimizePackageImports`, `images.remotePatterns`, headers de sécurité en défense en profondeur. |
| `eslint.config.mjs` | Règles renforcées : `no-console` (warn), `eqeqeq`, `no-var`, `prefer-const`, `no-unused-vars`. Ignorés étendus. |
| `.gitignore` | Complet (test-results, .vercel, .env.*.local, IDE, OS, drizzle/meta…). |
| `.nvmrc` | Épingle Node 20.18. |
| `package.json` | `engines.node >= 20.18`, scripts `check`, `lint:fix`, `db:push`, `db:studio`, `test:e2e`. |
| Pages DB (`/annuaire`, `/[slug]`, `/[slug]/blog/**`, `/blog`, `/metier/[category]`, `/ville/[city]`) | Ajout de `dynamic = "force-dynamic"` + `revalidate = 0` → correction des erreurs de prerender au build sans DB. |

## Lot D — Documentation

- `AUDIT_REPORT.md` : rapport complet d'audit avec sévérité par point.
- `SECURITY.md` : politique de divulgation + checklist appliquée + roadmap.
- `CHANGELOG_AUDIT.md` : ce fichier (liste des modifs).

## Validation

```bash
npm install
npx tsc --noEmit    # ✅ 0 erreur
npx next build      # ✅ Compiled successfully (avec NEXTAUTH_SECRET + DATABASE_URL)
```

## À faire (suivi)

Voir la section "roadmap" de `SECURITY.md` et les lots non appliqués du `AUDIT_REPORT.md` :

- Consolider les 5 fichiers SQL racine avec des migrations Drizzle versionnées.
- Migrer les uploads base64 (`/api/quote-request`) vers un stockage objet.
- Généraliser Zod à toutes les routes API restantes.
- Retirer les deps non utilisées (`next-auth`, `@auth/drizzle-adapter`) ou les intégrer réellement.
- Ajouter des tests unitaires (Vitest) sur `session`, `rate-limit`, `permissions`.
- Résoudre les warnings ESLint préexistants (apostrophes, `<a>` vs `<Link>`, `any`).
