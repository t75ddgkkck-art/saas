# QR codes trackables (F12 — Lot 47)

Permet à un pro de créer **plusieurs QR codes différenciés** avec des sources UTM distinctes, et de mesurer d'où viennent réellement les scans (carte visite vs camionnette vs flyer).

## Cas d'usage

- Artisan avec plusieurs supports print (cartes, camionnette, flyers, factures)
- Campagnes ponctuelles ("500 flyers d'avril → combien ont scanné ?")
- Multi-magasins avec QR uniques par point de vente (combiné avec Lot 46 multi-vitrines)
- Test A/B de flyers → mesurer laquelle convertit mieux

## Quotas

| Plan    | maxQrCodes |
| ------- | ---------- |
| Free    | 1          |
| Pro     | 3          |
| Premium | 20         |

Défini dans `PLAN_PERMISSIONS.maxQrCodes` (permissions.ts).

## Architecture

Aucune collecte parallèle — on **réutilise le tracker analytics existant**.

```
Client scanne QR → https://vitrix.fr/{slug}?src=carte-visite&utm_source=qr&utm_medium=qr&...
   ↓
Tracker /api/track/visit
   ↓
detectSource(referer, "carte-visite") → renvoie "carte-visite"
   ↓
INSERT page_visits (source="carte-visite", ...)
   ↓
GET /api/analytics agrège WHERE source IN (...) GROUP BY source
   ↓
Dashboard analytics affiche "Sources : carte-visite (245), camionnette (87), ..."
```

Le module Lot 47 ne fait que :
1. Gérer la CRUD des QR (label + source + UTM)
2. Générer l'URL trackée cohérente avec `detectSource()`
3. Générer le PNG/SVG à la demande

## Table `qr_codes`

Bloc SQL idempotent `4novodecies` :

```sql
CREATE TABLE qr_codes (
  id              uuid PK,
  business_id     uuid FK (cascade),
  label           varchar(100) NOT NULL,  -- "Carte de visite avril 2026"
  source          varchar(50)  NOT NULL,  -- "carte-visite-avril"
  utm_campaign    varchar(100),           -- "printemps-2026"
  utm_medium      varchar(50) DEFAULT 'qr',
  utm_content     varchar(100),           -- "flyer-a5-recto"
  deleted_at      timestamp,
  created_at, updated_at
);

-- Unicité source PAR business (deux artisans peuvent avoir "carte-visite")
CREATE UNIQUE INDEX qr_codes_business_source_uidx ON qr_codes (business_id, source);
CREATE INDEX qr_codes_business_created_idx ON qr_codes (business_id, created_at);
CREATE INDEX qr_codes_deleted_at_idx ON qr_codes (deleted_at);
```

## Lib `qr-tracking.ts`

3 helpers purs (testables sans DB) :

- `slugifySource(input)` : normalise vers `[a-z0-9-]+` cohérent avec `detectSource()`
- `validateSource(source)` : renvoie message d'erreur ou null
- `buildTrackedUrl(baseUrl, config)` : construit l'URL finale avec `?src=` + UTM standards

Format URL final :
```
https://vitrix.fr/dupont-plomberie
  ?src=carte-visite         (source unique — géré par detectSource)
  &utm_source=qr             (FIXE — permet de filtrer "canal QR" dans GA)
  &utm_medium=qr             (défaut, override possible)
  &utm_campaign=printemps    (optionnel)
  &utm_content=a5-recto      (optionnel)
```

## Routes API

- `GET /api/qr-codes` — liste avec scansCount agrégé depuis pageVisits (1 seul JOIN)
- `POST /api/qr-codes` — création (gate quota `maxQrCodes` + slugify défensif + unicité 409)
- `DELETE /api/qr-codes/[id]` — soft delete (anti-IDOR)
- `GET /api/qr-codes/[id]/download?format=png|svg&size=512` — génération à la demande

**Note** : pas de gate feature stricte type `qr.tracked` — c'est un besoin de base. Seul le QUOTA gate. Un Free peut avoir 1 QR, un Pro 3, un Premium 20.

**Note sécurité** : le download expose l'URL trackée en clair (elle finit sur le PNG scanné par n'importe qui). C'est le but. Pas de secret.

## UI

### `<TrackedQrCodes />` (nouveau composant)

Section ajoutée dans `/dashboard/qr-code` (au-dessus du QR "principal" existant).

- Liste des QR : preview mini (via `/api/qr-codes/[id]/download?format=png&size=128`), label, source, scansCount live
- Bouton "+ Nouveau QR" → modal (label + source auto-slugifiée live + UTM optionnels)
- Actions par QR : Download PNG 1024×1024, Download SVG, Copy URL, Delete (avec confirmation ConfirmDialog)
- Bandeau info : "Les scans sont trackés automatiquement dans vos analytics"
- Gestion erreurs 403 quota / 409 doublon avec toasts explicites

### Auto-slugification live

Quand l'user tape "Carte de visite avril" dans le label, le champ source se remplit
automatiquement en "carte-de-visite-avril". L'user peut override manuellement s'il veut
une source plus courte ou custom (ex: "cdv-04").

Comportement défensif : dès que l'user modifie source manuellement, l'auto-fill se
désactive pour ce QR.

## Analytics — vue automatique

Aucun changement UI nécessaire. L'API `/api/analytics` renvoie déjà `data.sources`
groupé par `pageVisits.source`. Les scans QR apparaissent naturellement dans
`<SourcesChart>` (Pro+ via `analytics.advanced`).

Exemple d'affichage attendu :
```
Sources de trafic (30 derniers jours) :
  google              4520 visites
  carte-visite-2026    342 scans QR
  camionnette          198 scans QR
  flyer-avril          87  scans QR
  direct               52
```

## Mention dans les tarifs

- **Free** : `"1 QR code trackable imprimable"` (avant : "QR Code imprimable")
- **Pro** : `"3 QR codes trackables (mesurez vos supports print)"`
- **Premium** : `"20 QR codes trackables (campagnes A/B, saisonnières)"`

## Tests

`tests/unit/qr-tracking.test.ts` — 21 tests :
- `slugifySource` : accents, caractères spéciaux, cap 50 chars, emoji (9 tests)
- `validateSource` : cas valides/invalides (3 tests)
- `buildTrackedUrl` : URL absolue, UTM optionnels, query params préservés (8 tests)
- Cohérence globale (1 test d'intégration)

## Actions post-déploiement

1. **DB migration** : `bash sql/apply.sh` — bloc `4novodecies` idempotent
2. **Test end-to-end** :
   - Compte Free : créer 1 QR "Test" → OK. Créer 2e → toast 403 avec upgradeTo=pro
   - Compte Pro : créer 3 QR différents → OK. Créer 4e → toast 403 avec upgradeTo=premium
   - Compte Premium : créer 4 QR → tous OK
   - Scanner un QR → visiter la vitrine → attendre 1 min → refresh dashboard analytics → voir la source apparaître dans le chart
3. **Vérifier que `NEXT_PUBLIC_APP_URL` est bien configuré** (utilisé dans `buildTrackedUrl` fallback)

## Out of scope (lots futurs)

- QR dynamiques (URL modifiable après impression) — nécessiterait redirect Vitrix
- QR avec logo au centre — complexité graphique + libs supplémentaires
- Export ZIP multi-QR pour impression batch
- QR spécifiques à des devis/produits individuels
