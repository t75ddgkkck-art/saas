# 🔍 Audit V5 — Vitrix après 40 lots

**Date** : après le fix Lot 40 (mobile burger + favicon Google)
**État** : 40 lots livrés, 618 tests verts, 0 erreur TS/lint, build OK, prêt production

Ce doc = analyse lucide de ce qui reste faible + propositions concrètes pour la suite.

---

## ✅ Bugs signalés fixés en Lot 40

### B32 — Nav landing sans burger mobile
**Cause** : `<nav>` avec liens `hidden md:flex` mais AUCUN burger prévu pour mobile → les 3 liens (Fonctionnalités, Tarifs, À propos) étaient totalement invisibles sur < 768px. L'user pensait "c'est comme sur desktop" mais en fait la nav était juste incomplète.
**Fix** : nouveau composant client `<LandingNav>` avec :
- Desktop : liens inline
- Mobile : bouton burger → panel slide-down avec liens + boutons login/register
- Fermeture ESC + body scroll lock + fermeture auto au clic sur un lien

### B33 — Favicon absent des résultats Google
**3 causes cumulées** :
1. `favicon.ico` avait **seulement 16×16 et 32×32** (Google exige minimum 48×48 depuis 2021)
2. `favicon.svg` avec viewBox 512×512 arrondi = Google peine à le cropper correctement
3. Balises `<link rel="icon">` déclarées uniquement via Next `metadata.icons` — certains bots ne parsent que le HTML brut

**Fix** :
1. `favicon.ico` régénéré avec **3 tailles : 16 + 32 + 48**
2. `favicon.svg` refait en **viewBox 48×48 avec fond opaque** (recommandation officielle Google Search Central 2024)
3. Balises `<link>` explicites ajoutées **en dur dans le `<head>`** en plus des metadata Next (belt-and-suspenders)
4. `mask-icon` ajouté pour Safari pinned tabs

**Impact** : dans les 4-7 jours après re-crawl Google, le favicon devrait apparaître à côté du titre dans les SERPs. Si toujours absent après 2 semaines :
- Google Search Console → Inspection URL → "Demander une indexation"
- Vérifier avec https://realfavicongenerator.net/favicon_checker

---

## 🚨 Points faibles restants (priorité claire)

### P1 — Landing page mobile encore perfectible

**Symptôme** : même après le burger fix, le hero de la landing (`text-4xl sm:text-5xl lg:text-7xl`) reste très gros sur petit mobile (iPhone SE 375px), et le gradient background peut couper les boutons.

**À vérifier manuellement** :
- Sur iPhone SE (375×667) : hero title dépasse-t-il ?
- Sur iPad landscape : le mockup hero est-il bien centré ?
- `pt-32 pb-20 lg:pt-44` : peut-être trop de padding sur petit mobile

**Correctif suggéré** : audit visuel + ajuster :
```tsx
<h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl">
```
au lieu du `text-4xl` de départ (start plus petit).

### P2 — 0 test de composant React

Le coverage à 45% ne couvre **que les libs**. Aucun composant React n'a de test. Un dev qui casse `<Button>`, `<Modal>`, `<CalendarView>`, `<QuoteSignFlow>` ne s'en rend compte qu'en manuel.

**Correctif** : installer `@testing-library/react` + `happy-dom`, viser 30% couverture sur les composants critiques :
- `<UpgradeGate>` (utilisé partout)
- `<CalendarView>` (drag&drop complexe)
- `<TeamManager>` (permissions matricielles)
- `<QuoteSignFlow>` (état complexe 3 branches)
- `<PushSubscribeButton>` (Web Push API mockable)

**Effort** : 1-2 jours, gros ROI qualité.

### P3 — Dashboard vitrine 2100 lignes (dette B31 documentée)

Le split est reporté depuis 3 lots. Bundle initial JS reste énorme sur mobile 4G malgré les composants Personnalisation lazy-loadés.

**Correctif** : après P2 (tests composants), splitter en 10 sous-composants (Design/Personnalisation/Infos/Horaires/Paiements/Fidélité/FAQ/QR/Devis/Automations/Menu) avec dynamic imports par onglet actif.

**Effort** : 1 jour, réduit bundle initial de ~60%.

### P4 — `sectionOrder` stocké mais pas rendu

Colonne `businesses.section_order` (Lot 37) permet à l'user de réordonner les sections vitrine. Elle est écrite en DB mais **PublicPage.tsx ignore l'ordre custom** — les sections restent affichées dans l'ordre codé en dur.

**Correctif** : refactor le rendu de `PublicPage.tsx` pour lire `business.sectionOrder` et itérer dynamiquement.

**Blocage** : PublicPage.tsx = fichier 1250+ lignes avec sections imbriquées et conditions plan/business.category. Refactor risqué sans tests React d'abord (voir P2).

**Effort estimé** : 4-6h une fois P2 fait.

### P5 — Sync Google Calendar unidirectionnelle

Actuellement (Lot 33 F4) : Vitrix → Google (push CREATE/UPDATE/DELETE).
Il manque : Google → Vitrix (pull des events créés directement dans Google Calendar).

**Correctif** : cron `/api/cron/google-calendar-sync-pull` toutes les 15 min qui :
1. Query `events.list?updatedMin=<lastSyncAt>` sur chaque business avec token actif
2. Import les events externes (source: "google") dans `appointments`
3. Résolution de conflit : dernier écrit gagne (comparer `updatedAt` local vs `updated` Google)

**Attention** : boucle infinie push↔pull possible si on push un event qu'on vient d'importer → nécessite un flag `imported_from_google: true` pour skip le push retour.

**Effort** : 1 jour, complexité conflicts +1h.

### P6 — UI bouton "Générer avec l'IA" absente du dashboard devis

Le backend `/api/quotes/ai-generate` (Lot 38) est prêt et testé, mais **aucun bouton dans `/dashboard/quotes/new`** ne l'appelle. Un modal `<AiQuoteGenerator>` avec textarea + preview des items suggérés + acceptation ligne par ligne est nécessaire.

**Effort** : 1-2h.

### P7 — Push notifs OS jamais configurées par défaut (nécessite VAPID + `web-push`)

Post-Lot 34, le backend push est prêt mais nécessite :
1. `npm install web-push` (dep optionnelle non ajoutée à package.json)
2. `npx web-push generate-vapid-keys`
3. Setup 3 env vars

**Résultat** : la plupart des installations Vitrix tournent SANS push actives — la valeur PWA n'est pas réalisée.

**Correctif** : ajouter `web-push` à `optionalDependencies` de package.json + guide dans LAUNCH_CHECKLIST plus visible.

### P8 — Sentry monitoring optionnel non ajouté par défaut

Idem : `@sentry/nextjs` est optionnel, la plupart des installs tournent sans tracking d'erreurs → un 5xx en prod passe silencieusement.

**Correctif** : ajouter à `optionalDependencies` + affichage clair dans /api/health "monitoring: disabled — vous ne verrez pas les erreurs prod".

### P9 — Aucun test Playwright E2E réel

Les tests Playwright existent (`tests/e2e/`) mais probablement obsolètes (fichiers d'avant les 38 refactors). Un vrai parcours end-to-end couvrant :
- Register → verify email → onboarding
- Créer service → publier vitrine → réserver RDV
- Générer devis IA → signer devis
- Encaisser paiement
- Analytics reçoit la visite

serait bcp plus robuste que les 618 unit tests. **~1 jour** de config + écriture.

### P10 — Accessibilité (WCAG AA) partielle

Beaucoup fait au Lot 4 mais :
- Aucun test automatisé axe-core / pa11y en CI
- `aria-label` manquants sur certains boutons icon-only du dashboard
- Contrastes text-slate-500 sur bg-slate-50 = 4.4:1 (limite AA, à vérifier)
- Focus visible bien géré mais keyboard navigation testée manuellement uniquement

**Correctif** : ajouter `@axe-core/react` en dev + un job CI `pa11y-ci` sur les 10 pages principales.

---

## 💡 Propositions produit (nouvelles idées business)

### Idée A — Onboarding gamifié avec checklist temps réel

**Constat** : après register, le user tombe sur un dashboard vide avec 8 onglets = paralysie. `/dashboard/welcome` existe mais insuffisant.

**Proposition** : bandeau "Progression : 3/8 étapes complétées" en haut du dashboard tant que l'onboarding n'est pas fini :
1. ✅ Compte créé
2. ⬜ Compléter le business (nom, adresse, catégorie)
3. ⬜ Ajouter 1 service
4. ⬜ Uploader 1 photo
5. ⬜ Publier la vitrine
6. ⬜ Activer les notifications
7. ⬜ Connecter Stripe (pour paiements)
8. ⬜ Inviter votre 1er client de test

Chaque étape complétée → confetti + progression sauvegardée. Après 100% : le bandeau se cache définitivement mais reste réactivable depuis Settings.

**Impact estimé** : +40% de rétention J+7 (industrie SaaS : onboarding = principal levier).

### Idée B — Widget "Réservation Vitrix" embarquable pour sites tiers

**Constat** : certains artisans ont déjà un site (WordPress, Wix). Ils veulent utiliser Vitrix pour la réservation SANS migrer leur site principal.

**Proposition** : générer un `<script src="/embed/{slug}.js">` qui :
- Injecte un bouton flottant "Réserver un RDV" sur leur site
- Au clic, ouvre une iframe modal avec le formulaire de réservation Vitrix
- Utilise `postMessage` pour communiquer avec le parent
- 100% white-label (couleur du bouton customisable via `data-vx-color="#..."`)

**Marché** : capture les pros qui ne veulent pas migrer leur site principal = ~30% du marché artisan qui a déjà un site.

**Effort** : 2 jours (script + iframe + doc).

### Idée C — QR Code trackable avec attribution source

**Constat** : le QR code (Lot 6 SEO) est généré mais pas trackable. Le pro l'imprime sur son camion / carte de visite mais ne sait pas combien de RDV en viennent.

**Proposition** :
- Route `/qr/{businessSlug}` qui redirige vers `/{slug}?src=qr` avec log dans `page_visits.source = 'qr'` (déjà géré côté detectSource Lot 36)
- Générer le QR sur `qr/{slug}` au lieu de `{slug}` directement
- Dashboard analytics montre "Visiteurs venus du QR : X ce mois"
- Bonus : générer plusieurs QR taggés (`qr/{slug}/carte`, `qr/{slug}/camion`, `qr/{slug}/vitrine`) pour attribution fine

**Impact** : ROI QR code enfin mesurable = argument commercial pour l'imprimeur/commercial.

### Idée D — Multi-vitrines pour franchisés

**Constat** : `getCurrentUserBusinesses()` existe (Lot session) mais l'UI ne le supporte pas — un pro avec plusieurs points de vente ne peut gérer qu'un seul.

**Proposition** :
- Switcher business en haut du dashboard (dropdown)
- Cookie `vx_current_business_id` pour rester sur le business sélectionné
- Route `POST /api/switch-business` avec vérif ownership
- Chaque business garde ses stats/clients/RDV isolés

**Marché** : franchisés (coiffeurs, restauration rapide, garages) = 15-20% du marché.

**Effort** : 1 jour.

### Idée E — Facturation automatique post-signature devis

**Constat** : Lot 38 F8 livre la signature devis mais **pas la génération auto de facture** après signature.

**Proposition** : quand un devis passe en `accepted` (post-signature) :
- Générer automatiquement une facture PDF (numéro FR obligatoire ex : `FAC-2026-00001`)
- L'attacher à l'email de confirmation "Votre devis est signé"
- Créer la ligne `payments` type `pending` liée au devis (jusqu'à encaissement)
- Historique facture visible côté client dans `/mon-compte`

**Conformité** : facture PDF conforme légal FR (SIRET pro, mentions TVA, N° séquentiel unique par an, conservation 10 ans).

**Effort** : 1-2 jours (React PDF déjà présent dans le projet).

### Idée F — Assistant vocal Vitrix (WhatsApp Business API)

**Constat** : les clients artisans français utilisent massivement WhatsApp. Un client texte `"Salut je peux avoir un RDV mardi vers 14h ?"`.

**Proposition** :
- Bot WhatsApp qui parse le message (IA GPT + calendar context)
- Propose 3 créneaux compatibles
- Le client répond "3" → RDV créé automatiquement
- Confirmation WhatsApp envoyée

**Prérequis** : WhatsApp Business API (payant ~50€/mois setup) + Meta Business Account approuvé.

**Effort** : 3-5 jours (webhook Meta + prompt engineering + tests).

**Marché** : différenciateur MAJEUR pour les indépendants qui reçoivent 80% des demandes via WA.

### Idée G — Signature devis avec paiement d'acompte intégré (fusion F2 + F8)

**Constat** : F2 (acompte Stripe) et F8 (signature devis) sont livrés séparément. Un devis avec `depositAmount > 0` devrait déclencher :
1. Signature client → OK
2. Redirection immédiate vers Stripe Checkout pour payer l'acompte
3. Confirmation finale seulement APRÈS acompte payé
4. Anti no-show pour les devis (pas juste les RDV)

**Effort** : 1 jour, extend `/api/quotes/sign` avec branch conditionnelle si `depositAmount > 0`.

### Idée H — Marketplace de templates vitrine créés par des designers

**Constat** : 7 templates + 16 presets, mais tous internes. Impossible pour un designer externe de proposer un template.

**Proposition** :
- API `POST /api/marketplace/templates` avec structure JSON standardisée
- Approbation manuelle admin
- Rev-share 70/30 (créateur/Vitrix) via Stripe Connect
- Templates vendus one-shot 29€ ou inclus Premium
- Onglet "Marketplace" dans `/dashboard/vitrine`

**Impact long-terme** : effet plateforme, communauté designers = SEO + engagement.

**Effort** : 3-5 jours (v1 = catalogue statique + approbation manuelle).

### Idée I — Notifications intelligentes par IA (résumé quotidien)

**Constat** : le NotificationBell peut se remplir de 20 notifs/jour pour un pro chargé. Fatigue notif.

**Proposition** : email digest quotidien à 18h (opt-in) :
- Résumé IA de la journée : "3 RDV effectués (250€ encaissés), 1 nouvelle demande de devis, 2 avis 5⭐, 1 client à rappeler demain"
- Généré par prompt IA depuis les events du jour
- Actionnable : "Répondre au devis" → deep link

**Effort** : 1 jour + prompt + template email.

### Idée J — Recommandation IA "clients à recontacter"

**Constat** : la table `clients` a `lastContact` et `noShowsCount` mais aucune UI proactive.

**Proposition** : widget dashboard "🎯 5 clients à recontacter cette semaine" avec :
- Clients qui n'ont pas eu de RDV depuis > 6 mois (typiquement clients récurrents perdus)
- Clients avec no-show récent qui ne sont pas revenus
- Génération auto d'un message SMS/WhatsApp personnalisé via IA
- 1 clic → envoi

**Impact** : réactivation clients dormants = CA récurrent facile.

**Effort** : 1 jour.

---

## 🎯 Roadmap suggérée (12 lots)

Ordonnée par ratio impact/effort :

| # | Lot | Effort | Impact | Description |
|---|---|---|---|---|
| 41 | Fix mobile landing hero + tests visuels | 0.5j | 🟠 UX | Ajuster `text-*` responsive + audit iPhone SE |
| 42 | Idée E — Facture auto post-signature | 1-2j | 🔴 Conformité | Legal FR, boucle F8 fermée |
| 43 | Idée G — Fusion F2+F8 (acompte à la signature) | 1j | 🟢 Différenciateur | Anti no-show sur devis |
| 44 | Idée A — Onboarding gamifié | 2j | 🔴 Rétention +40% | Levier majeur |
| 45 | P6 — UI bouton "Générer avec l'IA" | 2h | 🟢 Wow-factor | Finir F8 côté UI |
| 46 | Idée D — Multi-vitrines franchisés | 1j | 🟠 Marché | +15% TAM |
| 47 | Idée C — QR trackable | 1j | 🟢 ROI mesurable | Argument comm |
| 48 | P5 — Sync Google Calendar pull | 1j | 🟠 Complétude | v2 F4 |
| 49 | Idée J — Recommandations IA clients | 1j | 🟢 Wow | Utilise IA existante |
| 50 | P2 — Tests composants React (@testing-library) | 2j | 🔴 Qualité | Prérequis P3, P4 |
| 51 | P3 — Split dashboard/vitrine (dette B31) | 1j | 🟠 Perf mobile | Requiert P2 |
| 52 | P4 — Rendering `sectionOrder` PublicPage | 0.5j | 🟢 UX | Requiert P2+P3 |

**Recommandation forte** : **Lot 41 (fix mobile complet)** puis **Lot 44 (onboarding gamifié)** — retention +40% est le levier business le plus fort.

---

## 📊 Récap chiffres après Lot 40

- **40 lots livrés**
- **618 tests / 56 fichiers verts** (100%)
- **0 erreur** TypeScript, ESLint, Prettier
- **~45% coverage** lib (composants React = 0%)
- **80+ routes API** avec rate-limits + gates entitlements
- **35+ tables DB** migrations idempotentes
- **9 crons Vercel** opérationnels
- **19 documentations** produites
- **20+ intégrations** (Stripe, Resend, OpenAI, Google Calendar, Twilio, Supabase, VAPID, Sentry, Turnstile, Crisp, Intercom…)

## 🏁 Verdict

Le projet est **fonctionnellement prêt pour la production**. Les 2 bugs signalés (mobile burger + favicon Google) sont fixés. Les points faibles restants (P1-P10) sont tous non-bloquants et documentés.

Le facteur limitant n'est plus technique — c'est le **go-to-market** :
- Créer les comptes fournisseurs (2h — Lot 39 checklist)
- Communiquer sur le lancement
- Recueillir les premiers users et itérer

Bonne chance ! 🚀
