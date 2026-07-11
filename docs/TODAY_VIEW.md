# Today view (F6 — Lot 35)

## Objectif business

Killer feature terrain quotidienne. Un artisan qui ouvre son téléphone entre 2 chantiers doit voir **en 1 tap** :
- Ses RDV du jour en chrono
- Le prochain (countdown)
- Météo (interventions extérieures)
- Boutons rapides : appeler / GPS / WhatsApp / statut / encaisser / note vocale

**Cible primaire** : usage mobile terrain (5 min entre 2 chantiers).

**Impact** : usage quotidien = habitude = rétention. Justifie l'installation de la PWA.

## State machine renforcée (fix B23)

Nouvelle lib `src/lib/appointment-status.ts` :

- Enum étendu : `pending / confirmed / en_route / in_progress / completed / no_show / cancelled` (5 → 7)
- Matrice `TRANSITIONS` déclarative : quelles transitions sont autorisées depuis chaque état
- `canTransition(from, to)` — bloque les transitions invalides
- **États finaux figés** : `completed / no_show / cancelled` ne peuvent JAMAIS être rouverts via API
  → ferme le bug B23 : un pro ne peut plus rouvrir un no-show annulé pour re-facturer
- Idempotence : `canTransition(x, x) === true` (permet retry sans erreur)

### Timeline automatique

3 nouveaux timestamps sur `appointments` : `checked_in_at`, `started_at`, `finished_at`.

`resolveTimelineFields(newStatus, current)` pose les timestamps automatiquement :
- `en_route` → `checkedInAt` (départ vers le client)
- `in_progress` → `checkedInAt` + `startedAt`
- `completed` → les 3 timestamps

**Non-écrasement** : un timestamp déjà posé n'est jamais écrasé (si un pro clique "En route" deux fois, checkedInAt garde la 1re valeur).

Helpers KPI : `computeDurationMinutes()` + `computeTravelMinutes()` — prêts pour dashboard analytics futur.

## Nouvelles routes API (3)

| Route | Méthode | Auth | Rate | Description |
|---|---|---|---|---|
| `/api/appointments/[id]/status` | POST | `appointments.edit_any` | 60/min/IP | Transition state machine avec validation |
| `/api/appointments/[id]/quick-payment` | POST | `payments.create` | 30/h/IP | Encaissement 1-clic + auto-complete |
| `/api/weather?lat=&lon=` | GET | Publique (session) | 60/min/IP | Proxy Open-Meteo (cache 1h) |

## Composants livrés (5)

- **`<TodayView>`** — client component, refetch géré, KPIs (à venir/en cours/terminés), bandeau prochain RDV avec countdown 30s, EmptyState
- **`<TodayAppointmentCard>`** — carte terrain grande zone tap (min 44×44px HIG) : contact tel/WhatsApp/GPS, actions state machine, encaissement, note vocale
- **`<QuickPaymentModal>`** — grand input numérique + 4 méthodes visuelles + toggle "marquer terminé"
- **`<VoiceNote>`** — Web Speech API fr-FR, transcription live, ajoute à la description RDV
- **`<WeatherWidget>`** — géoloc auto, fallback Paris, masqué silencieusement si API down

## Deep links mobile natifs

- **`tel:`** — ouvre l'appli téléphone (iOS/Android)
- **`https://wa.me/{phone}`** — ouvre WhatsApp avec numéro pré-rempli
- **`maps://?daddr=`** sur iOS/macOS (Apple Maps natif)
- **`https://www.google.com/maps/dir/?api=1&destination=`** ailleurs (Google Maps)

## Encaissement 1-clic

Depuis la carte RDV → bouton "💰 Encaisser" ouvre modal :
1. Input `type="text"` `inputMode="decimal"` grand format (mobile → clavier numérique)
2. 4 méthodes : Espèces / CB terminal / Chèque / Virement
3. Toggle "Marquer aussi terminé" (par défaut ON)
4. Note optionnelle (repliée)

Backend `POST /api/appointments/[id]/quick-payment` :
- Crée `payments` avec `type=full` + `status=completed`
- Metadata liée au RDV (`appointmentId`, `method`, `source: quick_payment`)
- Si `alsoComplete=true` : passe le RDV en `completed` avec timeline auto
- Notification push au owner via `notify(payment.received)`

## Note vocale (Web Speech API)

- `webkitSpeechRecognition` / `SpeechRecognition` selon nav
- Langue : `fr-FR`
- Continuous + interimResults
- Ajout à `description` avec timestamp `[Note vocale 14h35]\n...`
- Fallback UI clean si non supporté (Firefox)

Support :
- ✅ Chrome / Edge / Safari 14.5+
- ✅ Chrome Android
- ✅ iOS Safari 14.5+
- ❌ Firefox (message explicite)

## Météo (Open-Meteo)

- API **gratuite, sans clé, sans compte** (open-meteo.com)
- Route `/api/weather` proxy avec cache 1h (Next `revalidate: 3600`)
- Timeout 5s → widget masqué si down (non essentiel)
- Traduction WMO codes → emoji + label FR
- Widget affiche : temp actuelle + min/max jour + vent + précipitations

## UI mobile-first

- Touch targets min **44×44px** (Apple HIG)
- Layout 1 colonne, `max-w-2xl` sur desktop
- Sidebar : "Aujourd'hui" en TÊTE de menu (avant Dashboard) — usage terrain > analytics
- Refactor sidebar : helper `insertBeforeSettings(item)` robuste aux ajouts futurs (avant : `slice(0, 5)` codé en dur → cassé dès qu'on ajoute un item)

## Tests (20 nouveaux)

`tests/unit/appointment-status.test.ts` :
- Matrice transitions : chaque état source × cible testé
- **Canary B23** : états finaux ne transitionnent JAMAIS (sauf idempotence)
- Timeline : pose auto + non-écrasement + reset checkedInAt en cas de skip
- `computeDurationMinutes` / `computeTravelMinutes` : cas nominal + null si timestamp manquant

## SQL

Bloc **4undecies** dans `sql/00_apply_safe.sql` :
- `ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'en_route'` + `'in_progress'`
- 3 colonnes timestamp sur `appointments` (nullable, idempotent)

## Actions post-déploiement

1. `psql $DATABASE_URL -f sql/00_apply_safe.sql` — bloc 4undecies
2. **Test mobile** : ouvrir `/dashboard/today` en PWA installée
   - Vérifier les 3 boutons statut fonctionnent
   - Tester encaissement 1-clic
   - Tester deep links (tel/GPS/WhatsApp)
   - Tester note vocale (permission micro)
3. Communication : "Nouveauté : votre nouvelle page **Aujourd'hui** — tout ce qu'il faut sur le terrain en 1 tap."

## Roadmap v2

- **Assignation membre F5** : filtre "Mes RDV" pour employés (colonne `assigned_to_user_id` déjà en DB)
- **Rappel J-1 push** : cron soir 18h envoie push "Rappel : 3 RDV demain" (dépend de VAPID configuré)
- **Mode "focus"** : bouton "Je suis en RDV" → mute push 1h + auto-répondeur SMS
- **Sync bidirectionnelle timeline vers Google Calendar** (update `event.status` selon `in_progress`)
- **KPI temps réel** : temps trajet moyen, durée intervention moyenne (basé timeline)
- **Signature client sur place** : signer un bon d'intervention avec le doigt sur mobile → PDF envoyé auto
