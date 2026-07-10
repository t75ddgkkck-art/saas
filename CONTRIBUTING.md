# Contribuer à Vitrix

Merci de contribuer ! Ce doc décrit le workflow pour rester rapide et sans casser la prod.

## Setup local

```bash
git clone <repo>
cd saas
npm install       # installe deps + active husky pre-commit auto (script `prepare`)
cp .env.example .env  # remplir DATABASE_URL + NEXTAUTH_SECRET minimum
npm run dev
```

Le hook `pre-commit` est installé automatiquement grâce au script `prepare` (husky init).

## Scripts principaux

| Commande               | Rôle                                         |
| ---------------------- | -------------------------------------------- |
| `npm run dev`          | Serveur Next avec HMR                        |
| `npm run build`        | Build prod (Turbopack)                       |
| `npm run typecheck`    | `tsc --noEmit`, 0 erreur exigée              |
| `npm run lint`         | ESLint                                       |
| `npm run lint:fix`     | ESLint avec auto-fix                         |
| `npm run format`       | Prettier — formate TOUT le repo              |
| `npm run format:check` | Vérifie sans écrire (utile CI)               |
| `npm run test`         | Vitest run (one-shot)                        |
| `npm run test:watch`   | Vitest en mode watch dev                     |
| `npm run test:e2e`     | Playwright E2E                               |
| `npm run check`        | typecheck + lint + format:check (avant push) |
| `npm run audit:check`  | `npm audit` production, échoue >= moderate   |

## Convention commits

Pas de convention rigide (pas de conventional-commits imposé), mais **PRÉFIXER par le lot d'audit** quand applicable :

```
lot 24 CRM: import/export CSV, fiche client, doublons
lot 22 UX cohérente: 10 alert() nettoyés
fix(auth): reset password token expire à 1h au lieu de 24h
```

Bad :

```
wip
update
fix stuff
```

## Workflow branche

```
main (protégée)
 └── feat/mon-truc
      └── PR → review → merge squash
```

- Petites PRs préférées (< 400 lignes diff)
- Description claire avec **impact business** et **actions post-déploiement** si migration DB
- Screenshots pour tout changement UI

## Style code

**Auto-géré par Prettier + ESLint via pre-commit**. Ne vous prenez pas la tête :

- 2 spaces indent
- Point-virgules
- Double quotes
- Trailing comma ES5
- Line width 100

## Tests

- Chaque nouvelle route API → test contract minimum (schéma Zod)
- Chaque nouveau helper pur → test unit
- E2E réservés aux parcours critiques (login, register → 1er RDV, checkout Stripe)

Objectif coverage : > 60% côté libs. Vue actuelle : `npx vitest run --coverage` (à activer en Lot 27).

## Base de données

Ne PAS modifier les migrations Drizzle générées à la main. Toute nouvelle table/colonne :

1. Modifier `src/db/schema.ts` (Drizzle)
2. Ajouter le SQL équivalent dans `sql/00_apply_safe.sql` (idempotent, `ADD COLUMN IF NOT EXISTS`)
3. Le user prod joue `sql/00_apply_safe.sql` dans Supabase

Voir `docs/DB.md` section conventions.

## Sécurité

Toute modification touchant à :

- L'authentification
- Le rate-limiting
- Les uploads
- Les webhooks Stripe
- Les cookies

→ Review obligatoire, tests unit renforcés. Voir `docs/SECURITY.md`.

## Signaler un bug

**Bug de sécurité** : `security@vitrix.fr` (ne PAS ouvrir d'issue publique).

**Bug fonctionnel** : issue GitHub avec :

- Steps to reproduce
- Comportement attendu vs observé
- Env (browser, OS, plan Vitrix)
- Screenshots / logs Sentry si dispo

## Aide

- Doc technique : dossier `docs/`
- Design system live : `/design-system` (dev serveur)
- Slack équipe : #vitrix-dev
