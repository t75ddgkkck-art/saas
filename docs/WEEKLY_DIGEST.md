# Email digest hebdomadaire (F15 — Lot 53)

Refonte complète du cron `weekly-summary` existant (Lot 18) qui était froid,
Pro-only, sans opt-out et sans action items.

## Objectif

Anti-churn massif : un user qui n'ouvre pas Vitrix pendant 10 jours reçoit un email
récap **personnalisé selon son segment d'activité** avec des actions cliquables.

## Architecture 3 couches

### 1. Cron `/api/cron/weekly-summary` (dimanche 18h)

Orchestre le batch. Pour chaque business :
1. Check opt-in DB (`users.weekly_digest_enabled`) + opt-out email (table `email_optouts`)
2. Charge 9 stats en parallèle (visites, RDV, devis, paiements, reviews, action items)
3. Calcule segment via `computeDigestSegment`
4. Calcule action items via `computeActionItems`
5. Décide envoi via `shouldSendDigest` (multiples règles anti-spam)
6. Build HTML + subject → envoie via Resend avec headers `List-Unsubscribe` RFC 8058
7. Update `users.weekly_digest_sent_at` (anti-doublon si cron rejoué)

### 2. Lib `weekly-digest.ts` — pure functions testables

- `computeDigestSegment(stats)` → `power | active | quiet | dormant`
- `computeActionItems(input)` → liste `[{label, count, url, priority}]` triée
- `shouldSendDigest(...)` → `{send, reason}` avec 5 raisons possibles
- `buildDigestHtml(payload)` → HTML complet responsive/dark-mode friendly
- `buildDigestSubject(...)` → sujet email adapté au segment

100% testable unitaire — zéro accès DB.

### 3. UI opt-out `/dashboard/settings > Notifications`

Toggle switch dans `<WeeklyDigestToggle>` avec PATCH direct
`/api/account/weekly-digest`. Pattern optimistic UI (rollback si l'API fail).

## Segmentation 4 tons

| Segment | Critère | Ton email |
|---------|---------|-----------|
| **power** | 10+ RDV OU 1000€+ revenus | Célébration, chiffres en avant, "🚀 belle semaine" |
| **active** | 1+ RDV / 1+ devis / 5+ visites | Récap factuel classique |
| **quiet** | Peu d'activité (< actif) | Doux, "Idées pour relancer" |
| **dormant** | 3+ semaines sans login | "On ne vous voit plus" (sans guilt-trip) |

**Priorité absolue** : `weeksSinceActivity >= 3` → dormant, même si la vitrine
a reçu des visites organiques.

## Action items (3 catégories priorités)

- **HIGH** : reviews négatifs non répondus, factures en retard
- **MEDIUM** : devis en attente signature > 3j
- **LOW** : RDV demain à confirmer (préventif no-show)

Filtre défensif : items avec count=0 exclus (pas de "0 avis à répondre" inutile).

## Anti-spam intelligent

`shouldSendDigest` skip l'envoi dans 5 cas :

1. **`opted_out`** : `weekly_digest_enabled=false` OU présent dans `email_optouts`
2. **`sent_recently`** : dernier digest < 6 jours (cron rejoué manuellement)
3. **`quiet_no_actions`** : segment quiet ET zéro action item (pas de contenu utile)
4. **`dormant_recent_relance`** : segment dormant MAIS `reactivation_email_at` < 30j (double email prévenu)
5. **`ok`** : envoie

Logs `batch_done` avec compteur par raison → dashboarding easy.

## RGPD compliance

- **Opt-in par défaut** (bool `weekly_digest_enabled=true`) — acceptable car
  le digest est un **récap d'activité de l'user**, pas de la promo pure.
- **Opt-out one-click** via header `List-Unsubscribe` (RFC 8058) — bouton natif
  Gmail/Outlook/iOS Mail. Écrit dans `email_optouts` avec catégorie `weekly-digest`.
- **Opt-out in-app** via toggle `/dashboard/settings > Notifications`.
- **2 mécanismes indépendants** : le cron check les DEUX. Un opt-out email fonctionne
  même si le user n'ouvre jamais son dashboard.

## Template email

- Inline styles obligatoires (Gmail supprime les `<style>` tags)
- Meta `color-scheme: light dark` pour support dark mode iOS/Apple Mail
- Preheader masqué (aperçu Gmail/iOS)
- Grid 2x2 stats mobile-friendly
- Action items avec dot coloré par priorité (rouge/orange/gris)
- Footer avec lien opt-out visible (obligation légale)
- Escape HTML basique sur `businessName` (défense XSS via nom fantaisiste)

## Colonnes DB ajoutées (bloc `4vicesimus`)

```sql
ALTER TABLE users
  ADD COLUMN weekly_digest_enabled boolean DEFAULT true NOT NULL,
  ADD COLUMN weekly_digest_sent_at timestamp;
```

Les users existants sont automatiquement opt-in via le DEFAULT — comportement
souhaité (le digest est utile pour tous, opt-out simple si non voulu).

## Routes API

- `GET /api/cron/weekly-summary` — batch cron (auth Bearer CRON_SECRET)
- `GET /api/account/weekly-digest` — lit préférence
- `PATCH /api/account/weekly-digest` — update `{enabled: boolean}`

## Tests

`tests/unit/weekly-digest.test.ts` — **28 tests** :
- computeDigestSegment (5 tests — dormant priorité, power seuils, active/quiet)
- computeActionItems (5 tests — ordre priorité, filtre count=0, pluralisation)
- shouldSendDigest (8 tests — opt-out, sent_recently, quiet_no_actions, dormant_recent, OK)
- buildDigestSubject (4 tests — chiffres power, business name active, ton dormant, tronc 40 chars)
- buildDigestHtml (6 tests — infos essentielles, XSS escape, unsubscribe, preheader, actions rendus/absents, dark-mode meta)

## Actions post-déploiement

1. **DB migration** : `bash sql/apply.sh` — bloc `4vicesimus` idempotent, ajoute
   les 2 colonnes avec DEFAULT (aucune migration data requise)
2. Le cron existant `weekly-summary` (dimanche 18h dans `vercel.json`) prend le
   relais automatiquement dès le prochain dimanche
3. **Optionnel** — test manuel :
   ```bash
   curl -X POST -H "x-cron-secret: $CRON_SECRET" \
     https://vitrix.fr/api/cron/weekly-summary
   ```
   Vérifie la réponse `{ok, total, sent, skipped, skipReasons: {...}}`

## Métriques à surveiller

- **Open rate** cible : > 30% (bench SaaS artisan)
- **Click rate** cible : > 8% (les action items doivent inciter au clic)
- **Unsubscribe rate** cible : < 2% par semaine (au-delà = tone trop agressif)
- **Skip rate `opted_out_*`** doit rester stable — augmentation soudaine = signal
  UX (trop d'emails de Vitrix ailleurs, saturation)

Suivi via Resend dashboard ou logs `weekly-digest.batch_done`.

## Out of scope v1

- Test A/B sujets
- Personnalisation multi-langues (juste FR)
- Digest mensuel long-form pour power users
- Newsletter marketing séparée (uses `marketing` category, module distinct)
