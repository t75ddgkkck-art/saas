# Vitrix — Plateforme SaaS pour artisans & indépendants

<!-- Badges CI -->

[![CI](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/ci.yml)
![Node](https://img.shields.io/badge/node-%3E%3D20.18-brightgreen)
![Next](https://img.shields.io/badge/next-16.2-black)
![Tests](https://img.shields.io/badge/tests-618%20passing-brightgreen)
![Lots](https://img.shields.io/badge/lots-38%20delivered-blue)
![License](https://img.shields.io/badge/license-proprietary-lightgrey)

Plateforme SaaS 360° pour artisans, indépendants et TPE : vitrine publique SEO, prise de RDV, devis, paiements, CRM, calendrier avec sync Google, espace client, équipe multi-rôles, IA, analytics, PWA mobile.

---

## 🎯 Fonctionnalités clés

### Côté visiteur (client final)

- **Vitrine publique** `/[slug]` — page SEO complète, mobile-first, 16 presets couleurs par métier + 10 fonts
- **Prise de rendez-vous** 24/7 avec créneaux dynamiques
- **Demande de devis** avec pièces jointes
- **Signature électronique** de devis en ligne (magic-link, hash SHA-256, valeur légale FR)
- **Acompte à la réservation** (Stripe Connect, anti no-show)
- **Espace client `/mon-compte`** — magic-link auth, historique RDV/devis, annulation self-service avec refund automatique
- **Avis clients** publics avec réponses IA (Premium)

### Côté professionnel

- **Dashboard `/dashboard`** avec KPIs temps réel
- **Page "Aujourd'hui"** mobile-first : timeline chrono du jour, deep links tel/GPS/WhatsApp, encaissement 1-tap, notes vocales
- **Calendrier** jour/semaine/mois avec drag&drop, sync Google Calendar bidirectionnelle, export ICS abonnable
- **CRM clients** : import/export CSV, doublons, no-show tracking, cron relance impayés
- **Équipe multi-rôles** : owner/admin/employee/viewer avec matrice permissions 30 capabilities, invitations magic-link
- **Analytics** RGPD-friendly : sources, funnel, comparatif période précédente, cron réactivation users inactifs
- **Devis IA** : décrire "Rénovation SDB 6m² carrelage" → IA génère 5-10 lignes avec prix médians (Premium)
- **Blog** avec génération IA (Pro+), SEO optimisé
- **QR Code** imprimable trackable
- **PWA mobile** : safe-area, push notifs OS, offline

### Sécurité & conformité

- **RGPD complet** : consent cookies, export données, droit à l'oubli, DPA templates, purge automatique
- **Rate-limits** sur toutes les routes publiques (login, register, book, quote, ai-chat, magic-links)
- **Brute-force detector** avec cooldown IP
- **CSP dynamique** avec headers de sécurité complets (COOP, CORP, Permissions-Policy)
- **Uploads sécurisés** (magic bytes MIME detection, sanitize SVG anti-XSS)
- **Idempotence webhooks Stripe** (dédup par event.id)

### Monétisation (Stripe)

- Plans **Free / Pro / Premium** avec matrice entitlements figée
- Trial 14 jours + grace period 3-7 jours
- Portal Stripe intégré (facturation self-service)
- Parrainage pro→pro : 1 mois offert par filleul converti

---

## ⚙️ Développement

### Setup

```bash
git clone https://github.com/OWNER/REPO.git vitrix
cd vitrix
nvm use               # active Node 20.18+ (fichier .nvmrc)
npm install           # installe deps + hooks husky (auto)
cp .env.example .env.local  # configure les vars — voir docs/LAUNCH_CHECKLIST.md
npm run env:check     # vérifie que les REQUISES sont OK
npm run dev           # http://localhost:3000
```

### Scripts npm

```bash
npm run dev              # Next dev server (Turbopack)
npm run build            # Build production
npm run start            # Serve le build
npm run lint             # ESLint (0 erreur en cible)
npm run format           # Prettier --write
npm run format:check     # Prettier --check (CI)
npm run typecheck        # tsc --noEmit
npm run test             # Vitest (618 tests, ~13s)
npm run test:coverage    # + coverage v8 HTML
npm run test:e2e         # Playwright
npm run env:check        # Vérif env vars (fail-fast)
npm run check            # typecheck + lint + format:check
npm run ci               # check + test (= ce que la CI valide)
npm run db:push          # Drizzle push schema (dev)
npm run db:studio        # Drizzle Studio (UI DB)
```

### Structure

```
src/
├── app/              — Next.js App Router
│   ├── [slug]/       — Vitrine publique (ISR 5 min)
│   ├── api/          — 80+ routes API (RESTful)
│   ├── dashboard/    — Interface pro (client-side)
│   ├── mon-compte/   — Espace client final
│   ├── devis/[token] — Signature publique magic-link
│   └── team/accept   — Acceptation invitation équipe
├── components/       — React composants (UI, layout, features)
├── contexts/         — Auth, Theme, Lang, Toast
├── db/               — Drizzle schema (35+ tables)
├── hooks/            — useEntitlement, useConfirm, useToast
├── lib/              — Logique métier (notify, push, ical, quote-signature…)
tests/unit/           — Vitest (618 tests)
tests/e2e/            — Playwright
docs/                 — Documentation par lot (14 docs)
sql/                  — Migrations idempotentes (00_apply_safe.sql)
```

---

## 🚀 Déploiement

**Voir [docs/LAUNCH_CHECKLIST.md](./docs/LAUNCH_CHECKLIST.md)** pour la checklist complète (2-3h pour un premier déploiement).

Résumé :

1. **Supabase** — créer projet + coller la connection string dans `DATABASE_URL`
2. **Stripe** — 4 price IDs (Pro/Premium × monthly/yearly) + webhook endpoint
3. **Resend** — vérifier votre domaine (DKIM/SPF/DMARC)
4. **Vercel** — Import GitHub repo + coller toutes les env vars + Deploy
5. **DNS** — pointer votre domaine sur Vercel
6. **Migration DB** : `psql "$DATABASE_URL" -f sql/00_apply_safe.sql`
7. **Vérifier** : `GET https://votre-domaine/api/health` → `ok: true`

### Environnements

| Env         | Description              | Build           |
| ----------- | ------------------------ | --------------- |
| Development | Local dev avec HMR       | `npm run dev`   |
| Preview     | Vercel deploy par PR     | Auto via GitHub |
| Production  | Vercel deploy sur `main` | Auto via GitHub |

---

## 🤖 Intégration continue

La CI GitHub Actions (`.github/workflows/ci.yml`) exécute à chaque push/PR :

- **typecheck** — `tsc --noEmit`
- **lint** — `eslint .` (0 erreur tolérée)
- **format** — `prettier --check .`
- **test** — `vitest run --coverage` + upload HTML artifact
- **audit** — `npm audit --production` (non bloquant)
- **build** — `next build` (dépend des 4 précédents)

Le job `ci-success` agrège tous les résultats — à configurer comme **required check** dans les branch protection rules.

Dependabot regroupe les mises à jour hebdo (`.github/dependabot.yml`).

**Coverage actuel** : lines 45%, functions 62%, branches 82%. Objectif v2 : 60% lines.

---

## 📚 Documentation détaillée

Chaque grand lot a sa doc dédiée dans `docs/` :

| Doc                                                   | Contenu                                                |
| ----------------------------------------------------- | ------------------------------------------------------ |
| [CALENDAR.md](./docs/CALENDAR.md)                     | Vues jour/semaine/mois + drag&drop + sync Google + ICS |
| [ENTITLEMENTS.md](./docs/ENTITLEMENTS.md)             | Matrice features × plans + `<UpgradeGate>`             |
| [TEAM.md](./docs/TEAM.md)                             | 4 rôles + invitations magic-link                       |
| [DEPOSIT.md](./docs/DEPOSIT.md)                       | Acompte Stripe (anti no-show)                          |
| [CLIENT_AREA.md](./docs/CLIENT_AREA.md)               | Espace client final /mon-compte                        |
| [TODAY_VIEW.md](./docs/TODAY_VIEW.md)                 | Page mobile-first terrain                              |
| [NOTIFICATIONS.md](./docs/NOTIFICATIONS.md)           | Push OS + safe-area + helper notify()                  |
| [ANALYTICS.md](./docs/ANALYTICS.md)                   | Tracker RGPD + réactivation                            |
| [VITRINE_V2.md](./docs/VITRINE_V2.md)                 | Personnalisation étendue                               |
| [QUOTE_AI_SIGNATURE.md](./docs/QUOTE_AI_SIGNATURE.md) | Devis IA + signature électronique                      |
| [CRM.md](./docs/CRM.md)                               | Gestion clients avancée                                |
| [STRIPE.md](./docs/STRIPE.md)                         | Configuration paiements                                |
| [AUTH.md](./docs/AUTH.md)                             | Auth pro (login/register/reset/verify)                 |
| [SECURITY.md](./docs/SECURITY.md)                     | Rotation secrets + checklist post-incident             |
| [MONITORING.md](./docs/MONITORING.md)                 | Sentry + alertes + healthcheck                         |
| [RGPD.md](./docs/RGPD.md)                             | Conformité + export + purge                            |
| [BUSINESS.md](./docs/BUSINESS.md)                     | Parrainage + API v1 + webhooks sortants                |
| [DB.md](./docs/DB.md)                                 | Convention Drizzle + migrations                        |
| [LAUNCH_CHECKLIST.md](./docs/LAUNCH_CHECKLIST.md)     | **Checklist déploiement (à lire en 1er)**              |

Historique complet des changements : [CHANGELOG_AUDIT.md](./CHANGELOG_AUDIT.md) (34 tours documentés).

Propositions produit : [PROPOSITIONS_V3.md](./PROPOSITIONS_V3.md) + [AUDIT_UX_MOBILE_V4.md](./AUDIT_UX_MOBILE_V4.md).

Contribution : [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## 🛠️ Stack technique

- **Next.js 16** (App Router, Turbopack, RSC)
- **React 19**
- **TypeScript 5.9** (strict)
- **Tailwind CSS v4** (avec `@custom-variant dark`, safe-area utilities)
- **Drizzle ORM 0.45** + PostgreSQL (Supabase)
- **Stripe 22** (Connect + Subscriptions + Webhooks)
- **Resend 6** (email transactionnel)
- **OpenAI** via fetch direct (0 SDK)
- **Zod 3** (validation runtime)
- **Vitest 2** + Playwright (tests)
- **ESLint 9** + Prettier 3 + Husky + lint-staged

**Aucune dep bloat** : recharts lazy-loadé, web-push/sentry optionnels via `Function("return require")()`, HTML5 drag&drop natif (pas de FullCalendar/react-beautiful-dnd), iCalendar RFC 5545 maison.

---

## 📄 License

Propriétaire — © 2025 Vitrix. Tous droits réservés.

Pour toute question commerciale : contact@vitrix.fr
Pour toute vulnérabilité de sécurité : security@vitrix.fr (jamais dans une issue publique).
