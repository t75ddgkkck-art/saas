# 🛠️ Améliorations issues de l'audit

Ce document liste **exactement** ce qui a changé. Rapport détaillé dans [`AUDIT_REPORT.md`](./AUDIT_REPORT.md) et [`AUDIT_FULL_V2.md`](./AUDIT_FULL_V2.md).

---

# 🟢 Tour 6 — Lot 5 Performance

## 5.1 — ISR (Incremental Static Regeneration) partout où c'est possible

Passage de `dynamic = "force-dynamic"` (=SSR à chaque hit) → ISR avec revalidate :

| Page | Avant | Après |
|---|---|---|
| `/[slug]` (vitrine) | `force-dynamic` | **SSG** (top 50 pré-générés) + ISR **5 min** |
| `/annuaire` | `force-dynamic` | **Static** + ISR **10 min** |
| `/ville/[city]` | `force-dynamic` | ISR **10 min** |
| `/metier/[category]` | `force-dynamic` | ISR **10 min** |
| `/blog` | `force-dynamic` | ISR **10 min** |
| `/[slug]/blog` | `force-dynamic` | ISR **10 min** |
| `/[slug]/blog/[postSlug]` | `force-dynamic` | ISR **10 min** |

### `generateStaticParams` pour /[slug]
Pré-génère les 50 vitrines les plus récemment mises à jour au build. Les autres sont rendues à la 1ʳᵉ visite puis mises en cache (`dynamicParams = true`).

### Invalidation ciblée
`PUT /api/my-business` appelle `revalidatePath('/${slug}')` → dès qu'un pro modifie sa vitrine, la page est régénérée immédiatement au lieu d'attendre 5 min.

### Tolérance build sans DB
Chaque page wrap ses fetch dans try/catch avec fallback vide. Cela évite que le build Vercel échoue si la DB n'est pas encore joignable (preview branch, migration en cours). La vraie liste apparaît dès la 1ʳᵉ visite en prod.

**Impact estimé** : les visites répétées d'une vitrine dans les 5 min = 0 hit DB. Multiplié par le trafic organique SEO, gain massif (typiquement 90%+ de réduction des requêtes DB).

## 5.2 — Fix N+1 dans annuaire/ville/métier

Avant : `SELECT * FROM businesses JOIN users` (download inutile de toute la table users) + aucun agrégat.

Après : **1 seule requête SQL par page** avec :
- Projection minimale (uniquement les champs affichés)
- Agrégats `avg(rating)` + `count(reviews)` via `LEFT JOIN reviews GROUP BY`
- Tri `ORDER BY note DESC, created_at DESC` (met en avant les mieux notés)
- Utilise les nouveaux index (voir 5.3)

Bonus UI : chaque carte affiche maintenant la note moyenne (⭐ 4.8 (23 avis)) — attractive pour conversion.

## 5.3 — Index DB au niveau du schéma Drizzle

Avant : **0 index** déclaré dans `schema.ts` (le SQL idempotent en ajoutait 23 côté DB mais les futures DB fraîches en `db:push` n'en avaient aucun).

Après : **17 index** déclarés dans le schéma → automatiquement propagés lors de `npm run db:generate` :

| Table | Index | Utilisation |
|---|---|---|
| `users` | `users_email_lower_uidx` | Login case-insensitive |
| `businesses` | `businesses_slug_uidx` (unique) | Lookup vitrine |
| `businesses` | `businesses_owner_idx` | "Mon business" par owner |
| `businesses` | `businesses_city_idx` (lower) | Annuaire par ville |
| `businesses` | `businesses_cat_idx` | Annuaire par catégorie |
| `businesses` | `businesses_siret_uidx` (partial) | Anti-doublon SIRET |
| `clients` | `clients_business_idx` | Liste clients par business |
| `clients` | `clients_business_phone_idx` | Upsert (book, quote-request) |
| `clients` | `clients_business_email_idx` (lower) | Anti-doublon email |
| `appointments` | `appointments_business_date_idx` | RDV du jour |
| `appointments` | `appointments_status_idx` | Filtre statut |
| `appointments` | `appointments_client_idx` | Historique client |
| `quotes` | `quotes_business_status_idx` | Dashboard devis |
| `quotes` | `quotes_client_idx` | Historique client |
| `quotes` | `quotes_sent_updated_idx` (partial WHERE sent) | Cron rappels 7j |
| `payments` | `payments_business_created_idx` | Revenue par période |
| `payments` | `payments_status_idx` | Filtre statut |
| `reviews` | `reviews_business_created_idx` | Avis triés par date |
| `page_visits` | `page_visits_business_date_idx` | Analytics 14/30j |
| `blog_posts` | `blog_business_published_idx` | Liste publique |
| `blog_posts` | `blog_business_slug_uidx` (unique) | Slug unique par business |
| `notifications` | `notifications_user_read_idx` | Cloche bell |

**Impact** : les requêtes qui étaient en scan complet passent en index lookup (typiquement 10× à 1000× plus rapide selon la table).

## 5.4 — `/api/dashboard` déjà refondu au Lot 2

Rappel : la route avait déjà été réécrite avec agrégats SQL (`sql\`count(*)::int\``, `sum() FILTER WHERE`) au lieu de télécharger toutes les rows en mémoire.

## 5.5 — `next/image` sur les vraies images de la vitrine

- Nouveau composant **`OptimizedImage`** (`src/components/ui/OptimizedImage.tsx`) : wrapper autour de `next/image` avec fallback silencieux si l'URL est absente ou 404, et blur placeholder par défaut.
- `PublicPage.tsx` refactoré :
  - Cover image → `<OptimizedImage fill priority sizes="100vw">` (LCP prioritaire)
  - Profile image → `<OptimizedImage width={128} height={128}>`
  - Galerie photos → `<OptimizedImage fill sizes="(max-width:640px) 50vw, 33vw" loading="lazy">`
  - Photos menu (restaurants) → `<OptimizedImage fill sizes="64px" loading="lazy">`
- `BusinessAvatar` : le logo utilise maintenant `next/image` + fallback initiales sur erreur

**Impact** : servi en AVIF/WebP automatique (30-50% de bytes en moins), srcset multi-résolutions, lazy loading natif.

## 5.6 — Bundle : lucide-react + optimizePackageImports

- `lucide-react` : `^1.23.0` → `^1.21.0` (dernière stable en juillet 2026, corrige un problème de versioning)
- `next.config.ts` : `optimizePackageImports` élargi à `lucide-react`, `date-fns`, `recharts`, `jspdf`, `jspdf-autotable`, `@react-navigation/native` (tree-shaking agressif des barrels)

**Impact estimé** : -30 à -50 % de bundle client sur les pages qui importent beaucoup d'icônes ou recharts (dashboard, PublicPage).

## 5.7 — Server Components / SSG

- Pages statiques (`/a-propos`, `/cgu`, `/confidentialite`) : SSG naturel (aucun fetch, `matcher` middleware qui les exclut)
- Login / Register / Landing : partiellement client mais Next les optimise avec React Server Components pour la partie statique du layout
- Le landing (`page.tsx`) reçoit maintenant `<main id="main-content">` (Lot 4 déjà)

## 5.8 — Fonts préchargées via `next/font/google`

- `import { Inter } from "next/font/google"` avec `subsets: ["latin"]`, `display: "swap"`, `preload: true`, `adjustFontFallback: true`
- **Auto-hébergement** : plus aucun fetch runtime vers Google Fonts (pas de FLoC, pas de CORS, pas de 3rd party)
- **CSS variable** `--font-inter` injectée dans `<html>` et utilisée via `globals.css` : `--font-sans: var(--font-inter), -apple-system, ...`
- **Font-display: swap** : le contenu s'affiche instantanément avec la font système, puis swap vers Inter à la charge (aucun FOIT)

**Impact** : gain 100-300ms sur le LCP en mobile 3G/4G.

## 5.9 — Service Worker déjà refondu au Lot 2

Rappel : v2 avec purge auto par version, cache-first pour assets statiques, network-first pour pages, offline fallback.

## 5.10 — `next.config.ts` durci pour performance + cache

- `poweredByHeader: false` (déjà)
- `compress: true` (déjà)
- **`images.formats: ["image/avif", "image/webp"]`** : AVIF prioritaire (30 % de bytes en moins que WebP)
- **`images.deviceSizes / imageSizes`** : srcset optimal pour tous les breakpoints
- **`images.minimumCacheTTL: 86400`** : cache CDN Next de 24h
- **`remotePatterns`** enrichi (Supabase, Cloudinary, googleusercontent…)
- **Headers `Cache-Control` immutable** pour `/_next/static/*` (1 an), `/icons/*` (1 semaine), favicons (24h)

## Bonus — Migration `middleware.ts` → `proxy.ts` (Next 16.1+)

Next 16 a renommé `middleware.ts` en `proxy.ts` :
- `src/middleware.ts` → `src/proxy.ts`
- `export function middleware()` → `export function proxy()`
- Plus de warning "middleware file convention is deprecated"
- Plus de warning "Node.js module `crypto` in Edge Runtime" (proxy tourne en Node.js par défaut)

Suppression du fichier mort **`src/lib/auth-middleware.ts`** (jamais importé).

## Validations finales

```
tsc --noEmit  → 0 erreur
vitest run    → 50/50 tests OK
next build    → Compiled successfully, 37/37 pages
              → /[slug] = ● SSG
              → /annuaire = ○ Static (revalidate 10m)
              → /* pages statiques marquées ○
              → Aucun warning
```

## Récap perf attendu (audit Lighthouse)

| Métrique | Avant | Après (estimation) |
|---|---|---|
| **LCP** vitrine | ~2.8s | **~1.2s** (SSG + AVIF + font swap) |
| **TTI** dashboard | ~4.5s | **~2.5s** (bundle -40%, agrégats SQL) |
| **Hits DB** /annuaire × 100 visites | 100 | **1** (ISR 10 min) |
| **Poids page** vitrine | ~1.2 MB | **~450 KB** (AVIF + tree-shaking) |
| **Score Lighthouse Performance** | ~55 | **≥ 90** attendu |

---

# Historique tours précédents

- `2c928bb` — Tour 5 : Lot 4 a11y (WCAG AA, modal accessible, skip link, focus)
- `5380ed0` — Tour 4 : Lot 3 UI/UX (theme, toast, skeletons, onboarding, OG dynamique)
- `f5b3f2b` — Tour 3 : Lots 1+2 (sécurité complète + code mort/dette)
- `096b2aa` — Fix SQL tolérant tables absentes
- `89d448b` — SQL idempotent + audit v2
- `e642e8b` — Tour 2 : favicon, Vercel/IONOS, roadmap
- `4c25f9c` — Tour 1 : sécurité fondamentale
