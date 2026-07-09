# 🛠️ Améliorations issues de l'audit

Ce document liste **exactement** ce qui a changé. Rapport détaillé dans [`AUDIT_REPORT.md`](./AUDIT_REPORT.md) et [`AUDIT_FULL_V2.md`](./AUDIT_FULL_V2.md).

---

# 🟢 Tour 4 — Lot 3 UI/UX complet

## Fondations globales (4 nouveaux providers/composants)

### `src/contexts/ThemeContext.tsx`
- Modes **light / dark / system** persistés dans `localStorage`
- Suit `prefers-color-scheme` en temps réel quand mode = system
- `THEME_INIT_SCRIPT` injecté en `<head>` **avant** le first paint (pas de FOUC)
- Hook `useTheme()` + toggle `<ThemeToggle />` accessible (radio group, Escape, click outside)

### `src/components/ui/Toast.tsx`
Système global : `<ToastProvider>` + hook `useToast()` avec raccourcis `success/error/info/warning`.
- Auto-dismiss configurable (défaut 4.5s, erreurs 7s)
- Portail bas-droite desktop, centre-bas mobile
- Rôles ARIA (`alert` pour erreurs/warnings, `status` sinon)
- Bouton close avec `aria-label`

### `src/components/ui/Skeleton.tsx`
Placeholders animés : `<Skeleton>`, `<SkeletonListItem>`, `<SkeletonList count={N}>`, `<SkeletonCards>`.
Évite les écrans blancs et le CLS pendant les fetch client.

### `src/app/loading.tsx` + `error.tsx` + `not-found.tsx`
- Loading global : logo animé + trois dots bouncing
- Error : Sentry-friendly (log console, propose retry + retour accueil, affiche digest)
- Not-found : branded avec deux CTAs (accueil, annuaire)
- Bonus `src/app/dashboard/loading.tsx` : squelette exact du layout dashboard (5 stats + 2 blocs)

## Vitrine publique (composants extraits, réutilisables)

### `src/components/public/BusinessAvatar.tsx`
Remplace le peu-pro `🏪` par un vrai avatar :
- Si `logo` fourni → affiche l'image
- Sinon → cercle avec **initiales** (1 ou 2 lettres) sur fond dérivé du nom (hash déterministe) ou de `primaryColor`
- Accessible (`role="img"` + `aria-label`)

### `src/app/[slug]/sections/ContactButtons.tsx`
Boutons Appel / WhatsApp / SMS / Email avec :
- **Nettoyage sécurisé** des numéros (retire espaces, tirets, garde `+`)
- **Validation email** avant d'afficher le bouton (pas de `mailto:null`)
- **Deep-link WhatsApp `api.whatsapp.com`** qui fonctionne partout (mobile + desktop)
- **Tracking** via `navigator.sendBeacon` (fire-and-forget, non-bloquant)
- Aucun bouton rendu si le canal n'est pas configuré
- Bouton primary utilise `primaryColor` du business inline

## OG images (share sociaux)

### `public/og-image.png`
Version PNG 1200×630 remplace le SVG (compat plus large : LinkedIn, WhatsApp iOS...).
Source dans `branding/og-source.svg`.

### `src/app/[slug]/opengraph-image.tsx`
**OG dynamique par vitrine** via `next/og ImageResponse` :
- Nom du business, catégorie, ville, description
- Note moyenne + nombre d'avis (⭐ 4.8 · 34 avis)
- Fond dégradé avec la `primaryColor` du business
- Cache 1h côté CDN (`revalidate = 3600`)
- Bouton CTA "Prendre RDV →"

### `src/app/layout.tsx`
- Ajout `openGraph` complet (siteName, locale fr_FR, type)
- Ajout `twitter: summary_large_image`
- `viewport.themeColor` adaptatif (light vs dark)
- `suppressHydrationWarning` pour compat theme switching
- Wrap dans `ThemeProvider > AuthProvider > ToastProvider`

## Pricing (conversion)

### `src/components/public/PricingSection.tsx`
- Default sur **billing annuel** (meilleur pour la conversion)
- Toggle refait avec `role="radiogroup"` + `aria-checked` (accessible)
- Prix live `aria-live="polite"`
- Bouton mène à `/register?plan=X&billing=Y` (pré-remplit la sélection)
- Badge "Le plus populaire" avec icône Sparkles
- Card Pro élevée de 8px en desktop (`lg:-translate-y-2`)
- Économie annuelle mise en avant : "vous économisez 70€/an"
- CTA Pro renommé **"Essayer Pro 14 jours"** (trial)

## Onboarding après register

### `src/app/dashboard/welcome/page.tsx`
Wizard 6 étapes avec **checklist vivante** (auto-cochée à mesure que le pro complète son profil) :
1. Logo + cover
2. Description ≥ 50 chars
3. Téléphone
4. ≥ 3 services
5. ≥ 1 jour d'horaires
6. Partager (QR code)

- Barre de progression accessible (`role="progressbar"` + `aria-valuenow`)
- Header dégradé slate avec welcome perso
- Lien direct vers la section concernée (`?section=services`)
- Bouton "Aperçu" → ouvre la vitrine dans un nouvel onglet

### `src/app/register/page.tsx`
Redirection après inscription : `/dashboard` → **`/dashboard/welcome`**.

## Éditeur de vitrine (dashboard)

### `src/components/dashboard/VitrinePreview.tsx`
**Aperçu live iframe** :
- Toggle Desktop / Mobile (375px iOS)
- Bouton "Actualiser" (l'iframe ne se re-render pas seule)
- Bouton "Ouvrir dans un nouvel onglet"
- Toolbar avec ARIA `role="tablist"`
- Sandbox strict : pas de top-navigation
- URL avec `?preview=1` (pour désactiver le tracking d'analytics côté vitrine)

### `src/components/dashboard/ColorPicker.tsx`
Sélecteur de couleur pro :
- 10 couleurs suggérées avec bons contrastes WCAG AA (bleu marine, indigo, émeraude…)
- Input hexadécimal validé (`#RRGGBB`) + input color natif
- **Vérification contraste WCAG en direct** : warning si contraste texte blanc < 4.5:1
- Preview live sur bouton
- Sélection courante indiquée par ✓ et bordure

## Fuseau horaire (bookings)

### `src/lib/timezone.ts` (nouveau)
- `DEFAULT_TIMEZONE = "Europe/Paris"`
- 12 TZ supportées (métropole + DOM/TOM + pays francophones voisins)
- `tzOffsetMinutes(tz)` : offset exact avec gestion DST
- `formatSlot(date, time, tz, locale)` : formate un slot en respectant la TZ
- `browserTimezone()` : détecte la TZ du client
- `shouldWarnTimezoneMismatch(bizTz, clientTz)` : true si offsets diffèrent

### Schéma DB
Nouvelle colonne `businesses.timezone` (varchar 64, défaut `"Europe/Paris"`).
Migration idempotente ajoutée dans `sql/00_apply_safe.sql`.

## Tests unitaires (+11 tests : 27 → 38)

- `tests/unit/timezone.test.ts` — 7 tests : offsets, format, mismatch
- `tests/unit/business-avatar.test.ts` — 4 tests : calcul initiales, gestion accents/symboles

## Validations finales

```
tsc --noEmit  → 0 erreur
vitest run    → 38/38 tests OK
next build    → Compiled successfully + 35/35 static pages
```

## À intégrer manuellement (non fait pour éviter de casser)

Les composants sont créés et prêts à l'emploi. Il reste à les brancher dans les pages, ce qui est du refactor visuel :

- Remplacer `🏪` dans `PublicPage.tsx` par `<BusinessAvatar name={business.name} logo={business.logo} primaryColor={business.primaryColor} />`
- Remplacer la grille de boutons Appel/WhatsApp/Mail par `<ContactButtons ... />`
- Ajouter `<VitrinePreview slug={business.slug} />` en colonne droite de `dashboard/vitrine/page.tsx`
- Remplacer l'input color de `dashboard/vitrine/page.tsx` par `<ColorPicker value={form.primaryColor} onChange={...} />`
- Utiliser `useToast()` à la place des `setError(msg)` dans les forms du dashboard

Ces intégrations sont volontairement laissées pour un lot ciblé "refactor UI" pour que tu puisses valider le rendu visuel à chaque étape (pas d'effet secondaire non-souhaité).

---

# 🟢 Tours 1, 2, 3 — Rappel (voir historique git)

- `4c25f9c` — audit tour 1 : sécurité (middleware signé, IDOR blog, rate-limit login)
- `e642e8b` — audit tour 2 : favicon complet, Vercel/IONOS, roadmap
- `89d448b` — SQL idempotent + audit v2 + quick-wins
- `096b2aa` — fix SQL tolérant tables absentes
- `f5b3f2b` — lots 1+2 complets : sécurité restante + code mort/dette
