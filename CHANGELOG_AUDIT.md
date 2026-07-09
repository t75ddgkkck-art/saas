# 🛠️ Améliorations issues de l'audit

Ce document liste **exactement** ce qui a changé. Rapport détaillé dans [`AUDIT_REPORT.md`](./AUDIT_REPORT.md) et [`AUDIT_FULL_V2.md`](./AUDIT_FULL_V2.md).

---

# 🟢 Tour 3 — Lots 1 + 2 complets

## Lot 1 — Sécurité restante

### Routes API refondues (Zod + rate-limit + fix IDOR + api-error unifié)

**Public (rate-limit strict pour bloquer scripting) :**
| Route | Limit | Fenêtre | Cause |
|---|---|---|---|
| `POST /api/verify-siret` | 10 | 60s | Coût API INSEE |
| `POST /api/qr-code` | 30 | 60s | CPU |
| `POST /api/track` | 60 | 60s | Empêche pollution stats |
| `POST /api/ai-chat` | 15 | 300s | **Coût OpenAI** |
| `POST /api/book-appointment` | 5 | 600s | Anti-spam RDV |
| `POST /api/reviews/public` | 3 | 3600s | Anti-spam avis |
| `POST /api/stripe/checkout` | 20 | 60s | Anti-abus |
| `POST /api/stripe-payment` | 20 | 60s | Anti-abus |

**Authentifié (Zod + validation stricte) :**
- `POST /api/team` — Zod + fix IDOR sur DELETE (vérif membre appartient au business)
- `POST /api/loyalty` — Zod discriminatedUnion (award/redeem) + fix IDOR sur `clientId`
- `POST /api/notifications` + nouveau `PATCH` — fix IDOR + Zod + support `markAllRead`
- `PUT /api/my-availability` + `POST` génération créneaux — Zod (dayOfWeek, TIME_RE)
- `POST/DELETE /api/schedule/exceptions` — Zod + double filtre WHERE
- `PUT /api/my-faqs` + `PUT /api/quote-form-fields` — Zod + cap (50 questions, 30 champs)
- `PUT /api/services` — Zod + cap 200 services
- `PUT /api/my-business` — Zod complet (44 champs, longueur max, format couleur `#RRGGBB`)
- `POST /api/appointments/complete` — Zod + double filtre WHERE
- `POST/GET /api/blog` — Zod + vérif limite plan + anti-collision slug
- `POST /api/clients` — Zod + anti-doublon email ET téléphone
- `POST /api/subscribe` + `cancel` — Zod, fix bug downgrade immédiat sur cancel (attend le webhook)

**Routes IA (rate-limit + Zod + fallback logger) :**
- `POST /api/ai/monthly-report` — 5/h
- `POST /api/ai/social-post` — 20/h, Zod platform enum
- `POST /api/ai/auto-review` — Zod + fix IDOR sur appointmentId
- `POST /api/ai-blog` — 10/h, Zod (topic ≤ 300)
- `POST /api/ai-tools` — 15/h, Zod discriminatedUnion (report|social-post)
- `POST /api/reviews/ai-reply` — 20/h, Zod + fix IDOR

**Infra :**
- `POST /api/stripe/webhook` — singleton Stripe, logger structuré, 200 OK sur erreur DB (évite retry loop), typed events
- `POST /api/push/subscribe` — nouveau : Zod + upsert par (user, endpoint), auth requise
- `POST /api/upload` — nouvelle route dédiée aux uploads (folder validé : logo/cover/profile/gallery/blog/signature/misc)

### Nouveaux helpers `src/lib/api-helpers.ts`
- `parseJson<T>` — parse safe
- `validateBody<T>` — Zod → HttpError 400 automatique
- `assertOwnership` — helper de fix IDOR réutilisable

### Fix critique déjà appliqué au tour précédent
- Suppression de `localStorage.setItem("auth_user", ...)` dans login/register

## Lot 2 — Code mort, duplications, dette

### Suppressions (code mort)
- `src/lib/page-templates.ts` (89 lignes, 0 usage)
- `src/lib/invoice.ts` (113 lignes, 0 usage)
- `src/components/ui/MobileButton.tsx` — remplacé par `Button` responsive
- `src/components/ui/MobileInput.tsx` — remplacé par `Input` responsive
- `src/components/ui/MobileModal.tsx` — remplacé par `Modal` (avec Escape + focus)
- `src/app/sw.js` — doublon supprimé (le vrai SW est `public/sw.js`)

### Migration `dashboard/clients/page.tsx`
Passage de `MobileButton/Input/Modal` → composants standards responsives.

### Service Worker refondu (`public/sw.js`)
- Version bump `vitrix-v2` avec purge automatique des anciens caches
- Stratégie **cache-first** pour assets statiques (`/icons/*`, `/_next/static/*`, images, fonts)
- Stratégie **network-first** pour tout le reste avec fallback offline
- Handler `push` typé JSON safe + handler `notificationclick` → ouvre l'URL
- Skip API et /dashboard

### Types DB centralisés (`src/db/types.ts`)
Export de **26 types** dérivés du schéma Drizzle (`User`, `Business`, `Client`, `Quote`, `Appointment`, `Payment`, `Notification`, `BlogPost`, `LoyaltyPoint`, …). Fini les redéclarations de props à la main dans chaque page.

### Découpage `PublicPage.tsx` (944 → ~880 lignes, 3 sections extraites)
- `src/app/[slug]/sections/WorkingHoursCard.tsx` — bloc horaires
- `src/app/[slug]/sections/QrCodeCard.tsx` — carte QR de partage
- `src/app/[slug]/sections/PublicFooter.tsx` — pied de page + branding
- `README.md` documentant les 15 sections restantes à extraire

Bonus : suppression des imports morts (`Clock`, `DAYS`) et refactor du type `PublicPageProps.business` avec le vrai type `Business` du schéma DB (→ tous les `(business as any).X` supprimés).

### Logger structuré (28 → 8 `console.*` restants)
Passages `console.log/error/warn` → `logger.info/warn/error` dans :
- `src/lib/email.ts`, `sms.ts`, `calendar.ts`, `google-reviews.ts`, `siret.ts`
- `src/app/api/dashboard/route.ts` (bonus : réécrit avec agrégats SQL, plus de N+1)
- `src/app/api/stripe/webhook/route.ts` (singleton + typed events)
- `src/app/api/google/callback/route.ts`, `pdf/invoice`, `push/subscribe`, `stripe-payment`, `stripe/callback`, `stripe/connect`
- `src/app/api/cron/quote-reminders/route.ts` (bonus : **fix N+1 via JOIN unique** + envoi réel des emails/SMS avec `reminder_sent_at` pour ne pas répéter)
- `src/app/api/cron/reminder-sms/route.ts` (bonus : SMS + WhatsApp réels via Twilio)
- `src/components/layout/PWARegister.tsx` (bonus : SW enregistré prod-only)
- `src/hooks/usePWA.ts` (bonus : type `BeforeInstallPromptEvent`)

Les 8 restants sont côté client dans des catch UI silencieux (non critiques en prod).

### Chasse aux `any` (165 → 2)
- Toutes les routes API : `catch (error: any)` → `handleApiError(err, {route})`
- `Record<string, { label: string; variant: any }>` → union stricte des variants Badge (5 fichiers dashboard)
- `useState<any>` → types dérivés du schéma DB (`useState<Business | null>`, `useState<Client | null>`, …)
- `PublicPage.tsx` : `(business as any).X` → typé directement via `Business` du schema
- `dashboard/vitrine/page.tsx` : nouveaux types `MenuCategory`/`MenuItem` pour l'éditeur JSON
- `dashboard/page.tsx` : `ListSection<T>` générique + type `DashboardData`
- `SignaturePad`: type `SignatureMetadata` exporté
- `QuoteForm`: types propres (`QuoteField`)
- `whitelabel.ts`: `business: { slug: string }` (contrat minimal)
- `create-notification.ts`: `data?: Record<string, unknown>`
- Nouveau `src/types/jspdf-autotable.d.ts` — module augmentation pour la propriété `lastAutoTable`

**Les 2 restants** : dans `db/index.ts`, Proxy générique (légitime).

## Schéma DB
- Ajout des colonnes `signatureUrl` + `reminderSentAt` à la table `quotes`
- Correction : le SQL `sql/00_apply_safe.sql` utilise bien `is_read` (colonne réelle du schema) au lieu de `read`

## Validations finales

```
tsc --noEmit  → 0 erreur
vitest run    → 27/27 tests OK
next build    → Compiled successfully + 34/34 static pages
```

---

# 🟢 Tour 2 — Favicon, Vercel/IONOS, roadmap (rappel)

Voir historique git commit `e642e8b`.

# 🟢 Tour 1 — Sécurité, robustesse, config (rappel)

Voir historique git commit `4c25f9c`.
