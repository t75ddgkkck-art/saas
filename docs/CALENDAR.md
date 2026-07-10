# Calendrier avancé (F4 — Lot 33)

## Objectif business

Critère **bloquant marché** pour tout pro avec agenda chargé (kinésithérapeute, coiffeur, plombier avec 15 RDV/semaine). Sans calendrier vue semaine + drag&drop, ils vont ailleurs.

## Vues livrées

- **Jour** : grille horaire 7h-21h, 1 colonne
- **Semaine** : grille horaire 7h-21h, 7 colonnes lundi-dimanche
- **Mois** : grille 7×6 cases (6 semaines), max 3 events par case + "+N autres"

Toutes les vues supportent :
- Navigation `◀ Aujourd'hui ▶`
- **Drag & drop** pour reprogrammer un RDV (snap 15 min en jour/semaine)
- **Clic sur slot vide** = pré-remplir le modal "nouveau RDV" avec la date/heure
- **Ligne "now"** rouge sur la vue jour/semaine si aujourd'hui affiché
- **Codes couleur** par membre assigné (F5) — palette 8 couleurs stable via hash

## Composants

- `src/components/calendar/calendar-utils.ts` — utils purs testables (dates, grille, couleurs, positionnement PX)
- `src/components/calendar/CalendarView.tsx` — vue principale avec toggle jour/semaine/mois + drag&drop natif HTML5
- `src/components/calendar/AppointmentsCalendarPanel.tsx` — wrapper qui fetch `/api/appointments` + `/api/unavailabilities`, gère drop → PATCH avec rollback

**0 dépendance externe** (pas de FullCalendar, pas de date-fns). Grid CSS pur, HTML5 drag&drop natif.

## Modèle de données ajouté

### `unavailabilities` (nouvelle table)

Blocs de temps non-disponibles (déjeuner, congés, chantier long) :

```sql
id, business_id (cascade)
user_id           -- NULL = bloque toute l'équipe, sinon uniquement ce membre
title, date       -- YYYY-MM-DD
start_time, end_time -- HH:MM, NULL sur les 2 = journée entière
color             -- hex #RRGGBB optionnel
notes
```

### `calendar_tokens` (nouvelle table)

OAuth Google Calendar par business (1:1) :

```sql
business_id PK
provider = 'google'
refresh_token (TEXT)
access_token, access_token_expires_at (renouvelé à la volée)
calendar_id = 'primary'
scope, connected_at, last_sync_at
```

### `businesses.ics_secret`

Secret opaque hex 32 chars (UNIQUE partial index WHERE NOT NULL). Sert d'URL abonnable CalDAV : `/api/calendar/{secret}.ics`.

### `appointments.assigned_to_user_id` + `.google_calendar_id`

- `assigned_to_user_id` (F5 déjà là) — utilisé pour coloration + filtre
- `google_calendar_id` (existait, utilisé maintenant) — stocke l'ID de l'event Google poussé pour permettre update/delete

## Sync Google Calendar

Client dans `src/lib/google-calendar.ts` — fetch direct API v3, 0 dep.

**Flow OAuth** (`/api/google/calendar/connect` + `.../callback`) :
1. Le pro clique "Connecter Google Calendar" → redirect vers Google avec scope `calendar.events`
2. Google → callback avec `code` + `state` signé HMAC
3. Vérif state → échange code → stocke `refresh_token` + `access_token`
4. Upsert dans `calendar_tokens` (1 seul par business)

**Refresh automatique** : `getFreshAccessToken()` vérifie l'expiration + renouvelle via `refresh_token` si nécessaire (marge de sécurité 5 min).

**Push CREATE/UPDATE/DELETE** : appelé depuis les routes `/api/appointments/*` en fire-and-forget (`void ...`) — jamais bloquant, jamais throw.

- Create RDV → POST event Google → stocke `googleCalendarId`
- Update RDV (drag&drop ou edit) → PATCH event Google via `googleCalendarId`
- Cancel/Delete RDV → DELETE event Google

**Best-effort strict** : si Google refuse (token révoqué, quota, réseau), on log et on continue — la sync ne doit JAMAIS casser le flow métier.

## Export ICS (CalDAV / Apple / Outlook)

Route publique **`GET /api/calendar/{secret}.ics`** :

- URL abonnable dans Apple Calendar, Outlook, Google Calendar, Thunderbird
- Renvoie tous les RDV + indisponibilités d'un business dans une fenêtre ±1 an
- Format iCalendar (RFC 5545) 100% conforme (CRLF, line folding, escape TEXT)
- Headers : `Content-Type: text/calendar`, `Cache-Control: public, max-age=300` (5 min)
- Rate-limit léger : 30/min/IP (les clients CalDAV polling)
- Sécurité : URL EST le secret. Route renvoie **toujours 404** si secret invalide (jamais 401 → pas de leak d'existence)

**Gestion du secret** (`/api/calendar/ics-secret`) :
- `GET` → renvoie l'URL courante ou null
- `POST` → génère/rotate (32 bytes hex)
- `DELETE` → révoque (invalide toutes les abonnements)

**Lib `src/lib/ical.ts`** : 100% maison, RFC 5545 conforme.
- `buildIcsCalendar(events, opts)` — wrapper VCALENDAR
- `buildIcsEvent(event)` — VEVENT unique
- `escapeIcsText`, `foldIcsLine`, `formatIcsUtc` — helpers testés

## Routes API

| Route | Méthode | Auth | Description |
|---|---|---|---|
| `/api/unavailabilities` | GET | `appointments.view` | Liste blocs (?from&to) |
| `/api/unavailabilities` | POST | `appointments.create` | Crée bloc |
| `/api/unavailabilities/[id]` | DELETE | `appointments.delete` | Supprime bloc |
| `/api/google/calendar` | GET | `business.edit` | Statut connexion |
| `/api/google/calendar` | DELETE | `business.edit` | Déconnexion |
| `/api/google/calendar/connect` | GET | `business.edit` | Redirect OAuth |
| `/api/google/calendar/callback` | GET | Publique (state signé) | Callback OAuth |
| `/api/calendar/[secret]` | GET | Publique (secret) | Export ICS (CalDAV) |
| `/api/calendar/ics-secret` | GET/POST/DELETE | `business.edit` | Gestion secret ICS |

## Extensions routes existantes

- `POST /api/appointments` accepte `assignedToUserId` + push Google Calendar après create
- `PATCH /api/appointments/[id]` accepte `assignedToUserId` + push update Google (ou delete si status=cancelled)
- `DELETE /api/appointments/[id]` push delete Google
- `GET /api/appointments` retourne `assignedToUserId` + `googleCalendarId`

## Sécurité

- **CSRF OAuth** : `state` HMAC-signé (`NEXTAUTH_SECRET`), vérifié en `timingSafeEqual`
- **ICS secret** : 256 bits entropie, jamais leaké (404 systématique sur mauvais secret)
- **Google push** : refresh_token stocké en clair mais table `calendar_tokens` PK sur `business_id` → jamais exposée aux users
- **Rate-limits** : ICS 30/min/IP, secret rotate 20/h/IP
- **Best-effort strict** : Google API down ≠ Vitrix cassé

## Tests (45 nouveaux)

- **`calendar-utils.test.ts`** : 28 tests des fonctions pures
  - `toIsoDate/Time` : padding
  - `startOfWeek` : lundi ISO (mardi→lundi, dimanche→lundi, lundi→lui-même)
  - `startOfMonth/endOfMonth` : gère bissextile (29/02/2028)
  - `addDays/Months/Minutes` : immutable + rollover
  - `weekDays/monthGrid` : 7 et 42 cases exactes
  - `rangeLabel` : formats jour/semaine (même mois)/mois
  - `colorForKey` : déterministe, palette 8 stable
  - `hourSlots/timeToPx/durationToPx` : positionnement grille
- **`ical.test.ts`** : 17 tests RFC 5545
  - `formatIcsUtc` : format et padding
  - `escapeIcsText` : backslash first (ordre), semi/virgule/newlines
  - `foldIcsLine` : ≤75 chars intact, >75 chars folded CRLF+espace
  - `buildIcsEvent` : VEVENT minimal, échappement, tous les champs optionnels
  - `buildIcsCalendar` : wrapper VCALENDAR + CRLF, plusieurs events
  - `composeDateTime` : parse local time

## Roadmap

- **v1 livrée** : vues jour/semaine/mois, drag&drop reprogrammation, indispos, sync Google push, export ICS
- **v2** : sync Google **pull** (cron 5 min importe les events créés/modifiés dans Google Calendar) — nécessite résolution de conflits
- **v3** : récurrences RRULE (prestations hebdomadaires ex : coiffure "toutes les 6 semaines")
- **v4** : filtre "Mon calendrier" côté employé (utilise F5 assignedToUserId)
- **v5** : microsoft Outlook / Office 365 OAuth
- **v6** : notifications push J-1 côté client final (F3 + Web Push)
