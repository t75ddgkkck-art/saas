# Vitrix — Plateforme SaaS pour artisans & indépendants

<!-- Lot 27 — badges CI. Remplacer OWNER/REPO par le vrai chemin GitHub. -->

[![CI](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/ci.yml)
![Node](https://img.shields.io/badge/node-%3E%3D20.18-brightgreen)
![Next](https://img.shields.io/badge/next-16.2-black)
![Tests](https://img.shields.io/badge/tests-324%20passing-brightgreen)
![License](https://img.shields.io/badge/license-proprietary-lightgrey)

Plateforme SaaS permettant aux artisans et indépendants de créer leur page professionnelle unique et de gérer toute leur activité depuis un seul endroit.

## ⚙️ Développement

```bash
npm install         # installe deps + hooks husky
npm run dev         # dev server (Turbopack)
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run format      # prettier --write
npm run test        # vitest (unit)
npm run test:coverage  # vitest + coverage v8
npm run build       # next build
npm run ci          # typecheck + lint + format:check + tests (= ce que la CI valide)
```

## 🤖 Intégration continue

La CI GitHub Actions (`.github/workflows/ci.yml`) exécute en parallèle à chaque push / PR :

- **typecheck** — `tsc --noEmit`
- **lint** — `eslint .` (0 erreur, warnings tolérés)
- **format** — `prettier --check .`
- **test** — `vitest run --coverage` (seuils dans `vitest.config.ts`)
- **audit** — `npm audit --audit-level=moderate --production` (non bloquant)
- **build** — `next build` (dépend des 4 premiers)

Le job `ci-success` (final) agrège les résultats et sert de _required check_ à configurer dans les settings de branche GitHub.

Coverage HTML disponible dans les artifacts du run (retention 14j).

Dependabot regroupe les mises à jour hebdo (`.github/dependabot.yml`) — voir aussi `CONTRIBUTING.md`.

## 🚀 Fonctionnalités

### Page Publique (`/p/[slug]`)

- Logo, photo de couverture et photo de profil
- Description de l'entreprise
- Boutons Appeler, WhatsApp, SMS, Email
- Prise de rendez-vous en ligne avec créneaux
- Demande de devis
- Galerie photos/vidéos
- Avis clients avec note moyenne
- FAQ interactive
- Zone d'intervention + Google Maps
- Réseaux sociaux
- Bouton Urgence
- QR Code imprimable
- SEO optimisé

### Dashboard Professionnel

- **Tableau de bord** : statistiques, CA, rendez-vous, clients
- **Rendez-vous** : calendrier, disponibilités, gestion des créneaux
- **Devis** : création multi-lignes, suivi, statuts
- **CRM** : gestion clients, historique, notes
- **Paiements** : suivi des transactions (Stripe)
- **Avis** : gestion et modération
- **Galerie** : photos et vidéos
- **Assistant IA** : chatbot intelligent 24/7
- **QR Code** : génération et personnalisation
- **Mon entreprise** : gestion du profil public
- **Paramètres** : compte, horaires, design, notifications
- **Statistiques** : visiteurs, provenance, appareils

## 🔒 Inscription Professionnelle

L'inscription est **réservée aux professionnels avec numéro SIRET** :

1. Vérification du SIRET via l'API INSEE (ou algorithme de Luhn)
2. Création automatique du compte ET de la page publique
3. Horaires par défaut et FAQ pré-remplis
4. QR code généré automatiquement

## 🛠 Architecture

```
src/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── login/page.tsx              # Connexion
│   ├── register/page.tsx           # Inscription SIRET (3 étapes)
│   ├── p/[slug]/                   # Pages publiques des artisans
│   ├── dashboard/                  # Espace professionnel
│   │   ├── page.tsx                # Tableau de bord
│   │   ├── appointments/           # Rendez-vous
│   │   ├── quotes/                 # Devis
│   │   ├── clients/                # CRM
│   │   ├── payments/               # Paiements
│   │   ├── reviews/                # Avis
│   │   ├── gallery/                # Galerie
│   │   ├── ai-chat/                # Assistant IA
│   │   ├── qr-code/                # QR Code
│   │   ├── analytics/              # Statistiques
│   │   ├── my-business/            # Profil entreprise
│   │   └── settings/               # Paramètres
│   └── api/                        # API endpoints
│       ├── auth/                   # Auth (login, register)
│       ├── verify-siret/           # Vérification SIRET
│       ├── qr-code/                # Génération QR code
│       ├── dashboard/              # Données dashboard
│       └── my-business/            # Gestion entreprise
├── components/
│   ├── ui/                         # Composants de base
│   └── layout/                     # Layout (Sidebar)
├── contexts/
│   └── AuthContext.tsx             # Context d'authentification
├── db/
│   ├── schema.ts                   # Schéma Drizzle (18 tables)
│   └── index.ts                    # Client DB
└── lib/
    ├── auth.ts                     # Authentification
    ├── siret.ts                    # Vérification SIRET + QR code
    ├── seed.ts                     # Données démo
    └── utils.ts                    # Utilitaires
```

## 📦 Variables d'environnement

Voir `.env.example` pour la liste complète.

### Minimum requis pour démarrer :

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app_db
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Pour la production :

```bash
# Auth
NEXTAUTH_SECRET=<générer avec openssl rand -base64 32>

# SIRET (optionnel, fallback Luhn)
INSEE_API_KEY=<clé API INSEE>

# Stripe (paiements)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# OpenAI (assistant IA)
OPENAI_API_KEY=sk-proj-...

# Resend (emails)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@votre-domaine.com

# Twilio (SMS)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+33...
```

## 💳 Abonnements

| Fonctionnalité        | Gratuit | Pro (29€) | Premium (79€) |
| --------------------- | ------- | --------- | ------------- |
| Page publique         | ✅      | ✅        | ✅            |
| Contact               | ✅      | ✅        | ✅            |
| Galerie               | ✅      | ✅        | ✅            |
| Rendez-vous           | ❌      | ✅        | ✅            |
| Paiement              | ❌      | ✅        | ✅            |
| Devis                 | ❌      | ✅        | ✅            |
| CRM                   | ❌      | ✅        | ✅            |
| Assistant IA          | ❌      | ❌        | ✅            |
| SMS/WhatsApp          | ❌      | ❌        | ✅            |
| Statistiques avancées | ❌      | ❌        | ✅            |

## 🏗 Stack Technique

- **Frontend** : Next.js 16, React 19, TypeScript
- **Styling** : Tailwind CSS 4, class-variance-authority
- **Base de données** : PostgreSQL + Drizzle ORM
- **Charts** : Recharts
- **QR Code** : qrcode
- **Icônes** : Lucide React

## 🚀 Démarrage

```bash
# Installation
npm install

# Développement
npm run dev

# Build production
npm run build

# Lancer en production
npm start
```

## 📄 Licence

Propriétaire - ArtisanPro © 2025
"# saas"
