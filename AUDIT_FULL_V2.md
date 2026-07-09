# 🔬 Audit complet du projet Vitrix — Tous aspects

> Analyse exhaustive du 09/07/2026 — 186 fichiers, 62 routes API, 26 pages, 30+ tables DB, 4 écrans mobile.
> Ce document liste **tous les points faibles restants** classés par lots, du plus critique au plus cosmétique.
> Les corrections déjà appliquées lors des tours précédents sont indiquées ✅.

Le rapport initial (`AUDIT_REPORT.md`) couvrait la sécurité. Ici on va **partout ailleurs**.

---

## 🔴 LOT 1 — SÉCURITÉ & DONNÉES (encore à corriger)

### 1.1 Cookie `localStorage` "auth_user" dans login/register
`src/app/login/page.tsx:31` et `src/app/register/page.tsx` stockent l'utilisateur dans `localStorage.setItem("auth_user", …)`. C'est **exactement la même faille** que le cookie non-httpOnly que j'ai supprimée : le rôle et le plan y sont manipulables par le client.
→ **À supprimer** : le `AuthContext` hydrate déjà via `/api/auth/session`.

### 1.2 Zod absent sur ~55 routes API
Seules `login`, `register`, `blog/[id]`, `quote-request` valident avec Zod. Les 55+ autres routes prennent le body brut → validation manuelle incomplète ou absente. Exemples critiques :
- `POST /api/clients` (pas d'unicité en cas d'email vide)
- `POST /api/appointments/complete` (`appointmentId` any)
- `POST /api/team` (pas de vérif plan Premium avant insert)
- Tout `/api/schedule/*`, `/api/services`, `/api/my-business`, `/api/loyalty`

### 1.3 IDOR potentiels non corrigés
J'ai fixé les blog. À vérifier / auditer :
- `PUT /api/quote-form-fields` (par ownership du business ?)
- `PUT /api/my-availability`
- `POST /api/appointments/complete` (vérif OK) mais autres endpoints appointments ?
- `POST/DELETE /api/team` — pas vu de vérif business owner
- `PUT /api/loyalty` — quel scope ?

### 1.4 Uploads : QR code, images vitrine, logo, cover
Le storage `src/lib/storage.ts` a été créé pour `/api/quote-request` mais **pas branché** sur :
- Upload de logo / cover / profile image de la vitrine (`/api/my-business`)
- Upload dans la galerie (`/api/gallery` si présent)
- Signatures électroniques de devis (`quotes.signature_url` → probablement base64)

### 1.5 Pas de CSRF sur mutations
Les routes `POST/PUT/DELETE` sont uniquement protégées par le cookie httpOnly + `SameSite=lax`. Suffisant pour la majorité mais **insuffisant** si vous exposez des sous-domaines ou si une page publique fait un POST cross-origin. → Ajouter un header `X-Requested-With` obligatoire ou un token CSRF dans les mutations sensibles.

### 1.6 Rate limit uniquement sur login/register/quote-request
Toutes les autres routes exposées publiquement sont vulnérables :
- `/api/ai-chat` (coût OpenAI !)
- `/api/book-appointment`
- `/api/verify-siret` (coût INSEE)
- `/api/qr-code`
- `/api/track` (peut spammer les analytics)

### 1.7 Fuite d'info sur `/api/verify-siret`
Répondre "SIRET valide + nom + adresse INSEE" permet de scraper l'INSEE via votre serveur (gratuit, sans quota). → Rate-limiter agressivement + logger.

### 1.8 Aucune RLS Supabase
Vous êtes sur Supabase — le fait d'avoir un middleware côté Next ne protège **pas** un accès direct à la DB via l'anon key si un jour vous exposez ça. → Activer RLS (Row Level Security) sur toutes les tables sensibles, en **défense en profondeur**.

### 1.9 Signature électronique des devis
Il y a `signature_url` en DB et `SignaturePad.tsx` en composant. Sans vérification côté serveur (hash, horodatage certifié, IP client…), une "signature" est trivialement forgeable. → Pour de la vraie valeur juridique il faut du eIDAS.

### 1.10 `expo-notifications` mobile : token push jamais envoyé au serveur
`mobile/App.tsx:43` : `// await fetch("/api/push/register", …)` est commenté. La stack push mobile est **non-fonctionnelle**.

---

## 🟠 LOT 2 — CODE MORT, DUPLICATIONS, DETTE TECHNIQUE

### 2.1 Code mort
- `src/lib/auth.ts` : encore une **fonction `hashPassword` + `verifyPassword`** utilisée, mais tout le reste avait été retiré. OK.
- `src/lib/ai-content.ts` : plusieurs fonctions non utilisées (à vérifier ce qui est appelé depuis `/api/ai/*`).
- `src/lib/blog-generator.ts` + `blog-templates.ts` + `page-templates.ts` + `vitrine-templates.ts` : **4 fichiers** de templates. Duplication probable.
- `src/lib/pdf-generator.ts` + `generate-pdf.ts` + `invoice.ts` : **3 générateurs PDF** ! À unifier.
- `booking-configs.ts` + `quote-configs.ts` : hardcodés, jamais éditables par l'user.

### 2.2 165 `any` restants dans le code
`strict: true` est activé mais bypassé. Les plus critiques :
- `catch (error: any)` dans presque toutes les routes → réponse d'erreur non typée
- `body as any` dans les form handlers du dashboard
- Props `data: any` dans `NotificationBell`, `GlobalSearch`

### 2.3 Composants dupliqués Mobile / Desktop
`src/components/ui/Button.tsx` vs `MobileButton.tsx`
`src/components/ui/Input.tsx` vs `MobileInput.tsx`
`src/components/ui/Modal.tsx` vs `MobileModal.tsx`
→ Tailwind gère très bien le responsive avec `md:` : cette duplication n'a pas lieu d'être.

### 2.4 63 `console.log/error` bruts (avant mon refactor 3 restent)
Doivent tous passer par `logger.info/error` avec contexte structuré.

### 2.5 `PublicPage.tsx` = 944 lignes
Composant monolithique impossible à maintenir. À découper en :
- `<PublicHeader />` (nav, boutons contact)
- `<PublicHero />` (cover + description)
- `<PublicServices />`
- `<PublicSchedule />`
- `<PublicGallery />`
- `<PublicReviews />`
- `<PublicFAQ />`
- `<PublicContact />` (map + horaires)
- `<PublicFooter />`

### 2.6 `dashboard/vitrine/page.tsx` = 1085 lignes
Idem, gigantesque form monolithique. À découper.

### 2.7 `dashboard/outils/page.tsx` = 476 lignes
Fourre-tout d'outils IA, à séparer par onglet ou par sous-page.

### 2.8 Fichier `src/app/sw.js` en plus de `public/sw.js`
Duplication du service worker → risque de servir la mauvaise version.

### 2.9 Types de DB pas exportés
`type User = typeof users.$inferSelect;` n'existe nulle part → chaque page redéfinit son propre type client `PublicPageProps.business` (60+ champs à la main dans `PublicPage.tsx`). Explosion de la surface de maintenance.

### 2.10 Le dossier `mobile/` : projet à part sans lien réel
`mobile/App.tsx` référence des screens qui font tous des `fetch` vers `http://localhost:3000` en dur. Non déployable en l'état.

---

## 🎨 LOT 3 — UI/UX & DESIGN VITRINE (côté client public)

### 3.1 Pas de mode sombre pilotable
Les classes `dark:` sont partout mais **aucun toggle**, `<html>` reste toujours en clair. Le CSS `.dark ::-webkit-scrollbar` est mort.

### 3.2 Vitrine : logo par défaut = emoji 🏪
Peu professionnel pour un SaaS. Remplacer par un placeholder texte ou un pattern (initiales du business).

### 3.3 Pas de skeleton loaders
Toutes les listes (RDV, clients, devis, avis) affichent un texte "Chargement…" ou rien. Effet vide, perçu comme lent.

### 3.4 Pas de `loading.tsx` / `error.tsx` / `not-found.tsx` globaux
Next.js les attend en App Router. Sans eux :
- Pas de fallback pendant les Server Components
- Un throw = page blanche brutale
- `/toto` inexistant = page vide au lieu d'un beau 404 branded

### 3.5 Pas de toast/notification UI globale
Les erreurs API sont juste `setError(msg)` dans chaque page. Pas de système `<Toast />` réutilisable → UX de retour incohérente.

### 3.6 Boutons "contact" vitrine : téléphone/email/WhatsApp
- Pas de tracking (analytique clic)
- Pas de vérif de format téléphone → risque `tel:null`
- WhatsApp toujours en mode "web.whatsapp.com" au lieu du deep link mobile natif

### 3.7 Pas de vraies photos par défaut
`public/og-image.svg` est un placeholder texte, pas une vraie image → SEO Facebook/Twitter dégradé.

### 3.8 Formulaire de RDV : pas de fuseau horaire
`startTime`, `endTime` en `varchar(5)` "HH:MM" **sans TZ**. Un pro à la Réunion aura des soucis, un client à l'étranger réservera au mauvais moment.

### 3.9 Aucune preview / mockup dans le dashboard
Éditer la vitrine sans voir le rendu → l'utilisateur doit ouvrir un onglet à part. Il faut au minimum un iframe live-preview.

### 3.10 Pricing (`PricingSection.tsx`) : pas de switch mensuel/annuel
Standard SaaS, générateur de conversion. À ajouter avec -20% annuel.

### 3.11 Pas d'onboarding après register
Après l'inscription, l'user est envoyé sur `/dashboard` **vide** (0 client, 0 RDV, 0 photo). Pas de wizard "Complétez votre vitrine en 3 min".

### 3.12 Palette et cohérence
- `primary_color` par défaut `#0f172a` (slate-900) : sombre et **peu chaleureux** pour un artisan. Bleu/vert plus engageant.
- Aucune restriction ni preview de la couleur choisie par le pro → risques de vitrines illisibles.

---

## ♿ LOT 4 — ACCESSIBILITÉ (WCAG)

### 4.1 UNE SEULE occurrence d'attribut ARIA dans tout le projet
Concrètement : lecteurs d'écran cassés partout. Boutons sans label, images sans `alt`, modals sans focus trap, etc.

### 4.2 Icônes seules sans label
Le bouton hamburger de la sidebar, la bell des notifications, les boutons icon-only n'ont **aucun** `aria-label`.

### 4.3 Contrastes non vérifiés
Nombreux `text-slate-400 dark:text-slate-500` sur fond blanc/sombre à la limite du WCAG AA (4.5:1).

### 4.4 Focus visible personnalisé insuffisant
`focus-visible:ring-2` sur les boutons mais pas sur les liens ni les inputs custom. Navigation clavier compliquée.

### 4.5 Modals non-accessibles
`src/components/ui/Modal.tsx` : à vérifier qu'il piège le focus, se ferme sur Escape, restaure le focus au parent.

### 4.6 Pas de "skip to content"
Navigation clavier oblige à faire tab sur toute la nav avant d'atteindre le contenu.

### 4.7 Langue déclarée
`<html lang="fr">` en dur → si l'utilisateur choisit anglais/espagnol, l'HTML dit toujours "fr". Impact sur SEO + lecteurs d'écran.

---

## 🚀 LOT 5 — PERFORMANCE

### 5.1 Toutes les pages vitrine sont `force-dynamic`
Aucune ne bénéficie de l'ISR/SSG. Chaque visite = hit DB.
→ Devrait être `revalidate = 300` pour `/[slug]`, `/annuaire`, `/ville/[city]` (5min).
→ `generateStaticParams` pour pré-générer les vitrines populaires.

### 5.2 Requêtes N+1 dans les pages listant plusieurs businesses
`/annuaire`, `/ville/[city]`, `/metier/[category]` font `.innerJoin(users)` mais si vous ajoutez un COUNT reviews/services/… ce sera N+1.

### 5.3 Aucun index DB
Le schéma Drizzle **n'a aucun `index()`** déclaré. J'ai fourni les 23 index nécessaires dans `sql/00_apply_safe.sql`, mais il faut aussi les ajouter au schéma pour les futures DB fraîches. Sans ces index :
- `businesses.slug` lookup = seq scan sur toute la table à chaque hit vitrine
- `clients.businessId + phone` = seq scan
- Cron `quotes.status='sent' AND updated_at < 7j` = seq scan

### 5.4 `/api/dashboard` : probablement N+1
À auditer : cette route agrège probablement CA, nb RDV, nb clients, avis moyens → doit être une seule requête SQL avec agrégats.

### 5.5 Images non optimisées
Aucun usage de `next/image` détecté dans la vitrine. Cover 4K servi tel quel → LCP catastrophique.

### 5.6 Bundle Lucide-react
`lucide-react ^1.23.0` — version très ancienne, tree-shaking imparfait. Sur `dashboard/vitrine` il y a 30+ icônes importées → gros bundle.

### 5.7 Client Components partout
90% des pages sont `"use client"`. Beaucoup pourraient être Server Components (login/register aussi peuvent avoir la partie statique en SC).

### 5.8 Pas de préchargement fonts
`Inter` déclaré en CSS `@theme` mais **jamais chargé** via `next/font/google`. Fallback système → FOUT.

### 5.9 Service Worker minimaliste
`public/sw.js` cache 2 icônes + `/dashboard`. Pas d'offline réel, pas de background sync, pas de stratégie cache-first pour les assets. Le worker `src/app/sw.js` en doublon peut écraser.

### 5.10 Pas de compression Brotli/Gzip forcée
`next.config.ts` a `compress: true` mais Vercel gère mieux via Edge. OK.

---

## 📈 LOT 6 — SEO

### 6.1 `sitemap.xml` ne liste QUE les vitrines
Manquent : `/blog`, `/annuaire`, `/metier/[category]`, `/ville/[city]`, `/a-propos`, `/faq`, `/cgu`, `/confidentialite`, tous les articles de blog `/{slug}/blog/{post}`.

### 6.2 `sitemap.xml` peut exploser
Si vous avez 10 000 businesses → 10 000 URLs dans un seul fichier. Google limite à 50k, mais performance côté crawl chute. Solution : `sitemap-index.xml`.

### 6.3 Meta descriptions générées vitrine
Aucune vérification longueur (max 160 chars), aucune personnalisation par catégorie.

### 6.4 Pas de balises `hreflang`
Les vitrines multi-langues (`fr`, `en`, `es`, `de`) devraient déclarer les alternates dans `<head>`.

### 6.5 URLs françaises mais slugs normalisés
`/plombier-a-paris-x9k2` — le suffixe `-x9k2` (anti-collision) est laid pour l'SEO. Utiliser un slug unique via un compteur ou un ID + slug pretty.

### 6.6 Pas de rich snippet Reviews / LocalBusiness sur vitrine
`StructuredData.tsx` existe mais ne semble pas contenir `AggregateRating`, `OpeningHoursSpecification`, `PostalAddress` structurés Google.

### 6.7 Robots.txt trop restrictif
`Disallow: /register` empêche Google d'indexer votre page d'inscription — anti-conversion.

### 6.8 Pas d'`og:image` dynamique par vitrine
Toutes les vitrines partagent la même OG image `og-image.svg`. Perte massive de partages sociaux.

---

## 📱 LOT 7 — MOBILE / PWA

### 7.1 Projet Expo mobile non-fonctionnel
- Push non branché au serveur
- Fetch en dur sur `localhost:3000`
- Pas d'auth persistée
- 4 screens seulement (Dashboard, Appointments, Quotes, Clients) — pas de vitrine, pas de settings
- Expo 50 = très ancien (actuel : 52+)
- **Décider** : garder + finir, ou supprimer (la PWA suffit pour ce besoin).

### 7.2 PWA : pas de bannière iOS "Ajouter à l'écran d'accueil"
Le composant `PWAInstallBanner.tsx` gère Chrome/Android mais iOS Safari nécessite un mode custom (les prompts natifs n'existent pas).

### 7.3 Manifest : shortcut icons pointent sur 192 (petit)
Devraient utiliser une icône dédiée par shortcut.

### 7.4 Push notifications web : à peine ébauchées
`/api/push/subscribe` existe mais aucune UI pour opt-in ni envoi côté serveur.

---

## 🌍 LOT 8 — I18N / MULTILINGUE

### 8.1 Traductions incomplètes
`src/lib/i18n.ts` couvre ~25 clés (`call`, `whatsapp`, `book`…) → la vitrine a 100+ chaînes en dur en français.

### 8.2 Dashboard 100% en français hardcodé
Le contexte `LangContext` existe mais n'est utilisé qu'à ~5% du dashboard.

### 8.3 Emails : uniquement en français
`src/lib/email.ts` : tous les templates sont en fr. Un client anglophone reçoit un email fr.

### 8.4 Formats date/heure hardcodés
`toLocaleDateString("fr-FR", ...)` partout → aucun respect de la locale utilisateur.

### 8.5 Pas de détection auto-langue
Aucune lecture de `Accept-Language`.

---

## 📧 LOT 9 — EMAILS & COMMS

### 9.1 Fallback FROM email = `noreply@artisanpro.fr`
Le repo s'appelle Vitrix. Confusion de branding → hardcodé.

### 9.2 Pas de mode "batch" ni de queue
Chaque email est envoyé synchrone dans les routes. Si Resend rate-limit, tout casse.

### 9.3 Aucun template en composant réutilisable
`EmailTemplates.*` renvoie des strings HTML monolithiques (répétition de wrapper). À passer sur React Email.

### 9.4 SMS/WhatsApp Twilio : coûts non contrôlés
Aucun budget max, aucun log de coût par pro, aucune limite quotidienne. Un bug = facture 4 chiffres.

### 9.5 Pas d'unsubscribe légal dans les emails marketing
Obligatoire RGPD + can-spam. Absent des templates.

### 9.6 Pas de DKIM / SPF / DMARC documenté
Ajouté à `DEPLOY_VERCEL_IONOS.md` mais **aucun test automatique** pour vérifier que les emails partent bien signés.

---

## 🤖 LOT 10 — IA & COÛTS

### 10.1 Modèle hardcodé `gpt-4o-mini`
Partout dans `/api/ai-*`, `/api/ai/*`, `/api/ai-chat`. Pas de config par env → pas moyen de tester Claude / Mistral local sans code change.

### 10.2 Aucune limite de tokens par utilisateur
Un user Premium peut consommer 1M tokens/jour = ~10€/jour de coût OpenAI pour vous. À plafonner (`ai_usage` table + quota mensuel).

### 10.3 Prompts partout en dur
Impossible d'itérer sans redéploiement. À externaliser dans `src/lib/prompts/*.ts` ou une table DB.

### 10.4 Pas de streaming
Toutes les réponses IA sont bloquantes (attendues jusqu'au bout). UX chat lente.

### 10.5 Fallback quand OpenAI down
Bien codé dans `/api/ai-chat` (fallback règles), pas dans `/api/ai-blog` ni `/api/ai/*`.

---

## 💰 LOT 11 — STRIPE & FACTURATION

### 11.1 Webhook Stripe : uniquement 3 événements
`checkout.session.completed`, `subscription.updated`, `subscription.deleted`. Manquent :
- `invoice.payment_failed` → dégrader user, envoyer email
- `invoice.upcoming` → prévenir avant renouvellement
- `customer.subscription.trial_will_end`
- `charge.dispute.created` → alerte fraude

### 11.2 Pas de gestion du "grace period"
`subscription.updated` avec status `unpaid` → downgrade immédiat. Mieux : garder l'accès 3-7j puis downgrade.

### 11.3 Pas de facture PDF envoyée après paiement
Rien dans le webhook n'envoie l'invoice PDF au client.

### 11.4 Stripe Connect Express jamais utilisé
`connect/route.ts` + `callback/route.ts` existent, mais l'onboarding n'est pas dans le dashboard visible.

### 11.5 Prix hardcodés dans `utils.ts`
`SUBSCRIPTION_FEATURES.pro.price = 29` mais Stripe utilise `STRIPE_PRICE_ID_PRO` → risque de divergence.

### 11.6 Pas de test des webhooks (Stripe CLI)
Aucune doc pour `stripe listen --forward-to`.

---

## 🧪 LOT 12 — TESTS

### 12.1 27 tests unitaires seulement (mes ajouts)
Aucun test sur les routes API (login, register, webhook Stripe, quote-request…).

### 12.2 Playwright : 1 seul fichier ?
`tests/e2e/` à explorer, probablement des scénarios de base.

### 12.3 Pas de test contract des webhooks Stripe
Un event malformé peut crash votre prod → à mocker.

### 12.4 Pas de test DB (transactionnel)
Register par exemple : la transaction est testable avec une DB Postgres jetable (Docker + Testcontainers).

### 12.5 Pas de couverture (coverage) mesurée
Ajouter `vitest --coverage`.

### 12.6 Pas de CI GitHub Actions
Aucun `.github/workflows/*.yml` : les tests / lint / typecheck ne tournent pas sur PR.

---

## 📊 LOT 13 — MONITORING & OBSERVABILITÉ

### 13.1 Aucun Sentry / Highlight / Rollbar
Les erreurs prod sont perdues dès qu'elles quittent les logs Vercel (30 jours max sur Pro).

### 13.2 Pas de metrics business
Aucun tracking : "combien de RDV créés cette semaine ?", "conversion register→paiement ?" → aveugle pour piloter la boîte.

### 13.3 Healthcheck simpliste
`/api/health` teste juste `select 1`. Ne check ni Stripe, ni Resend, ni la queue.

### 13.4 Pas de dashboard interne admin
Aucune page pour voir tous les users, gérer les remboursements, blacklister un compte.

### 13.5 Pas d'alerting
Pas de webhook Slack/Discord quand un webhook Stripe échoue, quand la DB est down, etc.

---

## 🗄️ LOT 14 — BASE DE DONNÉES

### 14.1 Duplication d'enum `appointment_status` dans schema.ts
Deux `pgEnum("appointment_status", …)` avec des valeurs différentes. Un des deux est probablement inutilisé.

### 14.2 Colonnes `text` sans limite
`clients.notes`, `businesses.description`, `blog_posts.content` → un user peut coller 1 GB. À caper via CHECK.

### 14.3 Pas de `soft delete`
`db.delete()` partout. Un client supprimé = données perdues. À passer sur `deleted_at TIMESTAMP` pour RGPD (droit à l'oubli) + audit.

### 14.4 Timestamps `updatedAt` pas déclenchés
`updatedAt: timestamp().defaultNow()` initial OK, mais **rien ne le met à jour** au UPDATE (pas de trigger, pas de `$onUpdate` Drizzle).

### 14.5 `visits_reset_at` : logique de reset inconnue
Colonne présente, jamais lue clairement.

### 14.6 `analytics` vs `pageVisits` : 2 tables analytiques
Duplication ou usages différents ? À documenter.

### 14.7 Pas de partitionnement `page_visits`
Si vous avez 1000 businesses × 100 visites/jour × 365 = 36M rows/an → à partitionner par mois.

### 14.8 Cascade delete manquants
`businesses` a `owner_id → users`. Si un user est supprimé, le business devient orphelin. Pas de `onDelete: cascade`.

### 14.9 Backups Supabase
Uniquement quotidiens en plan Free. Documenter la fréquence + point-in-time recovery.

---

## 🧾 LOT 15 — LÉGAL & CONFORMITÉ

### 15.1 CGU / Confidentialité : fichiers existent, contenu ?
À vérifier qu'ils mentionnent : responsable de traitement, DPO, base légale RGPD, durée conservation, transferts hors UE (Stripe US, OpenAI US, Resend US).

### 15.2 Cookies : aucun consent banner
Vous posez un cookie `auth_token` (fonctionnel = OK sans consent) mais **aucune bannière** pour un futur cookie analytics/marketing.

### 15.3 Pas de mention légale visible
Obligatoire loi française (LCEN). SIREN, nom éditeur, hébergeur.

### 15.4 Contrat de sous-traitance RGPD
Vous êtes sous-traitant des données de vos pros (qui sont responsables). Il faut un DPA type dans les CGU.

### 15.5 Export/suppression compte
Droit à la portabilité + oubli RGPD : rien dans le dashboard settings ne propose ça.

---

## 🎯 LOT 16 — BUSINESS / PRODUIT

### 16.1 Aucune analytique de conversion
Vous ne savez pas :
- Visiteurs de la landing → registers ?
- Registers → premier RDV créé ?
- Free → Pro upgrade rate ?
- Churn ?

### 16.2 Pas de trial payant (14 jours)
Standard SaaS : "essayer Pro 14 jours gratuit" → augmente les conversions 3x.

### 16.3 Pas de parrainage
Un pro qui invite un ami → 1 mois offert. Générateur de croissance gratuite.

### 16.4 Pas de public API / webhooks sortants
Les pros ne peuvent pas connecter leur outil (compta Sage, agenda Google au-delà de ce qui est fait, Zapier).

### 16.5 Onboarding CSM / support
Aucun chat intégré (Crisp, Intercom), aucun statuspage.

### 16.6 Pas de programme d'affiliation
Générateur de leads pour un SaaS niché B2B.

---

## 🧹 LOT 17 — DEVEX & QUALITÉ DÉV

### 17.1 Pas de CI GitHub Actions
Ajouté à la roadmap. Sans CI, on peut merger du code cassé.

### 17.2 Pas de pre-commit hook
`husky + lint-staged` : formatage + lint auto avant chaque commit.

### 17.3 Pas de Storybook
Pour un SaaS avec 15+ composants UI, Storybook accélère massivement le développement.

### 17.4 Pas de `.editorconfig`
Sur un projet multi-devs, différents éditeurs = différent tab-size.

### 17.5 Pas de Prettier configuré
Formatage manuel → PRs polluées de reformatages.

### 17.6 Doc API absente
Aucun Swagger/OpenAPI. Impossible d'onboarder un nouveau dev vite.

### 17.7 Migration Drizzle : dossier `drizzle/meta` doit être commit
J'ai mis `drizzle/meta/` en `.gitignore` mais **c'est une erreur**. Il faut le commit pour que les migrations soient reproductibles. À corriger.

### 17.8 Pas de `.env.local.example` séparé
Un seul `.env.example` qui mélange prod/dev. Devrait avoir un `.env.local.example` minimal (juste DB + SECRET).

---

## 📦 Récapitulatif chiffré

| Domaine | Points faibles | Impact |
|---|---|---|
| Sécurité | 10 | Élevé — encore des IDOR probables |
| Code / dette | 10 | Élevé — code peu maintenable |
| UI / UX | 12 | Élevé — impact conversion |
| Accessibilité | 7 | Moyen — obligation légale |
| Performance | 10 | Élevé — impact SEO & UX |
| SEO | 8 | Élevé — impact business direct |
| Mobile/PWA | 4 | Moyen — mobile abandonné en l'état |
| I18N | 5 | Faible sauf si vraiment multi-langues |
| Emails/comms | 6 | Moyen — RGPD + coûts |
| IA/coûts | 5 | Élevé — coûts non contrôlés |
| Stripe | 6 | Élevé — cash management |
| Tests | 6 | Moyen — dette de test |
| Monitoring | 5 | Élevé — aveugle en prod |
| DB | 9 | Élevé — perf + intégrité |
| Légal | 5 | Élevé — obligations légales |
| Business | 6 | Élevé — croissance |
| DevEx | 8 | Moyen — vélocité dév |
| **TOTAL** | **122** | |

---

## 🎯 Priorisation recommandée

### Si vous avez **2 jours**
1. Lot 1.1 (retirer `localStorage.auth_user`)
2. Lot 3.4 (créer `loading/error/not-found` + toast)
3. Lot 5.3 (jouer `sql/00_apply_safe.sql` en prod)
4. Lot 12.6 + 17.1 (CI GitHub Actions)
5. Lot 13.1 (Sentry gratuit)

### Si vous avez **1 semaine**
- Ajouter les lots 1.5, 1.6, 1.7 (rate limits partout)
- Lot 3.9, 3.11 (live preview + onboarding)
- Lot 5.5, 5.7 (next/image + Server Components)
- Lot 11.1, 11.2 (webhook Stripe complet + grace period)
- Lot 15.1-5 (RGPD + mentions légales)

### Si vous avez **1 mois**
- Lot 2 en entier (refactor duplications, éclatement des gros fichiers)
- Lot 4 (accessibilité complète)
- Lot 8 (i18n complet dashboard)
- Lot 13 (monitoring complet)
- Lot 14 (soft delete, triggers updatedAt, partitionnement)

### Ce qui peut **attendre**
- Lot 7 (mobile Expo) → décider si on garde ou pas
- Lot 16.4-6 (API publique, affiliation) → v2 produit
- Lot 17.3 (Storybook) → si équipe grandit

---

## Conclusion

Le projet est **fonctionnellement riche** mais souffre du syndrome "SaaS solo dev" :
- Beaucoup de features livrées vite, chacune à 70%
- Peu de vérifs d'intégrité, peu de garde-fous coûts
- Code monolithique à découper
- Duplications multiples (templates, PDF, UI mobile/desktop, SW…)

**Les 3 chantiers avec le meilleur ROI** :
1. **Rate-limits + IDOR complets** (2 jours) → protège vos coûts et vos données
2. **Découpage des gros fichiers `vitrine/page.tsx` et `PublicPage.tsx`** (3 jours) → vitesse de développement × 3
3. **Monitoring + CI** (1 jour) → passe de "je découvre les bugs par les users" à "je les vois avant"

Le reste est de l'itération produit / DX classique.
