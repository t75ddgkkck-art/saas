# 🔍 Audit UX / mobile / personnalisation / notifications — V4

**Date** : 11/07/2026
**Contexte** : après 33 lots livrés, audit terrain en conditions réelles (mobile PWA, encoche iPhone, notifications, adaptation, personnalisation).
**Ton** : direct, hiérarchisé, actionnable.

---

## 🚨 Bugs bloquants (à corriger AVANT toute nouvelle feature)

### B29 — Encoche iPhone masque les boutons burger + notifications ⛔ CRITIQUE

**Symptôme** : sur iPhone en PWA installée (et à un moindre degré en Safari mobile plein écran), le bouton burger sidebar (`top-4`) et le `MobileTopBar` (`top-3`) passent **sous** l'encoche/status bar. Ils ne sont plus cliquables sur la zone haute.

**Cause racine** (3 problèmes cumulés) :

1. **`viewport.viewportFit` manquant** dans `src/app/layout.tsx` — sans `viewport-fit: cover`, iOS n'expose PAS les `env(safe-area-inset-*)`
2. **`apple-mobile-web-app-status-bar-style: black-translucent`** dans le `<head>` fait passer le status bar SOUS le contenu en mode PWA installée. C'est un choix visuel valide MAIS il exige alors d'ajouter partout `padding-top: env(safe-area-inset-top)`
3. **`0 occurrence de `env(safe-area-\*)`** dans tout le CSS/TSX — aucun composant fixed en haut d'écran ne compense l'encoche

**Fichiers impactés** :

- `src/app/layout.tsx` — viewport + head
- `src/app/globals.css` — pas de safe-area utilities
- `src/components/layout/MobileTopBar.tsx` — `top-3` sans safe-area
- `src/components/layout/Sidebar.tsx:85` — burger `top-4` sans safe-area
- `src/components/layout/CookieConsent.tsx` — bottom sans `safe-area-inset-bottom` (masqué par home indicator iPhone)
- `src/components/layout/SupportBubble.tsx:71` — `bottom-40` sans safe-area
- `src/components/layout/PWAInstallBanner.tsx` (à vérifier)
- Modal.tsx — si close button en top, même souci

**Correctif** (1 lot de 2h, à faire EN PRIORITÉ) :

```ts
// src/app/layout.tsx
export const viewport: Viewport = {
  themeColor: [...],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",   // ← ACTIVE env(safe-area-*)
};
```

```css
/* globals.css — utilities safe-area (Tailwind v4 syntaxe) */
@utility pt-safe {
  padding-top: max(0.75rem, env(safe-area-inset-top));
}
@utility pb-safe {
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
}
@utility pl-safe {
  padding-left: env(safe-area-inset-left);
}
@utility pr-safe {
  padding-right: env(safe-area-inset-right);
}
@utility top-safe {
  top: max(0.75rem, env(safe-area-inset-top));
}
@utility bottom-safe {
  bottom: max(0.75rem, env(safe-area-inset-bottom));
}
```

Puis dans chaque composant fixed :

- `MobileTopBar` : `top-3` → `top-safe`
- Burger sidebar : `top-4` → `top-safe`
- `CookieConsent` : ajouter `pb-safe`
- `SupportBubble` : `bottom-40 sm:bottom-6` → `bottom-40 sm:bottom-safe`
- `main` dashboard layout : garder `pt-20` mais ajouter `pt-safe` en plus si header caché sous status bar

**Test** : ouvrir sur iPhone 14+ en PWA installée (Ajouter à l'écran d'accueil), vérifier burger + bell accessibles.

---

### B30 — Push notifications OS jamais envoyées

**Symptôme** : la route `POST /api/push/subscribe` sauve bien les subscriptions dans `pushSubscriptions`. Mais **aucun code n'appelle jamais `webpush.sendNotification()`** — les users installent la PWA, activent les notifs, et ne reçoivent JAMAIS rien.

**Cause** : dependency `web-push` non installée, pas de VAPID keys, pas de helper `sendPushToUser`.

**Correctif** (2h) :

1. `npm install web-push`
2. Générer VAPID keys : `npx web-push generate-vapid-keys`
3. Env vars : `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto:contact@)
4. Créer `src/lib/push.ts` avec `sendPushToUser(userId, {title, body, url})`
5. Câbler dans les hotspots :
   - `book-appointment` route : push au pro à la création RDV
   - `stripe-events` handler deposit paid : push au pro
   - `quote-request` route : idem
   - Handler review reçu (à créer)
6. Frontend `PWARegister.tsx` : demande permission notification + subscribe si accordé
7. Fallback si `web-push` absent → log warning, ne bloque pas (comme pour Sentry Lot 13)

**Impact business** : les artisans installent la PWA pour être notifiés des nouveaux RDV. Sans push, la valeur perçue de la PWA chute à zéro.

---

### B25 — Notifications in-app générées uniquement dans 2 cas / 15

**Symptôme** : seuls `book-appointment` et `quote-request` insèrent des lignes dans `notifications`. Le `NotificationBell` est vide sur 90% des events pertinents.

**Events NON notifiés** :

- Paiement reçu (Stripe webhook)
- Acompte payé / remboursé (F2)
- Avis client reçu
- Invitation équipe acceptée (F5)
- Quota IA / SMS atteint
- Nouveau visiteur pic (analytics)
- Erreur sync Google Calendar (F4)
- Sub qui va expirer (grace period)
- CRM : client à risque (>2 no-show)
- Devis accepté / refusé / expiré
- Cron impayés : rappel envoyé au client

**Correctif** : créer `src/lib/notifications.ts` avec helper unique `createNotification({userId, businessId, type, title, message, data, sendPush?})` et l'appeler dans les 12 hotspots ci-dessus. Bonus : coupler B30 pour push OS + toast dashboard en temps réel via SWR polling ou Server-Sent Events.

---

### B31 — `dashboard/vitrine/page.tsx` fait 80 KB en un seul fichier client

**Symptôme** : le fichier fait 1867 lignes, tout en client component. Résultat sur mobile 4G :

- FCP ~4s
- TTI ~7s
- Bundle JS parsé par le CPU du téléphone

**Correctif** : split en sous-composants lazy-loaded :

- `<VitrineIdentitySection>` (nom, slug, description)
- `<VitrineDesignSection>` (template, colors, images)
- `<VitrineServicesSection>` (services + F2 deposit editor)
- `<VitrinePaymentsSection>` (Stripe, refund policy)
- `<VitrineFaqSection>`
- `<VitrineMenuSection>` (restaurants)

Chaque section un fichier séparé, lazy-loadée via dynamic import selon l'onglet actif. Gain estimé : -60% JS parsé (chaque onglet ne charge que ce qu'il affiche).

**Priorité 2** (bon impact, pas critique) : même refactor sur `settings/page.tsx` (25 KB) et `appointments/page.tsx` (21 KB).

---

## 🟠 Points faibles majeurs (à corriger dans le prochain trimestre)

### 1. Responsive / adaptation

- **Tables non wrappées** : `overflow-x-auto` présent sur admin mais **pas sur** clients/page.tsx (ligne trop large sur iPhone SE)
- **Modals** : pas de mode "bottom sheet" natif mobile (les Modal apparaissent centrés → petits sur mobile). Ajouter variant `size="mobile-sheet"` qui slide up depuis le bas
- **Formulaires denses** : Register/Login OK mais dashboard vitrine → 3 colonnes qui deviennent 1 colonne + scroll infernal sur iPhone
- **Sidebar mobile** : ouvre à 100% width — devrait laisser 20% de la page visible + tap outside pour fermer (à vérifier)
- **Boutons touch target** : plusieurs `<button className="p-1">` = 24×24px. iOS HIG exige 44×44px. Pass à `p-2` minimum sur mobile
- **Zoom form** : `input` sans `font-size: 16px` → iOS zoom automatiquement au focus (agaçant). Ajouter `text-base sm:text-sm`

### 2. Personnalisation vitrine — trop pauvre pour un SaaS Premium

Actuellement :

- 1 seule couleur `primaryColor`
- 7 templates figés côté code (`vitrineTemplates.ts`)
- Font `fontFamily` par template — pas de choix user
- Pas de secondaryColor, pas d'accentColor
- Pas de dark mode custom par pro (le visiteur voit le dark mode selon SA préférence, pas celle du pro)
- Pas de "hero background" custom (juste `coverImage`)
- Pas de sections ordonnables (ordre figé : hero → services → gallery → reviews → contact)
- Pas de blocs custom text/HTML
- Pas de choix de layout (1 col vs 2 col)

**Concurrence** :

- Simplébo permet réordonner sections + choix full colors
- Solocal permet upload full theme
- Wix (généraliste) permet drag&drop complet

**Correctif recommandé** (Lot dédié "Personnalisation v2") :

- Étendre `businesses` avec `secondaryColor`, `accentColor`, `fontFamily`, `sectionOrder` (jsonb), `customCSS` (Premium only, avec sanitizer)
- Nouvelle UI dashboard "Éditeur de vitrine" avec preview live + drag&drop sections
- Palette de fonts curated (10 fonts Google déjà self-hostées, pas d'appel runtime)
- Presets couleurs par métier (plombier = bleu, coiffeur = rose, avocat = bordeaux)

### 3. Emergency phone (bouton Urgence) — pas assez visible

`businesses.emergencyPhone` + `showEmergency` existent mais le bouton, s'il est activé, est perdu dans la vitrine. Or pour un plombier, c'est LE bouton principal.

**Correctif** : si `showEmergency = true`, ajouter un **FAB rouge fixed bottom-right** (mobile) avec numéro pré-composé + optionnel WhatsApp direct. C'est le pattern des apps taxi/dépannage.

### 4. Support bubble empile mal avec CookieConsent

Le commentaire dans `SupportBubble.tsx` dit "bannière consent fait ~140px de haut → on part de bottom-40". Sauf que dès que le consent est fermé, la bulle reste à `bottom-40` = trou visuel de 140px en bas. **Correctif** : recomputer `bottom` selon présence du CookieConsent (context ou event).

### 5. Aucun test des composants React (0 couverture UI)

Coverage 45% mais **exclusivement lib**. `src/components/**` n'a AUCUN test. Un dev qui casse `<Button>` ou `<Modal>` ne s'en rend compte qu'en manuel.

**Correctif** : installer `@testing-library/react` + `happy-dom`, viser 30% couverture composants critiques (Button, Modal, ConfirmDialog, UpgradeGate, CalendarView, TeamManager).

### 6. Pas de mode "offline" pour dashboard sur chantier

Le `sw.js` existe mais ne cache RIEN de dynamique. Un plombier sur chantier sans réseau ouvre le dashboard → écran blanc.

**Correctif** (Lot 30 mobile) : stratégie `stale-while-revalidate` sur GET /api/appointments + cache des 30 derniers RDV via IndexedDB pour lecture offline. Actions offline queued et rejouées à la reconnexion.

### 7. Onboarding après register = trop long / démotivant

Après register, le user tombe sur un dashboard vide avec 8 onglets → paralysie. **Il faut** : wizard 4 étapes en modal fullscreen (nom entreprise → catégorie/métier → adresse → premier service). Ensuite seulement, dashboard. Idéalement : "checklist d'onboarding" en haut du dashboard qui reste visible tant que 100% des étapes ne sont pas faites (nom, adresse, 1 service, 1 photo, publier vitrine, activer Stripe).

Actuellement : `/dashboard/welcome` existe mais je n'ai pas vu de check "onboarding_step" par user.

### 8. Analytics vitrine pas exploitées

`pageVisits` en DB. Aucun dashboard `/dashboard/analytics` qui montre :

- Visiteurs uniques / jour / semaine / mois
- Sources (direct, Google, WhatsApp, QR code)
- Funnel : visite → clic contact → RDV
- Heatmap heures de prise de RDV

C'est prévu Lot 29 mais c'est un bon investissement à court terme (justifie Premium).

---

## 🟢 Améliorations rapides (< 30 min chacune, gros ROI perçu)

| #   | Amélioration                                                                  | Effort | Impact               |
| --- | ----------------------------------------------------------------------------- | ------ | -------------------- |
| A1  | Ajouter `viewport-fit: cover` + safe-area utilities (fix B29)                 | 30 min | ⛔ Critique          |
| A2  | Wrapper tous les `<table>` du dashboard dans `overflow-x-auto`                | 15 min | Mobile OK            |
| A3  | `text-base` sur tous les `<input>` mobile (empêche zoom iOS)                  | 10 min | UX iPhone            |
| A4  | `type="tel"` + `inputMode="numeric"` sur tous les champs téléphone            | 15 min | Clavier mobile natif |
| A5  | `autoComplete` explicite sur register/login (email, given-name, new-password) | 10 min | UX password manager  |
| A6  | Boutons taille min 44×44px sur mobile (touch target Apple HIG)                | 20 min | Accessibilité        |
| A7  | Loading state visible sur TOUS les fetch client (spinner ou skeleton)         | 30 min | Perçu +++            |
| A8  | Toast success à chaque action réussie dashboard (déjà partiel)                | 15 min | Feedback UX          |
| A9  | Copie-clipboard bouton sur URL vitrine + QR code                              | 10 min | Wow-factor           |
| A10 | Confirmation "vraiment supprimer ?" TYPÉE ("SUPPRIMER") sur delete business   | 5 min  | Anti-oups            |
| A11 | Auto-save draft article blog toutes les 30s (localStorage)                    | 20 min | Anti-perte           |
| A12 | Bouton "Voir sur mon site" toujours visible dans le layout dashboard          | 10 min | Vérif rapide         |
| A13 | Empty state "Aucun RDV" avec CTA + illustration (déjà partiel)                | 15 min | UX vide              |
| A14 | Prévisualisation email transactionnel dans les settings (sample)              | 30 min | Confiance            |
| A15 | Message d'erreur clair quand Stripe pas connecté avant activer paiement       | 5 min  | Clarté               |

---

## 🎯 Propositions produit (nouveauté fonctionnelle)

### P1. Éditeur de vitrine WYSIWYG avec preview live (Premium)

**Constat** : la modification actuelle vitrine se fait via formulaire → save → refresh → voir. Frustrant.

**Idée** : split-screen `settings/vitrine` — form à gauche, preview iframe à droite qui update en live via postMessage. Le pro voit son changement en temps réel.

**Impact** : levier Free→Premium fort ("essayez notre éditeur visuel 14j").

### P2. Templates métiers avec presets complets

Aujourd'hui les 7 templates sont génériques (`classique`, `pro-blue`, etc.). Un plombier ne devrait pas voir "pro-blue" mais "Plombier moderne" avec sections adaptées (numéro urgence proéminent, "intervention 24/7", zones intervention géo).

**Idée** : `businesses.category` déjà là → charger un template DÉFAUT selon la catégorie au register, avec sections pré-remplies dummy.

### P3. QR code intelligent avec analytics

Le QR est généré mais pas trackable. Ajout d'un tracker : `/qr/{businessSlug}` redirige vers `/{slug}?src=qr` avec log dans `pageVisits.source = 'qr'`. Le pro voit dans ses analytics combien de clients viennent du QR (carte de visite / camion / vitrine).

### P4. Multi-vitrines pour franchisés

Un pro avec plusieurs points de vente doit pouvoir créer plusieurs `businesses` sous un même owner. Techniquement `getCurrentUserBusinesses()` existe déjà mais l'UI ne le supporte pas (redirect direct sur le premier). Ajouter un switcher business en haut du dashboard.

**Marché** : franchisés (coiffeurs, restauration rapide), c'est 15-20% des artisans.

### P5. Widget vitrine embarquable

Certains pros ont déjà un site (WordPress). Ils veulent afficher "leur bouton réservation Vitrix" chez eux. Générer un `<script src="/embed/{slug}.js">` qui affiche un bouton + iframe modal réservation. Levier acquisition fort — capture des pros qui ne veulent pas migrer.

### P6. Envoi vocal client → transcription IA → RDV créé

Le pro reçoit un WhatsApp vocal "salut peux-tu venir mardi vers 14h pour la fuite". Copier-coller dans un widget dashboard → IA transcrit + propose la création RDV pré-rempli. Le pro clique "Créer". Gain de temps massif sur mobile.

### P7. Signature numérique électronique conforme eIDAS

Actuellement `signatureUrl` existe sur `quotes` mais c'est un dessin PNG — pas légalement opposable. Intégrer Yousign (API gratuite jusqu'à 3 signatures/mois) pour les gros devis. Différenciateur fort BTP.

### P8. Vitrine multi-langues (déjà i18n interne, exposer côté vitrine)

Le dashboard est en 4 langues (fr/en/es/de). La vitrine publique elle est **uniquement dans la langue configurée par le pro**. Pour les zones touristiques (Côte d'Azur, Bordeaux), un visiteur anglais devrait pouvoir voir la vitrine en anglais. Auto-détection via `navigator.language` + switcher visible.

### P9. Réservation via SMS command

Le client texte au pro "RDV 15/08 14h". Réponse auto "Cliquez ici pour confirmer : vitrix.fr/book/xxx". Utile pour clients âgés qui n'utilisent pas Internet. Requiert Twilio-like inbound SMS + parseur date/heure.

### P10. Mode "focus" pour le pro pendant un RDV

Un bouton "Je suis en RDV" dans la topbar → mute les notifs push pendant 1h, message auto-répondeur "Je suis en RDV, je reviens vers vous à Xh". Réactive automatiquement à la fin de l'heure du RDV en cours.

---

## 📱 Adaptation mobile / PWA — checklist manquante

- [ ] `viewport-fit: cover` (B29)
- [ ] safe-area partout (B29)
- [ ] Push notifs réels (B30)
- [ ] Icons maskable Android bien remplis (safe zone 40% centre)
- [ ] Splash screen iOS pour les 5 tailles principales (iPhone 14, SE, Pro Max, iPad, iPad Pro)
- [ ] `apple-touch-icon` en 180×180 (existe)
- [ ] Meta `apple-mobile-web-app-title` = "Vitrix" (à vérifier)
- [ ] Manifest `orientation: any` (actuellement `portrait-primary` = bloque le calendrier semaine en landscape)
- [ ] Manifest `share_target` pour recevoir des partages Android (URL, images) → "Partager avec Vitrix"
- [ ] Manifest `protocol_handlers` pour `web+vitrix://` (deep links)
- [ ] Cache SW stratégie (offline-first sur `/dashboard/today`, `/dashboard/appointments` liste 7j)
- [ ] Background sync pour rejouer les mutations offline à la reco
- [ ] Web Share API sur toutes les cards partageable (vitrine, RDV, devis PDF)
- [ ] `prefers-color-scheme` respecté sur les pages publiques (`/[slug]`)
- [ ] Haptic feedback via `navigator.vibrate` sur success/error (mobile)

---

## 🔔 Notifications — refonte complète recommandée

**État actuel** :

- Table `notifications` OK
- Table `pushSubscriptions` OK
- Route `/api/push/subscribe` OK
- `NotificationBell` UI OK
- **MAIS** : 90% des events pertinents ne créent pas de notif, 100% des push ne partent jamais

**Refonte proposée** (Lot dédié "Notifications v2") :

### 1. Helper unifié

```ts
// src/lib/notifications.ts
export async function notify(params: {
  userId: string;
  businessId?: string;
  type: NotifType; // enum figé
  title: string;
  message: string;
  data?: Record<string, unknown>;
  channels?: ("db" | "push" | "email")[]; // défaut : ["db", "push"]
  priority?: "low" | "normal" | "high"; // high = force push même en mode focus
});
```

### 2. Préférences user

Nouvelle table `notification_preferences(userId, type, channels)` — l'user peut choisir dans les settings quels events il veut en push, email, in-app, ou aucun.

### 3. Grouping / digest

Si 5 RDV créés dans la même minute → 1 seule push "5 nouveaux RDV reçus" au lieu de 5 séparés. Debounce 30s.

### 4. Mode focus / DND

Créneau horaire "je ne veux pas être dérangé de 19h à 8h". Notifs stackées, envoyées en digest à 8h.

### 5. Statut lu / non lu par device

Actuellement `isRead` global. Un pro qui lit sur mobile → l'app dashboard voit "lu". Devrait rester non-lu sur les autres devices jusqu'à consultation explicite.

### 6. Push riche

Actions inline dans la push : "Confirmer RDV", "Répondre", "Reporter" — cliquer déclenche l'action sans ouvrir l'app.

---

## 📊 Récap priorité

| Priorité | Action                                                               | Effort    |
| -------- | -------------------------------------------------------------------- | --------- |
| 🔴 P0    | **Lot Safe-area & mobile fixes** (B29 + B30 + refonte notifs B25)    | 1 jour    |
| 🟠 P1    | **Lot Vitrine refactor** (split B31 + WYSIWYG P1)                    | 2-3 jours |
| 🟠 P1    | **Lot Onboarding wizard** (checklist post-register)                  | 1 jour    |
| 🟢 P2    | **Lot 29 Analytics** (déjà planifié)                                 | 2 jours   |
| 🟢 P2    | **Lot Personnalisation v2** (P2 templates métier + presets couleurs) | 2 jours   |
| 🟢 P3    | **F6 Today view** (déjà planifié)                                    | 1 jour    |
| 🟢 P3    | **Lot 30 PWA finalisée** (push réels + offline + splash)             | 2 jours   |
| 🔵 P4    | Signature eIDAS Yousign (P7)                                         | 1 jour    |
| 🔵 P4    | Widget embarquable (P5)                                              | 1 jour    |
| 🔵 P4    | Multi-vitrines franchisés (P4)                                       | 2 jours   |

---

## ✍️ Ma recommandation

**Prochaine étape** : **Lot "Mobile & notifications v2"** qui règle en un seul commit :

- B29 safe-area + `viewport-fit: cover`
- B30 push notifs réels avec web-push + VAPID + helper `notify()`
- B25 génération de notifs sur les 12 events manquants
- A1-A6 quick wins mobile (touch target, autocomplete, inputMode, text-base)

Ça débloque tout l'écosystème mobile qui est actuellement **cassé en conditions réelles** malgré la PWA "installable".

Ensuite : F6 Today view pour capitaliser sur le mobile enfin utilisable.
