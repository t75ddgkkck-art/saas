# Business & Produit (Lot 16)

## 1. Parrainage (Lot 16.3)

### Fonctionnement

- À l'inscription, chaque user reçoit un code `VX-XXXXXX` unique dans `users.referral_code`
- Le user partage `https://vitrix.fr/register?ref=VX-XXXXXX`
- Le filleul saisit le code au register → `users.referred_by` = id du parrain
- Quand le filleul complète son **premier paiement Stripe** (webhook `checkout.session.completed`), le parrain reçoit **+1 mois de crédit** dans `users.referral_credit_months`
- Le crédit sera consommé lors du prochain paiement du parrain (implémentation dans `handleInvoicePaid` — TODO ciblé, la lib `consumeReferralCredit` est prête)

### Endpoints

- `GET /api/account/referral` — code + shareUrl + stats filleuls + crédit accumulé
- Register accepte `referralCode` en body (résolu côté serveur, ignoré si invalide)

### Sécurité

- Code résolu via `resolveReferralCode()` : ignore les codes invalides, bannis, soft-deleted
- Impossible de s'auto-parrainer (le filleul n'existe pas encore quand il saisit le code)
- Crédit non-bloquant côté Stripe : si le crédit échoue, le webhook réussit quand même (le paiement du filleul reste actif)

## 2. API publique v1 (Lot 16.4)

### Authentification

Toutes les routes `/api/v1/*` demandent une clé API :

```
Authorization: Bearer vx_live_XXXXXXXXXXXXXXXXXXXXXXXX
```

ou en fallback :

```
X-Api-Key: vx_live_XXXXXXXXXXXXXXXXXXXXXXXX
```

Format clé : `vx_live_` (ou `vx_test_`) + 24 chars base32 Crockford (sans I/O/L/U). Ex :
```
vx_live_A3F7K2NPQR5TVWXYZBCD9EFG
```

Stockage : **hash SHA-256 uniquement**. La clé claire n'est visible qu'à la création. Le prefix `vx_live_A3F7` (12 chars) est visible côté user pour identifier une clé dans les logs.

### Rate-limit

**60 req/min par clé**. Headers `X-RateLimit-*` retournés à chaque requête.

### Scopes

- `read` (défaut) : GET uniquement
- `read_write` : GET + POST/PUT

### Endpoints livrés

| Endpoint | Scope | Rôle |
|---|---|---|
| `GET /api/v1/me` | read | Infos du business (id, slug, nom, catégorie, contact) |
| `GET /api/v1/appointments` | read | Liste paginée RDV, filtres `?limit=`, `?cursor=`, `?status=` |
| `POST /api/v1/appointments` | read_write | Crée un RDV (clientId OU création client à la volée par phone) |
| `GET /api/v1/clients` | read | Liste paginée clients CRM |

### Pagination

Cursor-based : `?cursor=<iso-createdAt>` renvoie les résultats plus anciens que ce timestamp. `nextCursor` dans la réponse.

### Gestion des clés (dashboard)

- `POST /api/account/api-keys` `{ name, scope }` → crée + retourne rawKey **une seule fois**
- `GET /api/account/api-keys` → liste sans hash ni raw
- `DELETE /api/account/api-keys/[id]` → révoque (soft, `revoked_at = NOW()`)
- Limite : 10 clés actives par user

### Exemple curl

```bash
curl https://api.vitrix.fr/api/v1/me \
  -H "Authorization: Bearer vx_live_A3F7K2NPQR5TVWXYZBCD9EFG"
```

```bash
curl https://api.vitrix.fr/api/v1/appointments \
  -H "Authorization: Bearer vx_live_..." \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{
    "title": "RDV chaudière",
    "date": "2026-08-15",
    "startTime": "10:00",
    "endTime": "11:00",
    "client": {
      "firstName": "Alice",
      "lastName": "Dupont",
      "phone": "+33612345678",
      "email": "alice@example.com"
    }
  }'
```

## 3. Webhooks sortants (Lot 16.4)

### Configuration côté user

- `POST /api/account/webhooks` `{ url, events? }` → crée endpoint + retourne `signingSecret` (1×)
- `GET /api/account/webhooks` → liste + `availableEvents`
- `DELETE /api/account/webhooks/[id]` → hard delete (l'historique reste dans webhook_deliveries)

Limite : 5 endpoints par user. URL **doit** être HTTPS.

### Events supportés

- `appointment.created`, `appointment.updated`, `appointment.cancelled`
- `payment.received`
- `quote.sent`, `quote.signed`
- `review.received`

Un endpoint avec `events: []` reçoit **tous** les events (pratique pour Zapier catch-all).

### Format du payload

```json
{
  "event": "appointment.created",
  "id": "evt_uuid",
  "timestamp": "2026-07-10T14:30:00.000Z",
  "businessId": "biz-uuid",
  "data": { ... event-specific ... }
}
```

### Signature (à vérifier côté receveur)

Header : `X-Vitrix-Signature: t=<unix-ts>,v1=<hex-hmac>`

Vérification en Node :
```js
import { createHmac } from "crypto";

function verify(body, header, secret) {
  const [t, v1] = header.split(",").map(p => p.split("=")[1]);
  const expected = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  // Timing-safe compare recommandé (crypto.timingSafeEqual)
  return v1 === expected;
}
```

### Retry / disable auto

- Timeout HTTP : 5s hard par requête
- Échec = statuss non-2xx OU exception réseau OU timeout
- **5 échecs consécutifs → `disabled_at = NOW()`** (endpoint désactivé)
- Un succès reset le compteur `failure_count` à 0
- Chaque tentative loggée dans `webhook_deliveries` (audit + debug)

### Où sont dispatchés les events ?

- `appointment.created` : `POST /api/v1/appointments`
- Autres events : à câbler au fil des lots suivants (`payment.received` dans webhook Stripe, etc.) — la lib `dispatchWebhook` est prête, l'appel reste à greffer

## 4. Support (Lot 16.5)

### SupportBubble

`src/components/layout/SupportBubble.tsx` — bouton flottant bas-droite du dashboard.

3 modes selon env :
- `NEXT_PUBLIC_CRISP_ID` défini → charge Crisp Live Chat (widget officiel)
- `NEXT_PUBLIC_INTERCOM_APP_ID` défini → charge Intercom
- Sinon → fallback `mailto:` vers `NEXT_PUBLIC_LEGAL_EMAIL`

**Aucune dépendance NPM ajoutée** — les scripts tiers sont injectés dynamiquement uniquement si l'env est présente.

### Statuspage `/status`

- Page publique lisant `/api/health` (Lot 13) avec revalidate ISR 30s
- Bandeau global vert/rouge selon `ok`
- Liste par service avec latence + détail
- Version + env affichés en bas
- Ajoutée au footer landing + sitemap statique

## 5. Affiliation (Lot 16.6)

**Réutilise le parrainage** — le programme d'affiliation grand-public est une extension du référent : un affilié = un user avec beaucoup de filleuls.

Base structurelle en place :
- `users.referral_code` = code d'affilié unique
- `users.referred_by` = tracking
- `users.referral_credit_months` = commission accumulée

À faire dans un lot ultérieur (marketing) :
- Landing dédiée `/affiliation` avec formulaire d'inscription programme
- Dashboard reporting (clics, conversions, commission cumulée)
- Paiement des commissions via Stripe Connect payout

## 6. Actions post-déploiement

1. **Jouer `sql/00_apply_safe.sql`** dans Supabase (idempotent, ajoute users.referral_code, api_keys, webhook_endpoints, webhook_deliveries)
2. **Rétroactif référent** : les users existants n'ont pas de `referral_code` — un script one-shot pour leur en attribuer un est recommandé :
   ```sql
   -- À adapter : boucle qui appelle notre helper JS OU génère en SQL
   UPDATE users SET referral_code = 'VX-' || upper(substring(md5(id::text || random()) from 1 for 6))
   WHERE referral_code IS NULL;
   ```
3. **(Optionnel) Setup Crisp/Intercom** : ajouter `NEXT_PUBLIC_CRISP_ID` ou `NEXT_PUBLIC_INTERCOM_APP_ID` sur Vercel
4. **Documenter l'API publique** : la doc de ce fichier peut être publiée en Markdown sur un `/docs/api` ou un GitBook
5. **Câbler les dispatchWebhook restants** au fil des lots suivants (payments, quotes, reviews)
