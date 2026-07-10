# Équipe & rôles multi-utilisateurs (F5 — Lot 32)

## Objectif business

- **Ouvre le marché TPE 2-10 personnes** (avant : solo uniquement)
- ARPU +30% attendu grâce aux plans Pro (2 sièges) et Premium (illimité)
- Répond au besoin réel : coiffeur avec 2 salariés, plombier avec assistant admin, avocat + secrétaire, commerçant + comptable en lecture

## Architecture

### 4 rôles

| Rôle | Description |
|---|---|
| **owner** | Propriétaire (implicite via `businesses.ownerId`). Accès total, seul à pouvoir supprimer le business ou gérer l'abonnement. |
| **admin** | Bras droit. Peut inviter/révoquer, éditer tout, mais pas supprimer le business ni changer d'abonnement. |
| **employee** | Opérationnel. Voit tout, crée RDV/devis/clients, édite ce qui lui est assigné. Pas d'export RGPD, pas de refund. |
| **viewer** | Comptable, stagiaire. Lecture seule stricte. |

Le **owner** N'EST PAS dans `team_members` (implicite). Les autres sont dans `team_members` avec le rôle stocké dans `member_role`.

### Modèle de données

**`team_members`** (refonte) :
```sql
id, business_id (cascade)
user_id            -- NULL avant acceptation, rempli quand le user se connecte
email, first_name, last_name
member_role        -- admin | employee | viewer (CHECK SQL)
invited_by_user_id, invited_at
accepted_at        -- NULL = invitation en attente
active             -- true par défaut, false = suspendu
deleted_at         -- soft-delete Lot 14
```

Index : `(business_id, lower(email)) UNIQUE`, `user_id`, `business_id`.

**`team_invitations`** (nouveau) :
```sql
id, business_id, email, member_role
token_hash         -- SHA-256 du token brut envoyé par email
expires_at         -- +7 jours
accepted_at        -- NULL = pas encore consommé
invited_by_user_id, created_at
```

**Extensions** :
- `appointments.assigned_to_user_id` (FK users, nullable) — assignation
- `quotes.assigned_to_user_id` — idem

## Système de permissions

`src/lib/team-permissions.ts` — matrice **rôle × capability** figée par test snapshot.

- 30 capabilities (business/team/appointments/quotes/clients/payments/billing/analytics/ai)
- Convention `<domaine>.<action>` (ex : `appointments.edit_any`, `payments.refund`)
- **Combinaison finale = plan (entitlements F1) ET rôle (F5)**

Fonctions :
- `roleHas(role, cap)` — check simple
- `canManageRole(actor, target)` — un admin peut gérer employee/viewer, jamais admin/owner
- `listCapabilities(role)` — liste exhaustive (renvoie une copie)

## Contexte équipe

`src/lib/team-context.ts` :
- **`getCurrentTeamContext()`** — résout le business actif + rôle pour l'user courant
  - Priorité : owner d'un business, sinon premier team_members actif
  - Renvoie `{user, business, role, isOwner}`
- **`requireTeamPermission(cap)`** — guard API qui throw `unauthorized`/`forbidden`
- **`listUserBusinesses()`** — tous les businesses accessibles (owner + invité) pour un futur switcher

## Flow d'invitation

1. Owner/admin → `/dashboard/team` → clic "Inviter un membre"
2. Modal : email + prénom + nom + rôle
3. `POST /api/team/invite` :
   - Vérifie `team.invite` cap
   - Vérifie entitlement `team.enable` sur le plan du owner
   - Check quota `maxTeamMembers` (Pro=2, Premium=illimité)
   - Vérifie `canManageRole(actor, target)` (admin ne peut pas inviter admin)
   - Anti-doublon : membre actif ou invitation active
   - Crée `team_members` (accepted_at NULL) + `team_invitations` (token 7j)
   - Envoie email avec lien `/team/accept?token=<raw>`
4. Le futur membre reçoit l'email
5. Il clique → `/team/accept?token=` (page publique)
   - Peek `/api/team/accept?token=` → affiche business + rôle
   - S'il n'est pas connecté → CTA "Se connecter" ou "Créer un compte" (précharge email)
   - S'il est connecté avec le bon email → bouton "Accepter"
   - S'il est connecté avec un autre email → alerte "Reconnectez-vous avec X"
6. `POST /api/team/accept { token }` :
   - Consomme l'invitation atomiquement (single-use via `accepted_at`)
   - Vérifie email match (`user.email === invitation.email`)
   - Link `team_members.user_id = user.id`, `accepted_at = now`
   - Redirect vers `/dashboard?welcome=team`
7. Au prochain login/hit dashboard, `getCurrentTeamContext()` résout le business et le rôle

## Routes API

| Route | Méthode | Cap requise | Rate |
|---|---|---|---|
| `/api/team` | GET | `team.view` | - |
| `/api/team/invite` | POST | `team.invite` + entitlement `team.enable` + quota | 10/h/IP |
| `/api/team/accept?token=` | GET | Publique | 10/h/IP |
| `/api/team/accept` | POST | Auth (email match) | 10/h/IP |
| `/api/team/[id]` | PATCH | `team.change_role` + `canManageRole(actor, target)` | 30/h/IP |
| `/api/team/[id]` | DELETE | `team.remove` + `canManageRole(actor, target)` | 30/h/IP |
| `/api/team/context` | GET | Auth | 60/min |

## UI

- **`/dashboard/team`** — page dédiée gaté par `<UpgradeGate feature="team.enable">`
- **`<TeamManager>`** — liste + invite modal + change role (select inline) + revoke (Confirm)
- **`<TeamMemberBanner>`** dans le layout dashboard — si `!isOwner`, affiche "Vous êtes connecté en tant que {role} de {business}"
- **`/team/accept`** — page publique avec 3 états (pas connecté / mauvais email / OK)
- **Sidebar** : entrée "Équipe" visible uniquement pour Pro/Premium (masqué Free)

## Assignation RDV/devis (v1 base)

Les colonnes `assigned_to_user_id` sont en DB + index créés. **UI d'assignation** (dropdown dans le RDV/devis) reste à faire en v2 — décidé pour ne pas doubler la taille de ce lot. Les routes existantes fonctionnent (les colonnes sont nullable, retro-compat totale).

## Sécurité

- **Anti-IDOR** : chaque PATCH/DELETE vérifie que le membre appartient au business courant
- **Anti-privilege-escalation** : `canManageRole()` bloque admin ↔ admin, employee/viewer ne peuvent rien changer
- **Anti-email-hijack** : POST accept vérifie que `user.email === invitation.email`
- **Anti-spam** : rate-limits + anti-doublon (une seule invitation active par email/business)
- **Soft-delete** : les membres retirés gardent trace (RDV, devis conservés avec `assignedToUserId`)
- **CHECK SQL** : `member_role IN ('admin', 'employee', 'viewer')` sur les 2 tables

## Tests (29 nouveaux)

- **`team-permissions.test.ts`** : 15 tests snapshot matrice + helpers
  - Owner a TOUTES les caps (canary : si un dev ajoute une cap sans la donner au owner, le test casse)
  - Admin ≠ business.delete, billing.manage
  - Employee : create + edit_assigned mais pas edit_any/delete/refund
  - Viewer : uniquement `.view` (lecture seule stricte)
  - `canManageRole` : matrice actor × target
- **`team-invitations.test.ts`** : 14 tests
  - Token brut 64 chars hex, hash SHA-256 déterministe
  - createTeamInvitation : normalisation email lowercase, stocke hash pas brut
  - consumeTeamInvitation : not_found / expired / already_used / nominal / rôle corrompu → viewer safe
  - peekTeamInvitation : lecture SANS consommer

## Roadmap

- **v1 livrée** : rôles + invitations + UI complète + assignation base (colonne DB)
- **v2** : UI d'assignation (dropdown dans les RDV/devis) + filtre "Mes RDV" employé
- **v3** : audit log user-facing "qui a fait quoi" (utilise `admin_events` déjà en DB)
- **v4** : switcher de business pour les users membres de plusieurs businesses (cookie `current_business`)
- **v5** : sièges facturés à l'usage (Premium+ : 10€/mois par siège au-delà de 5)
