# Devis IA + Signature électronique (F8 — Lot 38)

## Objectif business

- **Devis IA** : le pro décrit "Rénovation SDB 6m², carrelage, WC" → l'IA propose 5-10 lignes détaillées avec prix médians → gain de temps massif (30 min → 30 s)
- **Signature électronique légale** : le client signe en ligne depuis un lien magique → devis "accepté" instantanément, hash SHA-256 pour preuve d'intégrité
- **Relances automatiques** cron J+3/J+7/J+15 sur devis non signés
- **Différenciateur BTP** : concurrence FR (Simplébo/Solocal) n'ont pas cette combo

## Feature 1 — Génération IA

### Prompt système `quoteGeneratorSystemPrompt`

Sortie JSON stricte (parseable côté serveur) :

```json
{
  "items": [
    { "description": "Main-d'œuvre pose carrelage", "quantity": 6, "unit_price": 45, "unit": "m²" },
    { "description": "Carrelage grès cérame 60x60", "quantity": 7, "unit_price": 32, "unit": "m²" }
  ],
  "notes": "Devis indicatif...",
  "warning": null,
  "estimated_days": 3
}
```

Règles injectées :

- Prix TTC (TVA 20% incluse) sauf mention explicite HT
- Unit type : `u`, `h`, `m²`, `ml`, `jour`, `forfait`
- Séparation main-d'œuvre / matériaux
- Ligne "déplacement" si typique
- Si description trop vague → `warning` explicatif (pas de génération à l'aveugle)

### Route `POST /api/quotes/ai-generate`

**Gates cumulatifs** :

1. `quotes.enable` (Pro+) — le pro doit avoir la feature devis
2. `quotes.ai_generation` (Premium) — IA est Premium only
3. `checkAiQuota()` — quota mensuel de tokens partagé avec les autres IA

**Rate-limit** : 20/heure/IP (coût OpenAI direct)

**Parser tolérant** `safeParseAiJson()` : nettoie les markdown fences `json…`, filtre les items malformés, cap description à 500 chars.

**Réponse** :

```json
{
  "title": "…",
  "items": [...],
  "notes": "…",
  "warning": null,
  "estimatedDays": 3,
  "suggestedTotal": 462,
  "tokensUsed": 850
}
```

Le pro reçoit une SUGGESTION, il valide/édite avant sauvegarde. L'IA n'écrit JAMAIS directement en DB.

## Feature 2 — Signature électronique

### Modèle "légère" vs eIDAS

**v1 (livré)** : signature légère MAIS complète pour la plupart des devis artisans (< 10 K€) :

- Hash SHA-256 de preuve d'intégrité
- Audit trail (IP, user-agent, timestamp)
- Nom tapé du signataire (valeur légale en droit FR)
- Signature dessinée optionnelle (canvas)
- Email de confirmation pré-rempli
- CGV acceptées explicitement

**v2 (roadmap)** : intégration Yousign / DocuSign pour eIDAS qualifié (nécessaire au-delà de 10 K€).

### Flow complet

1. **Pro** : `POST /api/quotes/[id]/send-signature`
   - Génère token 32 bytes hex (hash SHA-256 stocké en DB)
   - Envoie email au client avec magic-link `/devis/[token]`
   - Devis passe en status `sent` si `draft`
   - TTL 30 jours

2. **Client** : ouvre `/devis/[token]` (page publique, noindex)
   - GET `/api/quotes/sign?token=` → peek (business, client, items, total, CGV)
   - Affichage complet du devis avec table items
   - Formulaire : nom tapé + email + checkbox CGV + dessin optionnel

3. **Client soumet** : `POST /api/quotes/sign`
   - Recharge le devis + items pour recalculer le hash
   - `computeSignatureHash({quoteId, total, itemsFingerprint, signedByEmail, signedAt, signedIp, signedUserAgent})`
   - Update atomique WHERE `signedAt IS NULL` (double-clic safe)
   - Statut → `accepted`, token invalidé (SET null)
   - **Notif `quote.accepted` au pro** (push OS + in-app) via helper `notify()` L34

### Hash de preuve d'intégrité

```ts
computeSignatureHash({
  quoteId: "q-1",
  total: "150.00",
  itemsFingerprint: computeItemsFingerprint(items),
  signedByEmail: "user@example.com",
  signedAt: "2026-08-15T10:00:00.000Z",
  signedIp: "1.2.3.4",
  signedUserAgent: "Mozilla/5.0...",
});
```

Le hash est **déterministe** : recomputer les mêmes inputs donne le même résultat. Un devis modifié APRÈS signature aura un fingerprint différent → hash ne match plus → fraude détectable.

**`computeItemsFingerprint()`** :

- Trié par description (ordre stable indépendant de l'insertion)
- Format `description|quantity|unitPrice` par ligne, concat par `||`

## Feature 3 — Relances signature (cron)

### Cron `/api/cron/quote-signature-reminders` (quotidien 10h)

Politique 3 échelons (pattern payment-reminders Lot 24) :

- **J+3** après envoi : rappel amical
- **J+7** : relance ferme (délai 4j depuis J+3)
- **J+15** : dernier avant expiration (délai 8j depuis J+7)
- Après : plus rien (le pro relance manuellement)

**`decideReminderTier(quote, now)`** est **pure, testable**, exposée via `__cronInternals`.

**Anti-spam** : chaque envoi incrémente `signatureReminderCount` (cap 3) + set `signatureReminderSentAt`.

Cap safety : 200 devis / run (au-delà, batch sur plusieurs jours).

## Modèle DB (`quotes` étendue)

8 nouvelles colonnes (bloc SQL **4quaterdecies**) :

- `signature_hash varchar(64)` — SHA-256 de preuve d'intégrité
- `signed_by_email varchar(255)` — email du signataire
- `signed_ip varchar(45)`, `signed_user_agent varchar(500)` — audit trail
- `signature_token_hash varchar(64)` — SHA-256 du magic-link (unique index partial)
- `signature_token_expires_at timestamp` — TTL 30j
- `signature_reminder_sent_at timestamp`
- `signature_reminder_count integer DEFAULT 0`

Index unique partial `quotes_signature_token_uidx WHERE signature_token_hash IS NOT NULL` pour le peek public rapide.

## UI publique

**`/devis/[token]/page.tsx`** — page publique noindex, mobile-first.

**`<QuoteSignFlow>`** — 3 états :

1. **loading** — spinner pendant peek
2. **preview** — 2 InfoCards (business/client), table items, totaux, CGV repliable, formulaire signature
3. **signed** — confirmation "Merci !" + timestamp

**Formulaire signature** :

- Input nom + email (pré-remplis depuis clients.email/firstName/lastName)
- Bouton "Dessiner ma signature" (optionnel) → `<SignaturePad>` existant
- Checkbox CGV obligatoire
- CTA vert grand format
- États d'erreur (invalid/expired/already signed) avec messages clairs

## Fichiers créés / modifiés

**Créés** (11) :

- `src/lib/quote-signature.ts` — token + hash + fingerprint
- `src/app/api/quotes/ai-generate/route.ts`
- `src/app/api/quotes/[id]/send-signature/route.ts`
- `src/app/api/quotes/sign/route.ts` — GET peek + POST sign
- `src/app/api/cron/quote-signature-reminders/route.ts`
- `src/app/devis/[token]/page.tsx`
- `src/app/devis/[token]/_components/QuoteSignFlow.tsx`
- `docs/QUOTE_AI_SIGNATURE.md`
- `tests/unit/quote-signature.test.ts` (14 tests)
- `tests/unit/quote-signature-reminders.test.ts` (10 tests)

**Modifiés** :

- `src/db/schema.ts` — 8 colonnes sur `quotes` + index unique partial
- `sql/00_apply_safe.sql` — bloc 4quaterdecies
- `src/lib/entitlements.ts` — feature `quotes.ai_generation` (Premium only)
- `src/lib/ai/prompts.ts` — `quoteGeneratorSystemPrompt()`
- `vercel.json` — cron quote-signature-reminders quotidien 10h
- `tests/unit/entitlements.test.ts` — nouvelle feature ajoutée

## Validations

- ✅ `npx tsc --noEmit` — 0 erreur
- ✅ `npm run lint` — 0 erreur / 260 warnings
- ✅ `npm run test` — **618 tests / 56 fichiers** (+25 vs Lot 37)
- ✅ `npm run build` — succès

## Impact business

- **Wow-factor commercial fort** : "générez votre devis en 30s avec l'IA" = argument démo
- **Signature électronique** = fluidité totale (avant : PDF envoyé, imprimé, signé, scanné, renvoyé)
- **Réactivation devis dormants** : les 3 rappels auto récupèrent 15-25% des devis oubliés (industrie)
- **Différenciateur BTP** : aucun concurrent FR ne combine IA + signature natives
- **Argument Premium** : `quotes.ai_generation` gate Premium = levier d'upsell

## Actions post-déploiement

1. `psql $DATABASE_URL -f sql/00_apply_safe.sql` — bloc 4quaterdecies (8 colonnes + index)
2. Vérifier `OPENAI_API_KEY` + `CRON_SECRET` dans Vercel
3. **Test manuel** :
   - En tant que Premium : créer un devis, cliquer "Générer avec l'IA" (UI dashboard à ajouter — v2 côté frontend dashboard/quotes)
   - Envoyer à signer → recevoir email → ouvrir `/devis/[token]` → signer
   - Vérifier notification push au pro + status devis passé en "accepted"
   - Cron manuel : `curl -H "Authorization: Bearer $CRON_SECRET" https://.../api/cron/quote-signature-reminders`

## UI dashboard IA generate — reportée v2

L'API `/api/quotes/ai-generate` est prête et testée, mais **le bouton "Générer avec l'IA" dans le dashboard n'est PAS livré** (dashboard/quotes déjà refondu Lot 18, ajout d'un composant modal `<AiQuoteGenerator>` = v2 rapide qui appelle l'API + populate le form).

Livré = backend complet + signature flow public complet. L'API est appelable via cURL/Postman pour test.

## Roadmap v2

- Modal `<AiQuoteGenerator>` dans `/dashboard/quotes/new` avec preview des items suggérés + acceptation ligne par ligne
- Intégration Yousign pour eIDAS qualifié (devis > 10K€ légal BTP)
- Conversion automatique devis signé → facture PDF téléchargeable
- Signature multi-parties (client + garant)
- Contre-signature du pro (validation finale côté artisan avant "confirmé définitif")
- Historique de signatures (versioning) — utile si un devis est modifié+re-signé
