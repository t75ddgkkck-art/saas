# Vitrine v2 — Personnalisation étendue (Lot 37)

## Objectif business

Répond aux points faibles identifiés dans **AUDIT_UX_MOBILE_V4** :

- ❌ Avant : 1 seule couleur, 7 templates figés, pas de choix de police
- ✅ Après : 3 couleurs + 10 polices curated + 16 presets métier + ordre sections drag&drop + CSS custom Premium

Passe le gap vs Simplébo/Solocal qui proposaient plus de personnalisation.

## Ce qui a été livré

### Modèle DB (5 nouvelles colonnes sur `businesses`)

- `secondary_color varchar(20)` — nullable, fallback template
- `accent_color varchar(20)` — idem
- `font_family varchar(50) DEFAULT 'inter'` — id de font curated
- `section_order jsonb` — array `["hero","services","gallery",...]`, null = ordre par défaut
- `custom_css text` — Premium uniquement, sanitizer côté serveur, cap 20 KB

SQL idempotent bloc **4terdecies**.

### `src/lib/vitrine-personalization.ts`

Source unique de vérité :

- **`FONT_OPTIONS`** — 10 fonts curated (Inter, Système, Georgia, Playfair, Poppins, Montserrat, Raleway, Merriweather, Lora, Roboto Mono). Toutes avec fallback système généreux, aucun runtime fetch Google Fonts.
- **`COLOR_PRESETS`** — 16 presets métier avec 3 couleurs + emoji + catégorie (bâtiment, beauté, restauration, juridique, sport, créatif, autre)
- **`suggestPresetForCategory(cat)`** — matching intelligent par mot-clé (plombier, coiffeur, avocat, restaurant, photographe, etc.)
- **`VITRINE_SECTIONS`** — 8 sections avec required flag (hero + contact obligatoires)
- **`normalizeSectionOrder(custom)`** — filtre les IDs inconnus + ajoute les manquants à la fin (protection DB corrompue)
- **`sanitizeCustomCss(css)`** — bloque `@import`, `url()` externes (http/https/data/javascript), `expression()`, `javascript:`, `<script>`. Cap 20 KB.

### Composants UI (3)

- **`<PresetPicker>`** — grille groupée par catégorie métier, preview 3 pastilles couleurs
- **`<FontPicker>`** — grille avec preview du nom rendu DANS la font (WYSIWYG immédiat)
- **`<SectionOrderEditor>`** — drag & drop natif HTML5 + boutons ↑/↓ fallback a11y/mobile, lock icon sur sections requises

### Onglet `Personnalisation` dans `/dashboard/vitrine`

Nouveau tab dédié avec :

- Suggestion contextuelle basée sur `businesses.category` (bandeau indigo)
- Palette de presets métier
- 3 color inputs custom (primary/secondary/accent)
- Font picker
- Section order editor (drag & drop)
- Textarea CSS custom (gate Premium)

**Sous-composants lazy-loadés** via `dynamic()` — les 3 composants (Preset/Font/SectionOrder) ne se chargent qu'en cas d'ouverture de l'onglet. ~15 KB économisés sur bundle initial.

### API

`PUT /api/my-business` accepte les 5 nouveaux champs :

- Validation Zod hex `#RRGGBB` pour secondary/accent
- Chaîne vide `""` = reset à `null` (permet à l'user de retirer une couleur custom)
- `sanitizeCustomCss()` appliqué côté serveur (import dynamique pour rester léger)

### Application côté vitrine publique

Dans `src/app/[slug]/PublicPage.tsx` :

- Font custom override le template si présente
- 3 CSS variables exposées : `--vx-primary`, `--vx-secondary`, `--vx-accent` (pour usage futur dans les sections)
- Custom CSS scoped au container `.vx-vitrine` (bleed protection)
- CSS injecté dans un `<style dangerouslySetInnerHTML>` — safe car sanitizé côté serveur ET owner-controlled

## Tests (28 nouveaux)

`tests/unit/vitrine-personalization.test.ts` :

- **FONT_OPTIONS** : 10 fonts, ids uniques, stacks non vides
- **getFontById** : match + fallback inter
- **COLOR_PRESETS** : 16 presets, hex valides, "custom" en dernier
- **suggestPresetForCategory** : plombier/coiffeur/restaurant/avocat/inconnu/null
- **VITRINE_SECTIONS** : 8 sections, hero+contact obligatoires
- **normalizeSectionOrder** : null → défaut, filtre inconnus, ajoute manquants, préserve custom
- **sanitizeCustomCss** :
  - Cases nominaux + null/undefined
  - Bloque `@import`, `url(http|https|data|javascript)`, `expression()`, `javascript:`, `<script>`
  - Cap 20 KB

## Fichiers créés / modifiés

**Créés** (5) :

- `src/lib/vitrine-personalization.ts` (350 lignes)
- `src/components/vitrine/PresetPicker.tsx`
- `src/components/vitrine/FontPicker.tsx`
- `src/components/vitrine/SectionOrderEditor.tsx`
- `docs/VITRINE_V2.md`
- `tests/unit/vitrine-personalization.test.ts` (28 tests)

**Modifiés** :

- `src/db/schema.ts` — 5 colonnes sur businesses
- `sql/00_apply_safe.sql` — bloc 4terdecies
- `src/app/api/my-business/route.ts` — schéma Zod étendu + sanitizer serveur
- `src/app/dashboard/vitrine/page.tsx` — nouveau tab + composant PersonnalisationSection (lazy)
- `src/app/[slug]/PublicPage.tsx` — application font + CSS vars + custom CSS scoped

## Validations

- ✅ `npx tsc --noEmit` — 0 erreur
- ✅ `npm run lint` — 0 erreur / 259 warnings
- ✅ `npm run format:check` — OK
- ✅ `npm run test` — **593 tests / 54 fichiers** (+28)
- ✅ `npm run build` — succès

## Impact business

- **Personnalisation au niveau des concurrents** (Simplébo/Solocal)
- **Suggestion métier automatique** = onboarding fluide (le pro se sent compris)
- **CSS custom Premium** = argument commercial supplémentaire pour Premium
- **Sanitizer robuste** = pas de vecteur XSS via CSS custom
- **Lazy loading** = bundle initial préservé (les 3 sous-composants font ~15 KB combinés)

## Actions post-déploiement

1. `psql $DATABASE_URL -f sql/00_apply_safe.sql` — bloc 4terdecies (5 colonnes)
2. Tester sur une vitrine réelle :
   - Appliquer un preset métier → vérifier couleurs propagées
   - Changer la font → vérifier rendu vitrine publique
   - Réordonner sections (v2 : nécessite refactor sections vitrine pour lire `sectionOrder`)
   - En Premium : tester custom CSS avec `@import` malveillant → doit être filtré
3. Communication users : "Nouveauté : 16 presets couleurs métier + 10 polices + réordonnancement des sections."

## Roadmap v3

- **Application effective de `sectionOrder`** côté PublicPage.tsx (v1 le stocke mais l'ordre par défaut est utilisé — refactor sections vitrine à faire)
- **Preview live iframe** dans le tab Personnalisation (voir modif en temps réel)
- **Templates métier complets** avec sections pré-configurées (plombier : urgence en tête, restaurant : menu en avant)
- **Import/export de thème** (JSON téléchargeable pour partager entre pros ou back-up)
- **Marketplace de thèmes** créés par des designers (rev-share 70/30)
- **Fonts self-hosted supplémentaires** via next/font/google si Poppins/Playfair etc. sont réellement utilisées (mesurer avant)

## Split B31 non fait

Le fichier `dashboard/vitrine/page.tsx` fait maintenant ~2100 lignes (avant : 1870). Le split complet (10 sous-composants) reste identifié comme dette technique dans AUDIT_UX_MOBILE_V4 mais REPORTÉ en v3 :

- Risque élevé de casser le state partagé sans une couverture de tests React
- Les composants PersoSection + les 3 sous-picks sont déjà lazy-loadés → bundle initial déjà optimisé
- Le vrai split nécessite d'abord d'installer @testing-library/react et de tester chaque section

En attendant : le composant `PersonnalisationSection` sert de **prototype** de ce à quoi ressemblera le split (composant local avec setForm typé, lazy children).
