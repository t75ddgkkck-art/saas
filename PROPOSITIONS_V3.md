# 🧭 Vitrix — Analyse projet & propositions v3

**Date** : 10/07/2026 — après Lot 28
**État actuel** : 28 lots livrés, 312 tests verts, build OK, sécurité durcie, i18n, RGPD, Stripe complet, CRM, vitrine boostée.
**Ce doc** : audit lucide de ce qu'il manque **pour transformer Vitrix en SaaS "fini"** — côté pro comme côté client final — et roadmap priorisée.

---

## 1. Ce qui est déjà solide (à ne pas retoucher)

| Domaine                                                | État          | Note        |
| ------------------------------------------------------ | ------------- | ----------- |
| Auth (login, reset, verify, captcha, brute-force)      | ✅ Complet    | Lot 19 + 26 |
| Sécurité (CSP, headers, uploads, rate-limit)           | ✅ Durci      | Lot 26      |
| Stripe (webhooks, trial, grace, portal)                | ✅ Prod-ready | Lot 11      |
| CRM (import/export, doublons, no-show, relances)       | ✅ Complet    | Lot 24      |
| Vitrine publique (lightbox, map OSM, vidéos, avis)     | ✅ Complet    | Lot 23      |
| Legal/RGPD (CGU, DPA, consent, export, purge)          | ✅ Conforme   | Lot 15      |
| Emails (queue, DKIM, unsubscribe, budget SMS)          | ✅ Solide     | Lot 9       |
| DB (soft delete, triggers, index, partitionnement doc) | ✅ Solide     | Lot 14      |
| i18n (dict complet, emails, détection auto)            | ✅ Solide     | Lot 8       |
| DevEx (prettier, husky, design system)                 | ✅            | Lot 28      |

**Conclusion** : le socle technique est déjà supérieur à 80% des SaaS français concurrents (Simplébo, ProwebCE, Solocal). **Le gap n'est plus technique, il est produit et différenciation.**

---

## 2. Bugs / points faibles latents découverts

### 2.1 Architecture — dette masquée

- **B21 — Feature-gating éparpillé** : 15+ fichiers font `plan === "premium"` inline. Rien ne garantit qu'un utilisateur Free ne peut pas frapper `POST /api/loyalty` directement (à vérifier route par route). → **Bloquant sécurité économique**.
  - Solution : `src/lib/entitlements.ts` avec `canUse(user, "feature.loyalty")`, matrice unique, guard middleware `requireEntitlement()` pour les routes API.
- **B22 — Quotas mensuels non exposés au user** : Lot 10 a mis quotas IA. Mais aucune UI "il vous reste X requêtes ce mois". → frustration silencieuse quand ça bloque.
- **B23 — Pas de state machine claire sur les statuts** : `appointment.status` (draft/pending/confirmed/completed/no_show/canceled) : les transitions valides ne sont pas centralisées → risque d'incohérence (ex : passer de `canceled` à `confirmed`).
- **B24 — Pas de trail d'audit user-facing** : `admin_events` existe mais côté user pro, aucune trace "qui a modifié ce devis, quand". Problème dès qu'il y a un `team_members`.
- **B25 — Notifications** : la table existe, `NotificationBell` existe, mais **aucune génération automatique cohérente** de notifs (nouveau RDV, paiement reçu, avis reçu, quota atteint…). Vérifier route par route.
- **B26 — Pas de recherche full-text sur clients** : `/api/search` ne cible que businesses + blog. Un pro avec 500 clients ne peut pas chercher par nom/tel.
- **B27 — Pas de dedup des webhooks Stripe** : idempotence par `event.id` non vérifiée → si Stripe rejoue, double effet possible (grâce à `subscriptions` upsert probablement OK, mais paiements manuels → risque).
- **B28 — Timezone client vitrine** : les créneaux public sont affichés en TZ serveur, pas en TZ visiteur. Pour un pro qui prend des RDV internationaux (rare mais…), c'est cassé.

### 2.2 UX pro — ce qui manque à un artisan/indépendant réel

- **Aucun mode "kiosque"** : un artisan a 5 min sur chantier, il veut voir ses RDV du jour en 1 tap. Le dashboard actuel demande 3 clics.
- **Aucune vue calendrier semaine/mois** : liste seulement. Un plombier avec 15 RDV/semaine veut voir sa semaine.
- **Aucun "aujourd'hui" comme page par défaut** : le dashboard atterrit sur des KPIs, pas sur l'action.
- **Pas de gestion multi-utilisateurs UI** : `team_members` existe en DB, mais aucun onglet "Équipe" pour inviter un collègue.
- **Pas de rôles/permissions UI** : owner/admin/employee/viewer devrait exister.
- **Pas d'assignation de RDV/devis** : "ce chantier → Jean, celui-là → Marie".
- **Pas de mode offline sur mobile** : Lot 30 prévu mais un pro sur chantier sans réseau, aujourd'hui c'est fenêtre blanche.

### 2.3 UX client final — ce qui manque au visiteur de la vitrine

- **Pas de "rappel-moi"** : si tous les créneaux sont pris, le client repart. Il devrait pouvoir dire "prévenez-moi si un créneau se libère cette semaine".
- **Pas de comptes clients** : chaque prise de RDV = re-saisir nom/tel/mail. Un compte léger (magic link) = fidélisation.
- **Pas d'espace client** : voir ses futurs RDV, télécharger ses devis/factures, laisser un avis en 1 clic post-RDV.
- **Pas de deposit/acompte à la réservation** : Stripe est là mais on ne peut pas dire "20 € d'acompte pour réserver ce créneau" → anti no-show puissant.
- **Pas de "confirmer votre venue" 24h avant** par SMS/email → réduit les no-show de 30-40% (chiffre industrie).
- **Formulaires de devis pas assez smart** : pas de conditionnalité "si vous cochez X, montrez champ Y".
- **Pas de recommandation Google Business Profile intégrée** : Lot 16 a fait référral, mais post-RDV le client devrait recevoir un lien direct pour laisser un avis Google (pas juste avis interne).

---

## 3. Propositions — 10 fonctionnalités à haute valeur

### Priorité 1 — Bloquant pour un SaaS "vendable"

#### 🎯 F1. Entitlements centralisés + upsell in-app

**Problème** : gating dispersé, aucun message clair "cette fonctionnalité nécessite Premium".
**Solution** :

- `src/lib/entitlements.ts` — matrice unique `{feature: PlanId[]}`
- Hook `useEntitlement("loyalty")` → renvoie `{allowed, requiredPlan, upgradeUrl}`
- Composant `<UpgradeGate feature="ai_chat">...</UpgradeGate>` qui remplace le contenu par un CTA "Passez Premium 14j gratuit"
- Guard API `requireEntitlement(req, "loyalty")` → 402 Payment Required avec plan requis
- Tests : matrice figée dans un snapshot
  **Impact business** : conversion Free→Pro estimée +15-25% (moment de friction = moment de conversion).

#### 🎯 F2. Acompte à la réservation (deposit)

**Problème** : no-show = 15-30% chez les artisans. Un acompte non-remboursable élimine 80% des no-show.
**Solution** :

- Champ `services.deposit_amount_cents` + `services.deposit_type` ('fixed' | 'percent')
- Au flow `book-appointment`, si deposit>0 → Stripe Checkout AVANT confirmation du créneau
- Webhook `checkout.session.completed` → confirme le RDV
- Session Stripe expire en 15 min → libère créneau si non payé
- Politique remboursement configurable ("remboursable si annulé 48h avant")
- UI dashboard : rapport "acomptes encaissés ce mois"
  **Impact business** : différenciateur MAJEUR vs concurrents français. Argument de vente Pro/Premium.

#### 🎯 F3. Espace client final + magic-link auth

**Problème** : le client final n'a AUCUN compte, tout est éphémère.
**Solution** :

- Nouveau layout `/mon-compte` (public — pas dashboard pro)
- Auth par magic-link (déjà en DB `auth_token_type: magic_link`, jamais utilisé)
- Vues : mes RDV, mes devis, mes factures, mes documents, laisser un avis
- Bouton "annuler mon RDV" (dans limite politique configurable)
- Bouton "reprogrammer" — ouvre calendrier
- Notifications email au client à chaque event (rappel, changement, annulation)
- Widget "recommander ce pro" avec code parrain client → cashback (F7)
  **Impact business** : rétention client final → RDV récurrents → argument fort côté pro.

### Priorité 2 — Différenciateurs marché

#### 🎯 F4. Calendrier vue semaine/mois + drag&drop

**Problème** : liste seulement, inutilisable au-delà de 20 RDV.
**Solution** :

- Utiliser `@fullcalendar/react` OU maison léger (grid CSS + heures)
- Vues : jour / semaine / mois / liste
- Drag & drop pour reprogrammer (PATCH `/api/appointments/[id]`)
- Codes couleur par type de service
- Bloc "indisponibilité" (déjeuner, congés, chantier long)
- Sync bidirectionnel Google Calendar (google API déjà là via Lot Google)
- Sync CalDAV pour Apple/Outlook
  **Impact business** : critère bloquant pour tout artisan avec agenda chargé (électricien, kiné, coiffeur).

#### 🎯 F5. Équipe & rôles (multi-user par business)

**Problème** : `team_members` en DB, aucune UI.
**Solution** :

- Onglet "Équipe" dans settings
- Rôles : `owner` / `admin` / `employee` / `viewer`
- Invitation par email avec magic link (24h TTL)
- Matrice permissions : voir, éditer, supprimer, facturer, gérer équipe
- Assignation RDV/devis à un membre → filtres calendrier
- Journal d'audit user-facing "qui a fait quoi" (7j pour Pro, 90j pour Premium)
- Plan tarifaire : Pro = 2 sièges max, Premium = 5, +10€/mois par siège supp
  **Impact business** : ouvre le marché des TPE 2-10 personnes (vs solo aujourd'hui).

#### 🎯 F6. Mode "aujourd'hui" (Today view)

**Problème** : dashboard trop dense pour usage mobile terrain.
**Solution** :

- Page `/dashboard/today` = première page par défaut sur mobile
- Timeline chrono des RDV du jour (avec adresse, tel, GPS deep-link)
- Boutons rapides : "En route", "Arrivé", "Terminé", "Encaisser"
- Widget météo pour extérieur (optionnel, API free open-meteo)
- Bouton "générer facture depuis ce RDV" (1 clic)
- Notes vocales (Web Speech API) → transcription automatique
  **Impact business** : usage quotidien = habitude = rétention.

#### 🎯 F7. Programme de parrainage CLIENT (pas juste pro)

**Problème** : Lot 16 a fait parrainage pro→pro. Rien pour client→client.
**Solution** :

- Chaque client final (via F3) a un code perso
- "Recommandez [Nom du pro] à un ami → 10% sur votre prochain RDV" (config par le pro)
- Le pro paramètre récompense parrain / filleul dans dashboard
- Tracking : `referrals` avec status (pending, converted, rewarded)
- Bonus loyaltyPoints (table existe déjà) au parrain à la conversion
- Plan : Premium uniquement
  **Impact business** : croissance virale intégrée = argument Premium ×3.

### Priorité 3 — Nice-to-have puissants

#### 🎯 F8. Générateur de devis avec IA + PDF signable

**Problème** : devis actuels = manuel. Un pro perd 30 min par devis.
**Solution** :

- Prompt IA : "Devis pour rénovation salle de bain 6m², carrelage, WC, douche italienne"
- IA propose lignes typiques (main-d'œuvre, matériaux) avec prix médians métier
- Le pro ajuste, envoie
- Signature électronique légale (déjà B15/Lot 18 en cours) → hash + IP + timestamp + email confirm
- Génération PDF via `@react-pdf/renderer` (déjà installé ?)
- Relance auto J+3 / J+7 si non signé
- Conversion automatique en facture après signature
  **Impact business** : gain de temps mesurable = argument commercial fort.

#### 🎯 F9. Analytics visuelles + funnel de conversion vitrine

**Problème** : Lot 29 prévu. Actuellement : `pageVisits` en DB, pas exploité.
**Solution** :

- Dashboard `/dashboard/analytics` :
  - Visiteurs uniques / jour / semaine / mois
  - Sources (direct, Google, Facebook, WhatsApp, QR code)
  - Funnel : visite → clic contact → RDV créé → RDV confirmé → payé
  - Taux conversion par service
  - Heatmap heure/jour de prise de RDV
  - Comparaison vs mois précédent
- Plausible embed OU maison (privacy-friendly, RGPD OK sans cookie)
- Export PDF mensuel automatique par email (Premium)
  **Impact business** : justifie le prix Premium (mesurer ROI).

#### 🎯 F10. Marketplace de templates + thèmes payants

**Problème** : 4 templates Pro, 7 Premium. Chacun se ressemble.
**Solution** :

- Ouvrir aux designers externes (revshare 70/30)
- Templates "métier" (plombier, coiffeur, avocat, coach, restaurant) avec sections spé
- Editor visuel drag&drop (v1 : sections activables, v2 : full builder)
- One-shot 29€ ou inclus Premium
  **Impact business** : long terme, effet plateforme. À prévoir pour v2.

---

## 4. Chantiers techniques restants (les 3 lots planifiés)

### Lot 27 — CI/CD GitHub Actions (recommandé PROCHAIN)

- Workflow `.github/workflows/ci.yml` : typecheck + lint + format:check + vitest + build + audit
- Coverage vitest avec seuil 70%
- Contract tests API (schéma réponse figé)
- Preview deployment Vercel par PR
- Dependabot config
- Badge README

### Lot 29 — Analytics & croissance

- Voir F9 ci-dessus
- - Emails de réactivation user inactif (J+7 / J+30 sans login)
- - A/B testing simple (feature flag % rollout)

### Lot 30 — Mobile/PWA finalisée

- Push notifs Web Push API (VAPID)
- Service worker offline stratégique (cache dashboard read-only)
- Décision : app Expo native OU PWA only ? → recommande **PWA d'abord** (0 coût store, iOS 16.4+ push OK)
- Icônes + splash + install prompt

---

## 5. Roadmap proposée (12 tours restants)

| Tour | Lot                                        | Priorité            | Impact              |
| ---- | ------------------------------------------ | ------------------- | ------------------- |
| 24   | **Lot 27** CI/CD                           | 🔴 Bloquant qualité | Attrape régressions |
| 25   | **Lot 29** Analytics + réactivation        | 🟠 Croissance       | +MRR                |
| 26   | **F1** Entitlements centralisés            | 🔴 Bloquant sécu    | +conversion         |
| 27   | **F2** Acompte réservation                 | 🟢 Différenciateur  | +USP                |
| 28   | **F3** Espace client + magic link          | 🟢 Rétention        | +NPS                |
| 29   | **F4** Calendrier vues + Google sync       | 🟠 UX pro           | +rétention          |
| 30   | **F5** Équipe & rôles                      | 🟠 Marché TPE       | +ARPU               |
| 31   | **F6** Today view mobile-first             | 🟠 UX pro           | +DAU                |
| 32   | **Lot 30** PWA + push                      | 🟢 Mobile           | +rétention mobile   |
| 33   | **F8** Devis IA + signature                | 🟢 Wow-factor       | +Pro                |
| 34   | **F7** Parrainage client                   | 🟢 Viralité         | +CAC efficient      |
| 35   | Polish + landing v2 + onboarding checklist | Final               | Lancement           |

---

## 6. Métriques cibles avant lancement public

- ✅ 0 erreur TS, 0 test rouge, build OK
- ✅ Lighthouse mobile > 90 sur home + vitrine
- ✅ TTFB < 200ms sur pages ISR
- ⚠️ Couverture tests > 70% (actuellement estimée ~60% côté lib, 0% côté React composants)
- ⚠️ Playwright E2E : parcours "register → onboarding → publier vitrine → RDV" en < 2 min
- ⚠️ Test de charge : 100 RDV créés/min sans erreur (k6 ou Artillery)
- ⚠️ Audit sécu externe (ex : Detectify gratuit) : 0 High/Critical
- ⚠️ RGPD : DPO externe validé, mentions à jour, DPA signable
- ⚠️ Contrat Stripe activé (KYB fait)
- ⚠️ Domaine + SSL + email transactionnel warm-up (Resend)

---

## 7. Idées business post-MVP

- **Marketplace lead** : Vitrix redirige des recherches "plombier Argentré 53" vers les pros abonnés (com 15%)
- **Score Vitrix** : badge public "Pro vérifié Vitrix" (SIRET + avis > 4.5 + assurance déclarée) — payant 5€/mois
- **Assurance intégrée** : partenariat courtier (Hiscox, Simplis) → commission 10-20% sur MRR client
- **Financement travaux** : intégration Alma/Younited pour "payer en 4x sans frais" côté client final → commission
- **Comptabilité** : export Sage/Cegid/QuickBooks + intégration Pennylane (partenaire tech)
- **Support téléphone virtuel** : ligne Vitrix qui redirige/enregistre + résumé IA (Premium+)

---

## 8. Décision demandée

Trois angles possibles pour la suite :

1. **Angle qualité** → Lot 27 (CI/CD) puis Lot 29 (analytics) : durcir avant d'ajouter des features.
2. **Angle conversion** → F1 (entitlements) + F2 (deposit) : maximiser le MRR sur la base actuelle.
3. **Angle produit** → F3 (espace client) + F4 (calendrier) : élargir la surface produit avant de vendre.

**Recommandation** : **angle 1 puis 2**. Sans CI, chaque lot risque de casser silencieusement le précédent. Sans entitlements clean, chaque feature ajoutée est une fuite de valeur.

Quel angle / lot on lance ?
