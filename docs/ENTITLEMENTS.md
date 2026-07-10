# Entitlements — Gestion centralisée des accès par plan

**Introduit dans le Lot 29 (F1)** — remplace le pattern éparpillé `plan === "premium"` par une source de vérité unique.

---

## Pourquoi

Avant F1 : 15+ fichiers avec `plan === "premium"` inline, aucune matrice consultable d'un coup d'œil, **plusieurs routes API critiques ouvertes à tous les plans** (`/api/loyalty`, `/api/ai-chat`) → fuite de valeur.

Après F1 :

- Matrice unique dans `src/lib/entitlements.ts`
- Guard API `requireEntitlement(feature)` avec réponse 402
- Composant UI `<UpgradeGate feature="…">` + hook `useEntitlement("…")`
- Test snapshot qui fige la matrice

---

## Architecture

```
src/lib/permissions.ts          ← matrice technique DÉTAILLÉE (~30 flags par plan) — inchangé
src/lib/entitlements.ts         ← surcouche SÉMANTIQUE (19 features clés)
src/lib/require-entitlement.ts  ← guard API (throw HttpError 401/402)
src/hooks/useEntitlement.ts     ← hook client (cache module-level partagé)
src/components/entitlements/
  ├── UpgradeGate.tsx           ← wrap UI conditionnel (3 modes : card/inline/blur)
  ├── PlanBadge.tsx             ← badge visuel plan
  └── EntitlementsList.tsx      ← liste UI complète des features (settings)
src/app/api/account/entitlements/route.ts  ← GET pour le hook client
```

`entitlements.ts` ne DUPLIQUE PAS `permissions.ts` : il l'AGRÈGE derrière des clés parlantes (`loyalty.enable` plutôt que `canEnableLoyalty`). Les limites numériques (`maxClients`, etc.) restent lues via `getLimit()`.

---

## Ajouter une nouvelle feature

1. Ajouter la clé dans `FeatureKey` (`src/lib/entitlements.ts`)
2. Ajouter l'entrée dans `FEATURES` avec `plans`, `label`, `description`, `minPlan`
3. Mettre à jour le test snapshot (`tests/unit/entitlements.test.ts` → `EXPECTED_ACCESS`)
4. Gater la route API :
   ```ts
   import { requireEntitlement } from "@/lib/require-entitlement";
   await requireEntitlement("ma_feature");
   ```
5. Gater le composant UI :
   ```tsx
   <UpgradeGate feature="ma_feature">
     <MonComposant />
   </UpgradeGate>
   ```

---

## Contrat de réponse 402 (PLAN_REQUIRED)

```json
{
  "error": "Cette fonctionnalité nécessite le plan Premium.",
  "code": "PLAN_REQUIRED",
  "requiredPlan": "premium",
  "currentPlan": "pro",
  "feature": "ai.chat"
}
```

Un client (mobile Expo, API v1 consommateur, UI) peut brancher sur `code === "PLAN_REQUIRED"` pour :

- Rediriger vers `/pricing?from={feature}` (tracking upsell)
- Afficher un toast avec CTA upgrade
- Masquer le bouton qui a déclenché la requête

---

## Feature list (au commit du Lot 29)

| Feature                   | Free | Pro | Premium |
| ------------------------- | ---- | --- | ------- |
| `ai.chat`                 | ❌   | ❌  | ✅      |
| `ai.blog`                 | ❌   | ✅  | ✅      |
| `ai.social_post`          | ❌   | ❌  | ✅      |
| `ai.monthly_report`       | ❌   | ❌  | ✅      |
| `ai.auto_review_reply`    | ❌   | ❌  | ✅      |
| `vitrine.custom_template` | ❌   | ✅  | ✅      |
| `vitrine.hide_branding`   | ❌   | ❌  | ✅      |
| `vitrine.custom_domain`   | ❌   | ❌  | ✅      |
| `loyalty.enable`          | ❌   | ❌  | ✅      |
| `payments.stripe`         | ❌   | ✅  | ✅      |
| `payments.apple_pay`      | ❌   | ✅  | ✅      |
| `quotes.enable`           | ❌   | ✅  | ✅      |
| `reminders.email`         | ❌   | ✅  | ✅      |
| `reminders.sms`           | ❌   | ❌  | ✅      |
| `reminders.whatsapp`      | ❌   | ❌  | ✅      |
| `reviews.auto_request`    | ❌   | ✅  | ✅      |
| `team.enable`             | ❌   | ✅  | ✅      |
| `analytics.advanced`      | ❌   | ✅  | ✅      |
| `pdf.multi_template`      | ❌   | ✅  | ✅      |

---

## Migration progressive de l'existant

L'ancien `requirePermission(canXxx)` dans `src/lib/validation.ts` reste fonctionnel — pas de breaking change. Migration à faire progressivement :

- ✅ `/api/loyalty` migré (Lot 29)
- ✅ `/api/ai-chat` migré (Lot 29) — gate sur plan du business owner (route publique)
- ⏳ `/api/ai/*` : utilise encore `requirePermission` → OK pour l'instant, migrer si refactor
- ⏳ `/api/blog` : utilise `PLAN_PERMISSIONS[plan].maxBlogPosts` (quota) → passer à `checkQuota()`
- ⏳ `/api/team` : idem → `checkQuota("maxTeamMembers")`
- ⏳ Pages dashboard : ajouter `<UpgradeGate>` progressivement sur `blog`, `loyalty`, `vitrine` (sections premium)

---

## Modes du composant `<UpgradeGate>`

- **card** (défaut) : encadré grand format avec CTA — pour bloquer une page entière ou une section
- **inline** : petit badge cliquable — pour un bouton/menu item avec teasing
- **blur** : affiche les enfants floutés en dessous d'un overlay CTA — puissant visuellement pour un dashboard bloqué

---

## Tests

- `tests/unit/entitlements.test.ts` — 39 tests (snapshot matrice + helpers)
- `tests/unit/require-entitlement.test.ts` — 9 tests (guard API)

Snapshot test = **si tu changes un plan par erreur, la CI casse**. Update conscient obligatoire.
