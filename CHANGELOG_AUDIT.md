# 🛠️ Améliorations issues de l'audit

Ce document liste **exactement** ce qui a changé. Rapport détaillé dans [`AUDIT_REPORT.md`](./AUDIT_REPORT.md) et [`AUDIT_FULL_V2.md`](./AUDIT_FULL_V2.md).

---

# 🟢 Tour 7 — Lot 6 SEO

## 6.1 + 6.2 — Sitemap-index paginé

Avant : 1 seul `sitemap.xml` monolithique listant uniquement les vitrines.
Après : **sitemap-index** pointant vers 5+ sous-sitemaps par type, paginés :

| URL | Contenu | Pagination |
|---|---|---|
| `/sitemap.xml` | **Index** listant tous les sous-sitemaps | ISR 1h |
| `/sitemap-static.xml` | Pages fixes (`/`, `/register`, `/annuaire`, `/blog`, `/a-propos`, `/faq`, `/cgu`, `/confidentialite`) | ISR 1j |
| `/sitemap-businesses/[page]` | Vitrines, 5000 par page | ISR 1h |
| `/sitemap-blog/[page]` | Articles publiés uniquement, 5000 par page | ISR 1h |
| `/sitemap-cities.xml` | Villes distinctes avec au moins 1 pro (priorité log-scale par nb pros) | ISR 1j |
| `/sitemap-categories.xml` | Catégories métier distinctes | ISR 1j |

Bonus : `<xhtml:link rel="alternate" hreflang="...">` dans le sitemap des businesses.

**Impact** : Google contourne la limite 50 000 URL, ne recrawle que les sitemaps modifiés (`lastmod` par entrée), meilleure isolation.

## 6.3 — Meta descriptions optimisées + helper `src/lib/seo.ts`

Nouveau module `src/lib/seo.ts` :
- `clampText(input, max)` : troncature intelligente sur frontière de mot + ellipsis
- `clampTitle` (60 chars), `clampDescription` (155 chars) : limites Google respectées
- `CATEGORY_LABELS` : labels lisibles (`plombier → "Plombier"`)
- `CATEGORY_HOOKS` : accroches accrocheuses par métier (fallback si le pro n'a rien mis)
- `buildBusinessTitle` : `"Nom — Catégorie à Ville"`
- `buildBusinessDescription` : utilise la description du pro si assez riche, sinon compose une phrase avec l'accroche métier + note ⭐ si disponible

`generateMetadata` de `/[slug]` refondu :
- Titre clampé à 60 chars
- Description clampée à 155 chars avec note incluse (`⭐ 4.7/5 (23 avis)`) — améliore le CTR SERP
- `keywords` dynamiques (catégorie + ville + combinaisons)
- `openGraph.locale` adaptatif (fr/en/es/de selon `business.language`)
- `robots.googleBot: max-image-preview: large, max-snippet: -1`

## 6.4 — hreflang

- Layout global (`src/app/layout.tsx`) : `alternates.languages: { "x-default": "/", "fr": "/" }`
- Chaque vitrine (`/[slug]/page.tsx`) : `alternates.languages` construit dynamiquement selon `business.language` (fr par défaut + langue du pro si en/es/de)

## 6.5 — Slugs SEO-friendly

Avant : `plomberie-dupont-x9k2` — suffixe hasardeux systématique à l'inscription.
Après : `plomberie-dupont` (le suffixe hasardeux devient un fallback ultra-rare).

Nouveau `generateUniqueSlug(base, isTaken)` dans `src/lib/utils.ts` :
1. Slug propre en priorité
2. Fallback numérique `-2`, `-3`, … `-20` en cas de collision
3. Fallback aléatoire `-x9k2` seulement si tout est pris (extrêmement rare)

Utilisé dans `/api/auth/register` avec check dans la transaction DB.

## 6.6 — Rich snippets enrichis (Schema.org)

`StructuredData.tsx` refondu, produit maintenant **2 JSON-LD** :

**LocalBusiness** :
- `@type` mappé selon catégorie (`plombier → "Plumber"`, `coiffeur → "HairSalon"`, `restaurant → "Restaurant"`…)
- `@id` unique pour le Knowledge Graph
- `image` (array : cover + profile + logo)
- `priceRange` (défaut `€€`)
- **`PostalAddress`** avec addressCountry FR
- **`GeoCoordinates`** si lat/lng
- **`OpeningHoursSpecification`** (générée à partir des `workingHours`)
- **`AggregateRating`** avec ratingValue + reviewCount
- **`Review`** (top 5 avec `datePublished`)
- **`sameAs`** (liens réseaux sociaux → Knowledge Graph)

**BreadcrumbList** :
- Accueil > Ville > Business (chapelet dans les SERP Google)

Impact : les vitrines peuvent apparaître dans les SERP avec ⭐ étoiles, horaires, "ouvert maintenant", chapelet — **gros bump du CTR**.

## 6.7 — robots.txt

Refonte :
- `/register` désormais **autorisé** (c'est une landing conversion, bloquer = perte SEO)
- `/login` bloqué (peu d'intérêt)
- `/dashboard/`, `/api/` bloqués (privés)
- `/?preview=1` bloqué (mode preview iframe)
- `/?checkout=*` bloqué (retours Stripe)
- `Allow: /api/health` explicite (utile pour monitoring Google)
- `Crawl-delay: 1`
- Sitemap-index pointé

## 6.8 — OG image dynamique par vitrine

Déjà livré au Lot 3 dans `src/app/[slug]/opengraph-image.tsx`.
`generateMetadata` référence maintenant explicitement `${canonical}/opengraph-image` dans `openGraph.images` + `twitter.images`.

## Bonus qualité

- Suppression du warning Next `Cache-Control` override sur `/_next/static/*` (Next 16 le gère nativement)
- Toutes les nouvelles routes sitemap sont en `dynamic = "force-static"` avec ISR — 0 hit DB à chaque crawl

## Tests unitaires (+13 : 50 → 63)

- `tests/unit/seo.test.ts` — 13 tests :
  - `clampText` (frontière mot, ellipsis, espaces multiples)
  - `clampTitle` ≤ 60 chars
  - `clampDescription` ≤ 155 chars
  - `buildBusinessTitle` (format, gestion ville nulle)
  - `buildBusinessDescription` (pro riche vs fallback, ajout note)
  - `generateUniqueSlug` (libre, collisions -2/-3, calls count)
  - `slugify` (accents, spéciaux)

## Validations finales

```
tsc --noEmit  → 0 erreur
vitest run    → 63/63 tests OK
next build    → Compiled successfully, 39/39 pages
              → /sitemap.xml, /sitemap-static.xml, /sitemap-cities.xml,
                /sitemap-categories.xml, /sitemap-businesses/[page],
                /sitemap-blog/[page] tous ● ○ (statiques + ISR)
              → Zéro warning
```

## Impact SEO attendu

| Item | Avant | Après |
|---|---|---|
| URL indexables | ~50 (vitrines seules) | **Toutes** (statiques + vitrines + articles + villes + catégories) |
| Rich snippet étoiles SERP | ❌ | ✅ (AggregateRating) |
| Chapelet Accueil > Ville > Business | ❌ | ✅ (BreadcrumbList) |
| Horaires "ouvert maintenant" | ❌ | ✅ (OpeningHoursSpecification) |
| CTR SERP (avec ⭐ dans desc) | baseline | +10-30 % attendu |
| Sitemap crawlable > 10k pros | Non | Oui (paginé 5000) |

---

# Historique tours précédents

- `7beadb6` — Tour 6 : Lot 5 perf (ISR, index DB, next/image, next/font, proxy.ts)
- `2c928bb` — Tour 5 : Lot 4 a11y (WCAG AA)
- `5380ed0` — Tour 4 : Lot 3 UI/UX
- `f5b3f2b` — Tour 3 : Lots 1+2 (sécurité + code mort)
- `096b2aa` — Fix SQL tolérant tables absentes
- `89d448b` — SQL idempotent + audit v2
- `e642e8b` — Tour 2 : favicon, Vercel/IONOS
- `4c25f9c` — Tour 1 : sécurité fondamentale
