# Notifications v2 (F6 — Lot 34)

## Résumé

Refonte complète du système de notifications qui règle 3 bugs majeurs identifiés dans l'audit V4 :

- **B29** — Encoche iPhone masquait burger + notifications (safe-area)
- **B30** — Push OS jamais envoyées (route subscribe existait mais 0 émission)
- **B25** — Notifications in-app générées dans 2 cas / 15 seulement

Plus 6 quick wins mobile en bonus.

## Architecture

```
src/lib/push.ts              — Client web-push OPTIONNEL (fetch direct API)
src/lib/notify.ts            — Helper unifié (DB + push + prefs + DND)
src/db/schema.ts             — Table notification_preferences (opt-out)
src/components/notifications/
  └── PushSubscribeButton.tsx  — UI activation push OS
src/app/dashboard/settings/_components/
  └── NotificationsTab.tsx   — Onglet Settings complet
public/sw.js                  — SW enrichi (tag/actions/vibrate + focus fenêtre)
```

## Safe-area (B29)

**Correctif en 3 points** :

1. **`viewport.viewportFit: "cover"`** dans `src/app/layout.tsx` — active `env(safe-area-inset-*)` sur iOS
2. **Utilities Tailwind v4** dans `globals.css` :
   ```css
   @utility pt-safe { padding-top: max(0.75rem, env(safe-area-inset-top)); }
   @utility bottom-safe { bottom: max(0.75rem, env(safe-area-inset-bottom)); }
   /* + pb-safe, pl-safe, pr-safe, top-safe, mt-safe, mb-safe */
   ```
3. **Composants fixed migrés** vers safe-area :
   - `MobileTopBar` : `top-3` → `top-safe pr-safe`
   - Burger sidebar : `top-4` → `top-safe pl-safe`
   - `CookieConsent` : `bottom-3` → `bottom-safe`
   - `SupportBubble` : `sm:bottom-6` → `sm:bottom-safe`

**Bonus mobile** :
- Meta `apple-mobile-web-app-title = "Vitrix"`
- Meta `format-detection: telephone=no` (empêche iOS de linker les numéros dans le texte)
- CSS auto : `input/textarea/select` → font-size min 16px sur mobile (empêche zoom iOS)
- Manifest `orientation: "any"` (débloque le calendrier en landscape)

## Push OS (B30)

**Client `src/lib/push.ts`** — dépendance `web-push` OPTIONNELLE (pattern Sentry Lot 13) :

- Chargée via `Function("return require")()` → non bundlée par Next si absente
- No-op silencieux sans VAPID keys → le flow métier continue de fonctionner
- Cleanup automatique des subscriptions expirées (404/410 Gone → delete)

**Configuration requise pour activer** :

```bash
npm install web-push
npx web-push generate-vapid-keys
# → set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:) en env
```

**API** :
- `sendPushToUser(userId, payload)` — envoie à tous les devices actifs
- `isPushConfigured()` — true si dep + VAPID prêts
- `getVapidPublicKey()` — pour exposition frontend

**Route `/api/push/vapid-key`** : renvoie la clé publique + `configured: bool`.

**Service Worker enrichi** :
- Support tag / renotify / actions / vibrate
- Au clic notification → cherche une fenêtre déjà ouverte sur la même URL et la focus (évite d'empiler des onglets)

## Helper unifié `notify()` (B25)

**Un seul point d'entrée** pour toute notification vers un pro :

```ts
import { notify, notifyAsync } from "@/lib/notify";

await notify({
  userId: business.ownerId,
  businessId: business.id,
  type: "appointment.created",   // enum figé
  title: "Nouveau rendez-vous 📅",
  message: "...",
  data: { appointmentId: ... },
  channels: ["db", "push"],       // défaut, override possible
  priority: "normal",             // "high" = bypass DND
  url: "/dashboard/appointments", // clic push → cette URL
  tag: `appointment-${id}`,       // dedup
});
```

**Gère automatiquement** :
- Insert `notifications` (in-app, visible dans le NotificationBell)
- `sendPushToUser()` (best-effort, respect DND)
- Vérif `notification_preferences` de l'user :
  - Type dans `disabledTypes` → skip complet
  - Channel dans `disabledChannels` → skip ce canal uniquement
- DND (Do Not Disturb) : push suppressed dans la fenêtre horaire, sauf `priority: "high"`
- **NON-THROWING strict** : jamais bloque le flow métier appelant

**Variante `notifyAsync()`** : fire-and-forget pour webhooks Stripe/etc.

### Types d'events supportés (26 types dans NotifType)

Groupés dans `NotificationsTab` :
- **Rendez-vous** : created / cancelled_by_client / no_show_detected / reminder_sent
- **Paiements** : payment.received / deposit.paid / deposit.refunded / invoice.overdue
- **Devis** : received / accepted / declined / expired
- **Avis** : review.received
- **Équipe** : invitation_accepted / member_left
- **Quotas** : ai_reached / sms_reached / storage_reached
- **Abonnement** : trial_ending / grace_period / expired
- **Sync externes** : google_calendar_broken
- **Générique** : system.info

## Table `notification_preferences`

Modèle **opt-out** (par défaut tout activé) :

```sql
user_id            uuid PK
disabled_types     jsonb DEFAULT '[]'    -- ex: ["review.received"]
disabled_channels  jsonb DEFAULT '[]'    -- ex: ["push"]
dnd_start          varchar(5)            -- "22:00"
dnd_end            varchar(5)            -- "08:00"
updated_at         timestamp
```

**Fenêtre DND** : supporte le wrap-around minuit (22h-8h → dedans si >=22h OU <8h).

## Câblages réalisés (5 hotspots)

1. **`POST /api/book-appointment`** — RDV créé → `notify(appointment.created)`
2. **`POST /api/quote-request`** — Devis reçu → `notify(quote.received)`
3. **`POST /api/reviews/public`** — Avis reçu → `notify(review.received)`, priority `high` si 1-2 étoiles
4. **`handleBookingDepositCompleted`** (Stripe webhook) — Acompte payé → `notify(deposit.paid)`
5. **`POST /api/team/accept`** (F5) — Invitation acceptée → `notify(team.invitation_accepted)` à l'inviteur
6. **`handleTrialWillEnd`** (Stripe webhook) — Trial J-3 → `notify(subscription.trial_ending)` priority high

## Route settings API

`GET/PUT /api/account/notification-preferences` :
- GET → lit les prefs (défaut tout activé si aucune ligne)
- PUT → upsert avec cohérence DND (partiel → nulls les 2)

## UI onglet Notifications

3 sections dans `NotificationsTab` :

1. **Push OS** — bouton subscribe/unsubscribe avec :
   - Détection support (Notification API + PushManager + Service Worker)
   - Guide iOS (nécessite installation PWA)
   - Statut permission ("denied" → guide vers paramètres nav)
2. **Do Not Disturb** — 2 `<input type="time">` + bouton "Désactiver"
3. **Événements** — checkboxes groupées par domaine, opt-out

Sauvegarde via bouton `<Save>` unique en bas.

## Quick wins mobile (A1-A6)

- `viewport-fit: cover` ✅
- Safe-area utilities ✅
- `text-base` inputs mobile via CSS auto ✅
- `type="tel"` + `inputMode="tel"` sur champ téléphone register ✅
- `autoComplete` explicite (email, given-name, family-name, tel, street-address, new-password) ✅
- Meta `format-detection: telephone=no` (empêche numéros auto-linkés) ✅

## Tests (16 nouveaux)

- **`tests/unit/notify.test.ts`** :
  - `isInDnd` : fenêtre simple, wrap-around minuit, bords inclusifs/exclusifs
  - `notify()` : canaux, prefs, DND, priority high, tag, url, message tronqué 300 chars, non-throwing

## Actions post-déploiement

1. **SQL** : `psql $DATABASE_URL -f sql/00_apply_safe.sql` — bloc 4decies (table `notification_preferences`)
2. **VAPID (optionnel mais recommandé)** :
   ```bash
   npm install web-push
   npx web-push generate-vapid-keys
   ```
   Ajouter `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` dans Vercel
3. **Vérifier** en PWA installée iPhone 14+ que burger + notifications sont accessibles
4. **Test E2E push** :
   - Ouvrir dashboard Chrome/Edge → onglet Notifications → "Activer"
   - Envoyer un test via console : `fetch("/api/... création RDV factice ...")`
   - Push devrait apparaître dans le centre de notifications OS

## Roadmap v3

- **Push riche avec actions inline** : "Confirmer RDV" / "Reporter" / "Répondre à l'avis" — sans ouvrir l'app
- **Digest DND** : à la fin de la fenêtre DND, envoyer un résumé des N notifs manquées
- **Grouping** : 5 nouveaux RDV en < 30s → 1 seule push "5 nouveaux RDV" au lieu de 5 séparés
- **SSE / WebSocket** pour mise à jour temps réel du NotificationBell sans polling
- **Statut lu par device** (aujourd'hui `isRead` global)
