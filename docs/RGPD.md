# RGPD & Conformité légale (Lot 15)

## 1. Vue d'ensemble

Vitrix est double-casquette RGPD :

- **Responsable de traitement** pour les données de nos utilisateurs inscrits (compte, abonnement, logs)
- **Sous-traitant** (article 28) pour les données que nos utilisateurs saisissent sur leurs propres clients (CRM, RDV, devis, factures)

Cette distinction est explicite dans les CGU (section 11 DPA) et la politique de confidentialité.

## 2. Textes légaux livrés

| Page | Route | Contenu | Obligation |
|---|---|---|---|
| CGU | `/cgu` | 14 sections + DPA article 28 + sommaire ancré | Commercial (protection éditeur) |
| Confidentialité | `/confidentialite` | Tableaux traitements/sous-traitants/durées + droits RGPD | RGPD art. 13-14 |
| Mentions légales | `/mentions-legales` | Éditeur, hébergeur, RCS, SIREN, directeur pub | LCEN art. 6-III |

Les 3 pages sont liées dans le footer landing + les settings dashboard + le sitemap statique.

**Configuration** (variables `NEXT_PUBLIC_LEGAL_*` sur Vercel) :

```
NEXT_PUBLIC_LEGAL_PUBLISHER="Ma Société SAS"
NEXT_PUBLIC_LEGAL_ADDRESS="12 rue Exemple, 75001 Paris"
NEXT_PUBLIC_LEGAL_EMAIL="contact@vitrix.fr"
NEXT_PUBLIC_LEGAL_PHONE="+33 1 23 45 67 89"
NEXT_PUBLIC_LEGAL_SIREN="123 456 789"
NEXT_PUBLIC_LEGAL_RCS="Paris B 123 456 789"
NEXT_PUBLIC_LEGAL_CAPITAL="SAS au capital de 10 000 €"
NEXT_PUBLIC_LEGAL_DIRECTOR="Prénom Nom, Président"
NEXT_PUBLIC_LEGAL_VAT="FR12 123456789"
NEXT_PUBLIC_LEGAL_DPO_EMAIL="dpo@vitrix.fr"    # optionnel, sinon contact
```

Sans ces vars → affichage "à compléter" (safe pour dev, mais **à remplir avant mise en prod commerciale**).

## 3. Consent cookies

Bannière `src/components/layout/CookieConsent.tsx` affichée sur le layout racine.

- Vitrix n'utilise **que** des cookies strictement nécessaires (session `auth_token`)
- Ces cookies sont dispensés de consent (CNIL / ePrivacy)
- La bannière est là pour **informer** et pour être **prête** si on ajoute un cookie analytique un jour

État stocké dans `localStorage` (pas dans un cookie — évite le paradoxe "cookie pour consentir aux cookies").

## 4. Export RGPD (portabilité art. 20)

`GET /api/account/export` :
- Auth required
- Rate limit 3 req / heure / user
- Retourne un JSON structuré `vitrix-mes-donnees-YYYY-MM-DD.json`
- Contient : user (sans hash), businesses, clients, appointments, quotes, payments, blog, reviews, services, aiUsage, emailOptouts
- **Le hash bcrypt du mot de passe est explicitement exclu** (fuite sécurité potentielle)

Format documenté dans `src/lib/rgpd-export.ts` — versionné via `meta.format: "vitrix-rgpd-v1"` pour permettre une évolution rétro-compatible.

Accessible depuis le dashboard : `Settings → Suppression → bouton "Télécharger mes données"`.

## 5. Droit à l'oubli (art. 17)

Chaîne complète en 2 temps :

**T0 (immédiat)** — `DELETE /api/account` :
- Soft delete `users.deleted_at = NOW()`
- Soft delete cascade sur `businesses.deleted_at`
- Cookies purgés → l'user est déconnecté
- Vitrine + blog + annuaire ne montrent plus rien de l'user

**T+30j (cron)** — `/api/cron/purge-deleted` (schedule `30 3 * * *`) :
- Hard `DELETE` sur toutes les tables (users, businesses, clients, appointments, quotes, blog_posts) où `deleted_at < NOW() - 30 days`
- Cascade DB (Lot 14.8) nettoie tout le reste
- Rétention overridable via env `RGPD_PURGE_DAYS` (1-365)
- Erreur critique → alerte Sentry + webhook

Bénéfice : fenêtre 30j pour restauration en cas d'erreur, purge finale garantie.

**Alignement CGU** : les factures (obligation comptable 10 ans, L123-22 C. commerce) devraient être conservées séparément ou anonymisées. À ce stade, le cron purge les paiements avec le business → **à documenter comme un choix produit** ou à durcir en gardant les paiements + anonymisant les FKs.

## 6. Sous-traitants (article 28)

Liste tenue dans `/confidentialite` section 3. Modifier là si un sous-traitant est ajouté/retiré :

| Sous-traitant | Rôle | Loc | Garantie |
|---|---|---|---|
| Supabase | DB PostgreSQL | UE (Frankfurt) | Hébergement UE |
| Vercel | App + edge | USA + edge global | EU-US DPF + CCT |
| Stripe | Paiements | Irlande + USA | PCI-DSS 1 + CCT |
| Resend | Emails | USA | CCT + DPA signé |
| OpenAI | IA | USA | CCT + zero-retention API |
| IONOS | Registrar | Allemagne | UE |

⚠ Si vous activez un nouvel outil (Plausible, Google Analytics, PostHog…), **mettre à jour ce tableau** ET la bannière consent (opt-in explicite requis).

## 7. Notification de violation (art. 33-34)

En cas d'incident (accès non autorisé, exfiltration, ransomware) :

1. **72h max** : notifier la CNIL via https://notifications.cnil.fr/notifications/index
2. Si risque élevé pour les personnes : les notifier individuellement sans délai
3. Documenter tout dans un registre interne

Le monitoring Sentry + webhook Slack (Lot 13) sont configurés pour alerter en temps réel sur les erreurs critiques → détection early.

## 8. Checklist mise en prod commerciale

- [ ] Remplir toutes les env vars `NEXT_PUBLIC_LEGAL_*` sur Vercel
- [ ] Faire relire les CGU et la politique de confidentialité par un avocat (le contenu est un cadre technique, pas une validation juridique)
- [ ] Nommer un DPO (obligatoire si traitement à grande échelle) et publier son email
- [ ] Vérifier que le SIRET Vitrix apparaît bien sur `/mentions-legales`
- [ ] Vérifier que `/api/cron/purge-deleted` tourne bien (Vercel Cron dashboard) et logue un `total` > 0 après 30j de délai
- [ ] Setup `CRON_SECRET` sur Vercel pour protéger le cron
- [ ] Se déclarer auprès de la CNIL uniquement si traitement obligatoire (registre suffit dans la majorité des cas)
- [ ] Signer un DPA formel avec chaque sous-traitant (les DPA standards sont téléchargeables sur leurs sites)
- [ ] Tester l'export RGPD sur son propre compte → JSON téléchargeable, cohérent

## 9. Registre des traitements (article 30)

Recommandé : maintenir un fichier `docs/registre-traitements.md` (non commité — contient des infos sensibles) listant chaque traitement avec finalité, base légale, catégories, durée, destinataires, mesures de sécurité.

Template minimal :

```md
### Traitement : Gestion compte utilisateur
- Finalité : permettre l'accès au SaaS
- Base légale : contrat (art. 6.1.b)
- Personnes concernées : professionnels inscrits
- Catégories de données : identité, email, téléphone, SIRET
- Destinataires : équipe Vitrix, Supabase (sous-traitant)
- Durée : durée de l'abonnement + 30 jours
- Mesures : bcrypt, TLS, cookies httpOnly, rate limit
```
