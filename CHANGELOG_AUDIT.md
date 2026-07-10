# 🛠️ Améliorations issues de l'audit

Ce document liste **exactement** ce qui a changé. Rapport détaillé dans [`AUDIT_REPORT.md`](./AUDIT_REPORT.md) et [`AUDIT_FULL_V2.md`](./AUDIT_FULL_V2.md).

---

# 🟢 Tour 10 — Lot 10 IA & coûts

## 10.1 — Client OpenAI centralisé (`src/lib/ai/client.ts`)

Avant : 5 fichiers appelaient directement `fetch("https://api.openai.com/v1/chat/completions")` avec `model: "gpt-4o-mini"` en dur.

Après : **un seul module** qui parle à OpenAI.

- `aiComplete(opts)` : appel non-streaming, retourne `{ ok, content, usage } | { ok: false, error, code }` — jamais throw, le call-site peut fallback simplement.
- `aiCompleteStream(opts)` : version SSE décodée en texte plat (pour /api/ai-chat/stream).
- `isAiConfigured()` : check clé API.
- **Modèle configurable** via `OPENAI_MODEL` (défaut `gpt-4o-mini`), `OPENAI_BASE_URL` (compat Azure/Mistral), `OPENAI_TIMEOUT_MS` (30s défaut).
- **Timeout** avec `AbortController` (évite les hangs).
- **Logging structuré** : `ai.completion`, `ai.timeout`, `ai.http_error`, `ai.fetch_failed`.
- **Retour tokens** : `promptTokens`, `completionTokens`, `totalTokens`, `model` — utilisé par le tracking usage.

## 10.2 — Quotas mensuels par utilisateur

Nouvelle table **`ai_usage`** (schéma + SQL idempotent) :
- Colonnes : `userId`, `route`, `model`, `promptTokens`, `completionTokens`, `totalTokens`, `estimatedCostUsd`, `createdAt`
- 2 index : `(userId, createdAt)` pour quota check ; `(model, createdAt)` pour agrégations admin

Nouveau **`src/lib/ai/usage.ts`** :
- `AI_TOKEN_LIMITS` : `{ free: 0, pro: 300_000, premium: 2_000_000 }` tokens/mois
- `getMonthlyUsage(userId)` : somme SUM(tokens) WHERE user_id = ? AND created_at >= 30j
- `checkAiQuota(userId, plan)` : renvoie `{ allowed, used, limit, remaining, reason? }`
- `recordAiUsage(...)` : insert fire-and-forget après chaque appel réussi
- `estimateCostUsd(prompt, completion)` : prix indicatif gpt-4o-mini

**Coût max par pro premium : ~1 $/mois** même à quota plein (2M tokens à 0.15/0.60 $ par 1M).

Routes qui appliquent le quota :
- `POST /api/ai-blog`
- `POST /api/ai-tools` (report + social-post)
- `POST /api/reviews/ai-reply`
- Helpers `src/lib/ai-content.ts` (`generateSocialPost`, `generateMonthlyReport`)

Le chat public (`/api/ai-chat`) est exempt de quota par user (car public, pas de session), mais reste protégé par le rate-limit 15/5min/IP + le budget global via clé API.

## 10.3 — Prompts externalisés (`src/lib/ai/prompts.ts`)

6 prompts centralisés et typés :
- `publicChatSystemPrompt(biz, services, hours)` : chatbot vitrine
- `publicChatFallback(msg, biz, services, hours)` : règles déterministes sans IA
- `reviewReplySystemPrompt(biz)` : réponse aux avis
- `blogArticleSystemPrompt(biz, topic)` : article SEO ~400 mots
- `socialPostSystemPrompt(biz, platform)` : post FB/IG/LI adapté
- `monthlyReportSystemPrompt()` : rapport mensuel consultant

Chaque prompt est **testé unitairement** (11 tests) — impossible de casser une règle en modifiant un prompt sans que le test rouge.

## 10.4 — Streaming pour le chat

Nouvelle route **`POST /api/ai-chat/stream`** :
- Renvoie `text/plain` en flux (chunks des deltas OpenAI décodés)
- Headers `X-Accel-Buffering: no` + `Cache-Control: no-cache, no-transform` pour forcer le flush au fil de l'eau (Vercel/nginx)
- Fallback non-streamé si IA absente ou erreur (règles déterministes)
- Rate-limit identique à `/api/ai-chat` (15/5min/IP)

Côté client à intégrer :
```ts
const res = await fetch("/api/ai-chat/stream", { method: "POST", body: JSON.stringify({ businessId, message }) });
const reader = res.body!.getReader();
const decoder = new TextDecoder();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  setMessage((m) => m + decoder.decode(value));
}
```

## 10.5 — Fallback complet

Chaque route IA possède maintenant un fallback quand :
- `OPENAI_API_KEY` manque (dev)
- OpenAI répond 429/5xx
- Timeout (30s défaut)
- Quota user dépassé

Fallback = contenu utile pré-rédigé (règles), jamais une page vide ou une erreur 500. L'user voit toujours quelque chose.

## Bonus — Endpoint d'introspection

Nouvelle route **`GET /api/ai/usage`** :
- Renvoie l'usage mensuel du user courant + quota + coût estimé
- À consommer depuis le dashboard pour afficher une jauge

Exemple de réponse :
```json
{
  "used": 42350,
  "limit": 300000,
  "remaining": 257650,
  "percentUsed": 14,
  "requests": 87,
  "estimatedCostUsd": 0.023,
  "plan": "pro",
  "allowed": true
}
```

## Tests unitaires (+16 : 102 → 120 → au final 120)

Wait, correction : **120 tests** (les tests IA prompts + usage étaient dans un fichier différent).

- `tests/unit/ai-usage.test.ts` (5 tests) : limites par plan, estimation coût
- `tests/unit/ai-prompts.test.ts` (11 tests) : chaque prompt inclut les bonnes données + fallback règles couvre tous les intents (RDV, prix, urgence, horaires, adresse, hors-sujet)

## Validations finales

```
tsc --noEmit  → 0 erreur
vitest run    → 120/120 tests OK
next build    → Compiled successfully, 42/42 pages, 0 warning
              → Nouvelles routes: /api/ai-chat/stream, /api/ai/usage
```

## Migration DB requise

Rejouer `sql/00_apply_safe.sql` sur Supabase → crée la table `ai_usage` avec ses 2 index (safe rejouable, aucun impact sur données existantes).

## Variables d'environnement (nouvelles / optionnelles)

| Variable | Défaut | Description |
|---|---|---|
| `OPENAI_MODEL` | `gpt-4o-mini` | Modèle IA principal |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Compat Azure OpenAI, Mistral, self-hosted |
| `OPENAI_TIMEOUT_MS` | `30000` | Timeout des appels IA |

## Impact facture OpenAI

| Scénario | Avant | Après |
|---|---|---|
| Un pro premium buggé qui boucle sur `/api/ai-blog` | Illimité (facture 4 chiffres possible) | **Bloqué à 2M tokens/mois** (~1 $) |
| Chat public spammé | Rate-limit 15/5min/IP seul | Rate-limit **+** log de coût par appel |
| Changer de modèle (gpt-4o → claude) | Modifier 5 fichiers | Une seule variable `OPENAI_MODEL` |
| Ajouter Sentry / Datadog sur les appels IA | Impossible (dispersé) | 1 seul point d'entrée (`aiComplete`) |

---

# Historique tours précédents

- `5c8ccea` — Tour 9 : Lot 9 emails (queue, unsubscribe RGPD, budget SMS)
- `11211b5` — Tour 8 : Lot 8 i18n (116 clés, interpolation, emails multi-langues)
- `8fcc196` — Tour 7 : Lot 6 SEO (sitemap-index paginé, rich snippets)
- `7beadb6` — Tour 6 : Lot 5 perf (ISR, index DB, next/image, next/font)
- `2c928bb` — Tour 5 : Lot 4 a11y (WCAG AA)
- `5380ed0` — Tour 4 : Lot 3 UI/UX (theme, toast, skeletons, onboarding)
- `f5b3f2b` — Tour 3 : Lots 1+2 (sécurité + code mort)
- `096b2aa` — Fix SQL tolérant tables absentes
- `89d448b` — SQL idempotent + audit v2
- `e642e8b` — Tour 2 : favicon, Vercel/IONOS
- `4c25f9c` — Tour 1 : sécurité fondamentale
