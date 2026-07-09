# 🔍 Rapport d'audit du projet SaaS (ArtisanPro / Vitrix)

**Date** : 2026-07-09
**Repo** : https://github.com/t75ddgkkck-art/saas.git
**Stack** : Next.js 16 · React 19 · TypeScript · PostgreSQL · Drizzle ORM · Stripe · Resend · Tailwind v4 · PWA

---

## 📊 Vue d'ensemble

- 186 fichiers, ~150 sources TS/TSX
- 62 routes API, 26+ pages
- Un schéma DB de 740 lignes (30+ tables)
- App mobile RN (mobile/) séparée
- 4 fichiers SQL de migration à la racine (à consolider)

Le projet est fonctionnellement riche mais présente des **faiblesses transversales** critiques (sécurité, cohérence, robustesse). Je les classe ci-dessous par sévérité, puis j'applique des correctifs par lots.

---

## 🚨 LOT 1 — Sécurité (BLOQUANT)

### 1.1 Faille IDOR massive sur les routes ressources
Beaucoup de routes `/api/<resource>/[id]` (blog, quotes, notifications, appointments…) modifient/suppriment une ressource **sans vérifier qu'elle appartient au business courant**. Exemple `PUT /api/blog/[id]` : n'importe quel utilisateur authentifié peut éditer/supprimer les articles des autres.

### 1.2 Double système d'authentification incohérent
- `src/lib/auth.ts` définit un `generateToken()` random **non signé**, non stocké → inutilisable.
- `src/app/api/auth/session/route.ts` réimplémente encore un autre `generateToken()` random, pose un cookie qui **n'est jamais vérifié**.
- Seul `src/lib/session.ts` (HMAC) est réellement utilisé.
- Résultat : trois codes qui se chevauchent → confusion, bugs de session.

### 1.3 Secret par défaut faible
`SECRET = process.env.NEXTAUTH_SECRET || "dev-secret-change-me"` : si la variable manque en prod, tous les tokens sont trivialement falsifiables. Doit **fail-fast** en production.

### 1.4 Cookie `auth_user` non signé et non-httpOnly
Un cookie JSON contenant id/email/role/subscription est écrit côté serveur mais lisible/altérable côté client. Le middleware ne l'utilise pas, mais l'UI l'affiche. Un utilisateur peut manipuler son cookie pour prétendre être `premium` côté UI et déclencher des appels backend qu'il ne devrait pas voir. → Supprimer, ou signer, ou repasser par `/api/auth/session`.

### 1.5 Middleware perméable
`src/middleware.ts` ne fait **que vérifier la présence du cookie** `auth_token` (pas sa signature) et laisse toutes les routes API descendre sans autorisation granulaire. `auth-middleware.ts` existe mais **n'est appelé nulle part**.

### 1.6 Rate-limiting inexistant
Aucun throttling sur `/api/auth/login`, `/api/auth/register`, `/api/ai-chat`, `/api/quote-request`, `/api/verify-siret` → brute-force et abus d'API OpenAI possibles.

### 1.7 Pas d'énumération d'utilisateurs mais message CORRECT — OK

### 1.8 Webhook Stripe : instance recréée à chaque call
Coût OK mais `Stripe` devrait être un singleton, et surtout **il faut versionner l'API** (`apiVersion`) pour éviter les régressions silencieuses.

### 1.9 Uploads en base64 dans la DB (`quote-request`)
`data:${type};base64,${...}` stocké dans `text` : jusqu'à 10 Mo × N fichiers dans PostgreSQL. Explose la taille, casse la pagination, et **rend chaque row énorme**. → Utiliser Supabase Storage / S3 / R2.

### 1.10 CORS/Headers de sécurité absents
Pas de `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy`.

---

## ⚠️ LOT 2 — Robustesse & fiabilité

### 2.1 `error.message` exposé au client
Presque toutes les routes catch `error: any` et renvoient `error.message` avec statut 500. Fuite d'infos (stack, requêtes SQL). → Logger côté serveur, renvoyer message générique.

### 2.2 Validation manuelle sans Zod
`zod` est dans les dépendances mais **jamais utilisé** dans le code source. Chaque route revalide ses champs "à la main" → couverture partielle, incohérente.

### 2.3 Pas de gestion transactionnelle
`register` insère user + business + workingHours + faqs sans transaction. Un échec à mi-parcours laisse la DB dans un état incohérent.

### 2.4 `console.log/error` dispersés (63 occurrences)
Aucun logger structuré (pas de niveaux, pas de corrélation), impossible à filtrer en prod.

### 2.5 Types `any` (173 occurrences)
`strict: true` est activé mais contourné partout par des `catch (error: any)` et `body as any`. La sécurité de type est illusoire.

### 2.6 Cron : aucune notification réellement envoyée
`quote-reminders` construit les rappels mais tout est commenté (`// TODO`) → fonctionnalité annoncée mais inexistante.

### 2.7 Boucles N+1 en cron
`for (const quote of oldQuotes) { db.select... clients ... businesses }` : requêtes séquentielles au lieu d'un JOIN.

### 2.8 4 fichiers SQL à la racine + Drizzle
`sql-migration-complete.sql`, `sql-migration-update.sql`, `sql-fidelite.sql`, `sql-clean-demo-data.sql`, `supabase-schema.sql` **en plus** de Drizzle → source de vérité floue.

### 2.9 Le dossier `test-results/` est commité
Devrait être ignoré par git.

### 2.10 `.eslintrc`/`eslint.config` très permissif
Pas de règles anti-`any`, anti-`console`, anti-unused, hook-deps, etc.

---

## 🐛 LOT 3 — Qualité UX / SEO / Perf

### 3.1 `next.config.ts` quasi vide
Pas de `images.remotePatterns`, pas de `poweredByHeader: false`, pas de `compress`, pas de `experimental.optimizePackageImports`.

### 3.2 Pas de `loading.tsx` / `error.tsx` / `not-found.tsx` globaux visibles.

### 3.3 Redirection `/p/:slug*` → `/:slug*` permanent
OK mais peut entrer en collision avec `/dashboard`, `/api`, `/login`, `/blog`, `/annuaire`… car `[slug]` capte tout. Nécessite au minimum une garde dans `PublicPage.tsx`.

### 3.4 PWA : `sw.js` en public **et** en `src/app/sw.js`
Duplication, risque de servir la mauvaise version.

### 3.5 Assets images inexistants
Uniquement des SVG dans public/icons/ ; pas de PNG 192/512 pour compat PWA iOS/Android.

### 3.6 `robots.txt` / `sitemap.xml` : à vérifier qu'ils excluent bien `/dashboard`.

### 3.7 Textes durs en français
`src/contexts/LangContext.tsx` existe mais nombreux textes en dur.

---

## 🧹 LOT 4 — Dépendances & config

- `lucide-react ^1.23.0` : version très ancienne (actuel ≥ 0.5x… en fait v1 est un fork). Vérifier.
- `next-auth ^4.24` installé + `@auth/drizzle-adapter` mais **non utilisés** → à retirer si non intégrés.
- `@types/*` en `dependencies` au lieu de `devDependencies`.
- Pas de `.nvmrc` / `engines` : rebuilds Vercel imprévisibles.
- `drizzle.config.json` : vérifier `schemaFilter`, `strict`, `verbose`.

---

## 🧪 LOT 5 — Tests

- Un seul dossier `tests/e2e` (Playwright) + `test-critical.sh` shell.
- **Aucun test unitaire** (Vitest/Jest absent).
- Pas de test des routes API critiques (login, checkout, webhook Stripe, permissions).

---

# ✅ Plan d'amélioration par lots

Je vais appliquer les correctifs suivants dans cet ordre :

- **Lot A (sécurité critique)** : middleware réel avec vérif signature + rôles, unification auth, headers sécurité, secret fail-fast, correction IDOR blog, rate-limit basique.
- **Lot B (robustesse)** : logger, helper `handleApiError`, transactions register, suppression code mort (`auth.ts` `registerUser`/`loginUser`/`generateToken`, `session/route.ts` duplicate).
- **Lot C (config/qualité)** : `next.config.ts` durci, `eslint` renforcé, `.gitignore` à jour, `engines`, `.nvmrc`.
- **Lot D (docs)** : `SECURITY.md`, `CONTRIBUTING.md`, section audit dans README.

Les modifications sont appliquées dans les commits suivants.
