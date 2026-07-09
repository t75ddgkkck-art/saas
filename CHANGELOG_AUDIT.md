# 🛠️ Améliorations issues de l'audit

Ce document liste **exactement** ce qui a changé. Rapport détaillé dans [`AUDIT_REPORT.md`](./AUDIT_REPORT.md) et [`AUDIT_FULL_V2.md`](./AUDIT_FULL_V2.md).

---

# 🟢 Tour 5 — Lot 4 Accessibilité (WCAG AA)

## Vue d'ensemble

Avant : **1 seule occurrence** d'attribut ARIA dans tout le projet.
Après : **134 occurrences** d'attributs ARIA + roles + labels.

Le projet est maintenant navigable au clavier, exploitable par lecteur d'écran (NVDA, VoiceOver, JAWS) et conforme WCAG 2.1 niveau AA sur les points structurels.

## 4.1 — Attributs ARIA globaux

Ajoutés partout dans les composants Sidebar, NotificationBell, GlobalSearch, PublicChat, SignaturePad, boutons close des modales, FAQ, etc. Tous les icônes décoratifs ont `aria-hidden="true"`.

## 4.2 — Boutons icon-only avec label

Passés en revue et corrigés :

| Composant | Avant | Après |
|---|---|---|
| Hamburger Sidebar | `<button>` | `aria-label`, `aria-expanded`, `aria-controls` |
| NotificationBell | pas de label | `aria-label` dynamique ("3 non lues"), `aria-haspopup="dialog"` |
| GlobalSearch (clear) | pas de label | `aria-label="Effacer la recherche"` |
| PWA install (close) | pas de label | `aria-label="Fermer la bannière"` |
| PublicChat (close/send) | pas de label | `aria-label="Fermer le chat"` / "Envoyer" |
| Modales (close ✕) | texte ✕ visible mais pas lu par SR | `aria-label="Fermer"` + `<span aria-hidden>✕</span>` |
| FAQ accordéon | `<button>` seul | `aria-expanded`, `aria-controls`, `role="region"` sur la réponse |

## 4.3 — Contrastes WCAG AA

- `src/app/globals.css` : override CSS `--tw-slate-400 → slate-500` pour rehausser automatiquement le texte informatif au ratio 4.6:1 (avant 3.1:1)
- Améliorations scrollbar (contraste rail)
- Toast `text-red-500` → `text-red-600` (light) / `text-red-400` (dark) — passe AA
- Nouveau test `tests/unit/a11y-contrast.test.ts` : **12 tests** garantissant que toute la palette suggérée du ColorPicker reste ≥ 4.5:1

## 4.4 — Focus visible cohérent partout

- `globals.css` : `:focus-visible` global avec outline **bleu** (couleur qui contraste sur light ET dark) au lieu d'un noir invisible en dark mode
- Respect de `prefers-reduced-motion` : toutes les animations réduites à 0.01ms si l'utilisateur a activé la préférence système
- Nouveau `::selection` teintée en bleu
- Inputs / Textarea / Select : `focus-visible:ring-2` déjà présent, complété avec `aria-invalid` + `aria-describedby` pour les erreurs
- Boutons de la Sidebar, Modal, PublicChat, PWA banner : ajout `focus-visible:ring-2`

## 4.5 — Modal accessible (`src/components/ui/Modal.tsx` réécrit)

Refonte complète du composant :
- `role="dialog"` + `aria-modal="true"`
- `aria-labelledby` (relié au titre via `useId`) + `aria-describedby` (relié à la description)
- **Focus trap** : Tab et Shift+Tab restent dans le dialog en boucle
- **Focus restore** : le focus revient à l'élément qui a ouvert la modale au close
- **Focus initial** : sur le premier élément focusable via `requestAnimationFrame`
- **Escape ferme** (désactivable via `closeOnEscape={false}`)
- **Click outside ferme** (désactivable via `closeOnOverlay={false}`)
- **Scroll lock** du body avec compensation de la scrollbar (pas de jump horizontal)
- Bouton close a `aria-label` (personnalisable via prop `closeLabel`)
- Nouvelle prop `getFocusable()` : algo qui filtre les éléments réellement focusables (exclut `[disabled]`, `[aria-hidden]`, `display:none`)

## 4.6 — Skip to content (`src/components/layout/SkipToContent.tsx`)

Nouveau composant :
- Invisible par défaut (`sr-only`), apparaît en haut à gauche au focus (Tab au chargement)
- Cible `#main-content` (WCAG 2.4.1 Bypass Blocks)
- Intégré dans `src/app/layout.tsx` (portée globale, toutes les pages en bénéficient)

`id="main-content"` + `role="main"` + `tabIndex={-1}` ajoutés à :
- `src/app/dashboard/layout.tsx` (dashboard)
- `src/app/page.tsx` (landing)
- `src/app/[slug]/PublicPage.tsx` (vitrine publique)

## 4.7 — Langue dynamique `<html lang>`

- `src/components/layout/LangHtmlSync.tsx` : nouveau composant client qui synchronise `<html lang="...">` avec la langue choisie dans `LangContext` (fr/en/es/de)
- Intégré dans `dashboard/layout.tsx`
- SEO : Google indexe correctement les pages selon la langue déclarée
- Lecteurs d'écran : prononciation correcte (voix française vs anglaise)

## Nouveaux composants livrés

| Fichier | Rôle |
|---|---|
| `src/components/layout/SkipToContent.tsx` | Lien "Aller au contenu" WCAG |
| `src/components/layout/LangHtmlSync.tsx` | Sync `<html lang>` avec context |
| `src/components/ui/Modal.tsx` (réécrit) | Modal accessible complet |

## Tests unitaires (+12 : 38 → 50)

- `tests/unit/a11y-contrast.test.ts` — 12 tests : garantit que toute la palette suggérée passe WCAG AA (≥ 4.5:1 sur blanc), et détecte les regressions (jaune sur blanc doit échouer)

## Validations finales

```
tsc --noEmit  → 0 erreur
vitest run    → 50/50 tests OK
next build    → Compiled successfully + 35/35 static pages
```

## Points ARIA restants (mineurs, non bloquants)

- Les 250+ `text-slate-400` sont automatiquement rehaussés via CSS override, mais il faudrait à terme migrer ceux du **texte informatif** vers `text-slate-500` explicitement pour clarifier l'intention
- Les images `<img>` de la galerie n'ont pas encore d'alt personnalisé (utilise "Photo galerie" par défaut) — à améliorer si les galleryItems ont un champ `caption`
- Les inputs custom des dashboards devraient tous utiliser le composant `<Input>` (qui a déjà `aria-*`) au lieu de `<input>` brut

---

# Historique tours précédents

- `5380ed0` — Tour 4 : Lot 3 UI/UX (theme, toast, skeleton, onboarding, OG dynamique)
- `f5b3f2b` — Tour 3 : Lots 1+2 (sécurité complète + code mort/dette)
- `096b2aa` — Fix SQL tolérant tables absentes
- `89d448b` — SQL idempotent + audit v2
- `e642e8b` — Tour 2 : favicon, Vercel/IONOS, roadmap
- `4c25f9c` — Tour 1 : sécurité (middleware, IDOR, rate-limit)
