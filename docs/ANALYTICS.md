# Analytics & réactivation (Lot 36)

## Objectif business

- **Analytics vitrine** = argument commercial fort pour Premium (justifie le prix)
- **Réactivation users inactifs** = récupération de churners (industrie SaaS : 15-25% des inactifs 30-60j reviennent avec un bon email)
- **RGPD-friendly par design** : aucune donnée personnelle stockée, pas de bandeau cookies nécessaire

## Analytics — architecture

### Tracker de visites

**Route `POST /api/track/visit`** :
- Appelée depuis `PublicPage.tsx` (client side, fire-and-forget avec `keepalive`)
- Respect `navigator.doNotTrack === "1"` → skip
- Rate-limit 60/min/IP
- Insert dans `page_visits` avec :
  - `date` (YYYY-MM-DD)
  - `source` (google, direct, facebook, whatsapp, qr, email…)
  - `device` (mobile / tablet / desktop)
  - `path`
  - `visitorHash` (32 chars SHA-256 salted par jour)

**RGPD** : `visitorHash = SHA-256(ip + userAgent + dayKey + NEXTAUTH_SECRET).slice(0, 32)`
- ✅ Salt journalier → impossible de tracker un visiteur cross-day (opt-out par design)
- ✅ IP/UA jamais écrits en DB
- ✅ Pas de cookie ni localStorage requis
- ✅ Compatible sans bandeau de consentement (finalité analytique anonyme)

### Route agrégations `GET /api/analytics?period=7d|30d|90d`

Retourne :
- **Summary** : totalVisits, uniqueVisitors, deltaVisitsPct (vs période précédente)
- **Timeline** : point par jour {date, visits, uniques}
- **Funnel** : visites → RDV créés → RDV terminés → paiements → CA
- **Sources** (Advanced) : top 10 avec compte
- **Devices** (Advanced) : mobile/desktop/tablet
- **Top paths** (Advanced) : pages les plus vues

**Gating** :
- Auth : `requireTeamPermission("analytics.view")` (tous les rôles sauf viewer sans plan)
- Plan Free : reçoit `upgradeRequired: true` + summary + timeline + funnel (basiques)
- Plan Pro+ : `analytics.advanced` entitlement → sources + devices + topPaths en plus

### Page dashboard/analytics

Refonte complète :
- **Avant** : 100% mock hardcodé (visitorData, sourceData, deviceData)
- **Après** : fetch réel avec sélecteur période 7d/30d/90d
- Charts recharts **lazy-loadés** via `dynamic(() => import(...), {ssr: false})` — ~150 KB économisés sur bundle initial pour les users qui ne visitent pas la page
- `<UpgradeGate feature="analytics.advanced">` sur sources/devices pour Free/Pro basique
- Composant `<FunnelChart>` maison (barres horizontales avec drop % entre étapes)

### Charts séparés (`_components/AnalyticsCharts.tsx`)

Recharts encapsulé dans un fichier dédié pour :
- Lazy-loading facile
- Réutilisation potentielle (widget dashboard futur)
- Isolation du bundle recharts

3 composants recharts + 1 maison :
- `<TimelineChart>` — AreaChart empilé visites/uniques avec gradient
- `<SourcesChart>` — BarChart vertical avec couleurs par source (Google bleu, Facebook, etc.)
- `<DevicesChart>` — PieChart donut
- `<FunnelChart>` — divs custom (léger, animé, calcule les drop%)

## Réactivation users inactifs

### Colonnes DB ajoutées

Sur `users` :
- `last_login_at TIMESTAMP` — posé par `POST /api/auth/login` (fire-and-forget)
- `reactivation_email_at TIMESTAMP` — anti-spam (max 1 email/mois)

Index partiel `users_last_login_idx WHERE last_login_at IS NOT NULL` — le cron scan uniquement les users qui se sont connectés au moins 1 fois.

### Cron `/api/cron/reactivation` (mardi 11h)

Auth : `Authorization: Bearer ${CRON_SECRET}` (pattern Vercel cron).

Logique `shouldSendReactivation(user, now)` — **pure, testable** :
- ✅ Email verifié requis
- ✅ Pas banni, pas soft-deleted
- ✅ Login entre 30j et 90j (fenêtre "récupérable")
- ✅ Email de réactivation il y a > 30j (anti-spam mensuel)

Après envoi : `reactivationEmailAt = now`.

Cap safety : 500 users max par run (au-delà, batch sur plusieurs jours).

### Template email

Sobre, 1 CTA clair, liste des nouveautés récentes :
- Page Aujourd'hui
- Espace client
- Acompte à la réservation
- Calendrier drag&drop + Google

Note en pied : "Cet email est envoyé une fois par mois maximum. Aucun autre rappel ne suivra."

Fréquence : **mardi 11h** (jour + heure les plus efficaces en B2B FR selon études).

## Tests

**`tests/unit/visitor-hash.test.ts` (16 tests)** :
- Hash déterministe même jour, différent entre 2 jours (cross-day blocked)
- Hash différent entre IPs / UAs
- `detectDevice` : desktop / mobile / tablet via UA patterns
- `detectSource` :
  - src query prioritaire (?src=qr, ?src=email)
  - sanitize alphanumeric only
  - moteurs de recherche (google/bing/duckduckgo)
  - réseaux sociaux (facebook/instagram/linkedin/twitter/whatsapp/youtube/tiktok)
  - autres → domain sans www

**`tests/unit/reactivation.test.ts` (11 tests)** :
- Conditions idéales (45j inactif) → true
- Banni / soft-deleted / non vérifié / jamais loggé → false
- Bord 30j inclusif, bord 90j inclusif
- Anti-spam : email < 30j → false, > 30j → true

## Fichiers créés / modifiés

**Créés** (7) :
- `src/lib/visitor-hash.ts`
- `src/app/api/track/visit/route.ts`
- `src/app/api/analytics/route.ts`
- `src/app/api/cron/reactivation/route.ts`
- `src/app/dashboard/analytics/_components/AnalyticsCharts.tsx`
- `tests/unit/visitor-hash.test.ts` (16 tests)
- `tests/unit/reactivation.test.ts` (11 tests)

**Modifiés** :
- `src/db/schema.ts` — colonnes users.lastLoginAt/reactivationEmailAt + pageVisits.visitorHash
- `sql/00_apply_safe.sql` — bloc 4duodecies
- `src/app/api/auth/login/route.ts` — pose `lastLoginAt` fire-and-forget
- `src/app/[slug]/PublicPage.tsx` — track visit avec `keepalive` + respect DNT
- `src/app/dashboard/analytics/page.tsx` — refonte fetch réel (0 mock)
- `vercel.json` — cron réactivation `0 11 * * 2`

## Actions post-déploiement

1. `psql $DATABASE_URL -f sql/00_apply_safe.sql` — bloc 4duodecies (colonnes lastLoginAt/reactivationEmailAt sur users + visitorHash sur page_visits)
2. **Vérifier que `CRON_SECRET` est configuré** dans Vercel (déjà utilisé pour les autres crons)
3. **Test tracking** : ouvrir une vitrine `/[slug]` en incognito → vérifier ligne dans `page_visits`
4. **Test analytics** : ouvrir `/dashboard/analytics` → sélecteur période → charts affichés
5. **Test cron réactivation** (dev) : `curl -H "Authorization: Bearer $CRON_SECRET" https://.../api/cron/reactivation` → JSON `{candidates, sent, errors}`

## Roadmap v2

- **Segmentation avancée** (Pro+) : cohortes visiteurs, retention curves, funnel personnalisé
- **A/B testing** sur la vitrine (2 versions, split 50/50, tracking conversions)
- **Export CSV** des visites brutes (compta / audit RGPD)
- **Emails digest hebdo** (dimanche) : "Cette semaine : X visites, Y RDV créés"
- **Alertes anomalies** : chute >30% de trafic → email au pro
- **QR code trackable** : `/qr/{businessSlug}` redirect avec `?src=qr` automatique (déjà supporté côté source detection)
- **Emails de réactivation IA** : LLM personnalise le corps selon l'historique (features utilisées avant churn)
