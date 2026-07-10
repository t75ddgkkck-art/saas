# Espace client final (F3 — Lot 31)

## Objectif business

- **Rétention** : un client qui a un compte retrouve son historique = revient plus souvent
- **Cross-pro** : un même email = accès à ses RDV/devis chez TOUS ses pros Vitrix → effet plateforme
- **Réduction charge support** : le client annule/reprogramme lui-même, gère ses documents
- **UX** : plus besoin de re-saisir nom/tel/mail à chaque prise de RDV (v2)

## Design découplé

Le client final n'est PAS dans `users` (réservé aux pros). Il existe déjà via `clients.email` (unifié case-insensitive). Tout tourne sur cet email :

- Table `client_auth_tokens` (magic-link, TTL 15 min, single-use)
- Table `client_sessions` (cookie signé, TTL 30 jours, révocable)
- Cookie `vx_client_session` distinct du cookie pro (`auth_token`) → un navigateur peut avoir les 2 sessions

## Flow magic-link

1. Client va sur `/mon-compte` → redirect vers `/mon-compte/login`
2. Il tape son email → `POST /api/client/magic-link`
3. Backend vérifie que l'email existe dans `clients` (au moins un business)
4. Si oui, génère un token, envoie email `EmailTemplates.clientMagicLink`
5. Client clique → `GET /api/client/verify?token=<raw>`
6. `consumeClientAuthToken` valide (single-use, TTL, expiration)
7. `createClientSession` crée le cookie signé HMAC
8. Redirect vers `/mon-compte`
9. Le dashboard charge en parallèle `/api/client/me`, `/appointments`, `/quotes`

**Anti-énumération** : même réponse générique (`"Si un compte existe pour cet email..."`) que l'email existe ou pas. Délai artificiel 250-500ms uniformise le timing.

## Routes API

| Route                                  | Méthode | Auth             | Rate       | Description                                                 |
| -------------------------------------- | ------- | ---------------- | ---------- | ----------------------------------------------------------- |
| `/api/client/magic-link`               | POST    | Publique         | 3/10min/IP | Envoie le magic-link                                        |
| `/api/client/verify`                   | GET     | Publique (token) | 10/min/IP  | Consomme token, pose cookie, redirect                       |
| `/api/client/logout`                   | POST    | Session client   | -          | Révoque cookie + session DB                                 |
| `/api/client/me`                       | GET     | Session client   | 60/min     | email + businesses fréquentés                               |
| `/api/client/appointments`             | GET     | Session client   | 60/min     | RDV tous businesses (filtrer `?upcoming=1`, `?businessId=`) |
| `/api/client/quotes`                   | GET     | Session client   | 60/min     | Devis tous businesses                                       |
| `/api/client/appointments/[id]/cancel` | POST    | Session client   | 5/heure/IP | Annule un RDV (avec refund F2)                              |

## Annulation avec refund (intégration F2)

Le POST cancel :

1. Vérifie ownership (email du client match `clients.email` du RDV)
2. Refuse si RDV déjà `cancelled`/`completed`/`no_show` ou passé
3. Si `depositStatus === "paid"` → applique `decideRefundOnCancel({refundHours, appointmentStart})` de F2
4. Update RDV : `status=cancelled`, `depositStatus=refunded|forfeited`
5. Libère le slot
6. Si `refunded` + Stripe configuré + compte Connect : appelle `refundDeposit()` (non-throwing, si Stripe fail, le pro traite manuellement)

## Modèle de données

### `client_auth_tokens`

```sql
id           uuid PK
email        varchar(255) NOT NULL  -- normalisé lowercase
token_hash   varchar(64)  NOT NULL  -- SHA-256 du token brut
expires_at   timestamp    NOT NULL  -- 15 min après création
used_at      timestamp              -- non-null = consommé
ip           varchar(45)
business_id  uuid FK businesses     -- entrée éventuelle (analytics)
created_at   timestamp
```

Index : `hash UNIQUE` (lookup), `(email, used_at, expires_at)` (compte tokens actifs).

### `client_sessions`

```sql
id           uuid PK
email        varchar(255) NOT NULL
token_hash   varchar(64)  NOT NULL  -- SHA-256 du session ID
expires_at   timestamp    NOT NULL  -- +30 jours
ip           varchar(45)
user_agent   varchar(500)
created_at   timestamp
last_seen_at timestamp
revoked_at   timestamp              -- logout
```

Index : `hash UNIQUE`, `email` (lookup), `expires_at` (purge).

## Sécurité

- Token brut = 32 bytes hex (256 bits entropie)
- Stockage = SHA-256 (fuite DB ⇒ tokens inexploitables)
- Cookie : `httpOnly`, `secure` en prod, `sameSite=lax`, HMAC signé
- Anti-forge : signature timing-safe (`timingSafeEqual`)
- Anti-spam : 3 tokens actifs max / email
- Session : révocation via `revokedAt`, purge des expirés > 7j
- Rate-limits stricts sur toutes les routes publiques

## UI

- `/mon-compte/login` — formulaire email uniquement (aucun mot de passe)
- `/mon-compte` — dashboard avec sections : Mes pros / RDV à venir / Historique / Devis
- Bouton "Annuler" sur chaque RDV upcoming (dialog ConfirmDialog + toast)
- `noindex` sur toutes les pages `/mon-compte/*`

## Tests (21 unit)

- `tests/unit/client-auth.test.ts` — 14 tests
  - Génération token (64 chars hex, non-devinable)
  - Hash SHA-256 déterministe
  - Anti-spam TOO_MANY_ACTIVE_TOKENS
  - Consommation : nominal / not_found / expired / already_used / token vide
- `tests/unit/client-session.test.ts` — 7 tests
  - Roundtrip encode/decode cookie
  - Rejet signature altérée
  - Rejet expiration passée
  - Rejet payload malformé
  - Rejet longueur invalide
  - base64url pur (pas de +/)

## Roadmap

- **v1 livrée** : magic-link + dashboard + annulation avec refund
- **v2** : reprogrammation (drag&drop créneaux) — attend F4 (calendrier)
- **v3** : téléchargement PDF devis/facture depuis l'espace
- **v4** : notifications push (Lot Mobile/PWA) pour rappels RDV
- **v5** : espace commentaires post-RDV (avis en 1 clic depuis un email de suivi)
