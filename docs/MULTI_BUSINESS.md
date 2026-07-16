# Multi-vitrines (F11 — Lot 46)

Permet à un compte user unique de gérer **N vitrines** (businesses) en parallèle.

## Cas d'usage

- **Franchisés** : 3 salons de coiffure dans 3 villes → 3 vitrines, 1 seul compte, 1 seul abonnement
- **Artisans multi-métiers** : `dupont-plomberie` + `dupont-chauffage` (2 SEO, 2 identités)
- **Réseau multi-sites** : plusieurs points de vente unifiés côté gestion

## Quotas

| Plan    | maxBusinesses |
| ------- | ------------- |
| Free    | 1             |
| Pro     | 1             |
| Premium | 3             |

**Pro = Free côté quota** : c'est volontaire. Le passage Pro → Premium est justifié
par le multi-vitrines pour ce cas d'usage. Sinon Premium serait juste "Pro avec IA".

## Gate entitlement

Nouvelle feature key `business.multi` — plans `[premium]` uniquement.

Route `POST /api/my-businesses` :
- 1ère vitrine : TOUJOURS autorisée (onboarding, tous plans)
- 2e+ : `canUse(plan, "business.multi")` requis → sinon 402 avec `{feature, requiredPlan, currentPlan}`
- Puis `checkQuota(plan, "maxBusinesses", currentCount)` → sinon 403 avec limit/current

## DB

**Nouvelle colonne** `users.active_business_id uuid` (nullable) — bloc SQL `4octodecies`.

- Mémorise la dernière vitrine sélectionnée par le user
- Nullable = fallback sur le 1er business trouvé (rétrocompatibilité totale, aucune migration data requise)
- Trigger `__vx_cleanup_active_business` : `BEFORE DELETE ON businesses` → nettoie
  automatiquement les IDs orphelins pour éviter les fantômes

## Session

`getCurrentBusiness()` a été enrichi :

```
1. Si user.activeBusinessId ET business appartient à l'user → return it
2. Sinon fallback : premier business trouvé (comportement legacy)
```

Aucun changement pour les user historiques (activeBusinessId null → fallback).
Toutes les routes API existantes qui utilisent `getCurrentBusiness()` bénéficient
automatiquement du multi-vitrines **sans modification**.

## API

### `POST /api/my-businesses/switch`

Change la vitrine active persistée sur `users.active_business_id`.

```json
POST /api/my-businesses/switch
{ "businessId": "uuid" }

→ 200 { ok: true, businessId, name }
→ 404 vitrine introuvable ou pas owner (anti-IDOR)
→ 429 rate-limit (10/min)
```

**Sécurité** : vérifie que le business appartient à l'user courant. Rate-limit 10/min
suffit largement pour un usage humain.

**Pas de gate multi-vitrines** ici : un user Free avec 1 seule vitrine peut aussi
appeler cette route (idempotent). La gate ne s'applique qu'à la CRÉATION.

### `POST /api/my-businesses` (enrichie)

Idem qu'avant + nouveau bloc gate/quota au début.

## UI

### `<BusinessSwitcher />` (nouveau composant Sidebar)

Placé en haut de la sidebar dashboard, avant la recherche globale.

3 modes de rendu automatiques :
- **0 vitrine** : composant ne rend rien (welcome onboarding gère)
- **1 vitrine** : read-only, juste affichage nom + emoji catégorie
- **2+ vitrines** : dropdown cliquable avec liste + link "Gérer mes vitrines"

Le switch appelle `POST /api/my-businesses/switch` puis `router.refresh()` pour
rerender les server components qui dépendent de `getCurrentBusiness()`.

Dropdown accessible (aria-expanded, aria-haspopup, Escape ferme, clic hors ferme).

### `/dashboard/my-businesses` (enrichi)

- Bouton adaptatif "Nouvelle vitrine" / "Passer Premium" selon plan + count
- Bandeau info pédagogique pour Free/Pro bloqués au quota (renvoie vers `/#pricing`)
- Card "Ajouter" en fin de grille cachée si plan bloque
- Toast d'erreur clair sur 402 / 403 avec message contextualisé
- Toast de succès sur création OK

## Facturation

**1 seul abonnement Stripe** couvre les 3 vitrines Premium. C'est l'argument
commercial fort : payer 1× Premium au lieu de 3× Pro (économie ~87€/mois vs
3 comptes Pro séparés).

Pas de logique nouvelle côté Stripe — la subscription est liée au user, pas au business.

## Mentions dans les tarifs

- **PricingSection** section Premium : "Jusqu'à 3 vitrines simultanées (multi-marques, franchises)"
- **PricingSection** section Pro : "1 vitrine avec design & couleurs personnalisés" (contraste explicite)
- **Landing feature card** "Page publique premium" : mention discrète "jusqu'à 3 vitrines par compte en Premium"

## Actions post-déploiement

1. **DB migration** : `bash sql/apply.sh` — bloc `4octodecies` idempotent
2. **Vérifier trigger** en Supabase après migration :
   ```sql
   SELECT tgname FROM pg_trigger WHERE tgname = 'trg_cleanup_active_business';
   ```
3. **Test end-to-end** :
   - Compte Free : créer 1ère vitrine OK → tenter 2e → CTA upgrade visible
   - Compte Premium : créer 3 vitrines → switcher dans sidebar → vérifier que
     `/dashboard/quotes` (ou n'importe quelle page) affiche les données de la vitrine active
   - Compte Premium avec 3 vitrines → tenter 4e → toast erreur quota

## Out of scope (lots futurs possibles)

- Team members partagés entre vitrines
- Vue analytics consolidée multi-vitrines
- Migration data entre vitrines
- Facturation par vitrine (aujourd'hui : 1 sub couvre tout)
