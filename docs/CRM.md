# CRM & Business (Lot 24)

## 1. Import CSV clients

### Endpoint

`POST /api/clients/import` — multipart form, champ `file`.

### Format attendu

- Encodage UTF-8 (avec ou sans BOM, on gère les 2)
- Séparateur `,`
- Headers case-insensitive, alias FR/EN acceptés :
  - `firstName` / `prénom` / `prenom`
  - `lastName` / `nom`
  - `email` / `mail` / `e-mail`
  - `phone` / `téléphone` / `telephone` / `tel`
  - `address` / `adresse`
  - `notes`
  - `source` (values: `website`, `google`, `referral`, `social`, `other`)

### Comportement

- **Upsert par (business, phone normalisé)** — si un client existe déjà avec le même téléphone, on met à jour ses champs non-vides sans détruire ceux déjà saisis
- Skip silencieux des lignes vides
- Rejet des lignes sans `phone` ni `email` (au moins un requis)
- Rejet des emails malformés
- **Cap 5000 lignes / import** (diviser en plusieurs sinon)
- **Cap 2 MB** taille fichier
- **Rate limit** 3 imports / heure / user

### Réponse

```json
{
  "imported": 42,
  "updated": 8,
  "skipped": 3,
  "totalLines": 53,
  "errors": [
    { "line": 12, "error": "email invalide: foo@bar" },
    { "line": 27, "error": "phone ou email requis" }
  ]
}
```

## 2. Export CSV clients

`GET /api/clients/export` — Rate limit 5/h.

Format : UTF-8 avec BOM (Excel FR ouvre correctement les accents), séparateur `,`, colonnes :
`firstName, lastName, email, phone, address, source, appointmentsCount, quotesCount, noShowsCount, totalSpent, createdAt`

Nom de fichier : `clients-vitrix-YYYY-MM-DD.csv`

## 3. Détection doublons

`GET /api/clients/duplicates` — retourne :

```json
{
  "totalClients": 234,
  "totalDuplicates": 6,
  "groups": [
    {
      "key": "phone:+33612345678",
      "type": "phone",
      "value": "+33612345678",
      "clients": [
        { "id": "...", "firstName": "Alice", "lastName": "Dupont", ... },
        { "id": "...", "firstName": "A.", "lastName": "Dupont", ... }
      ]
    }
  ]
}
```

**Règles** : match exact sur `phone` normalisé OU `email` lowercase. Pas de fuzzy match (fait générer trop de faux positifs — les vrais doublons sont saisis 2× avec les mêmes coordonnées).

**Fusion** (v2, hors Lot 24) : une future route `POST /api/clients/merge` permettra de fusionner 2 clients (garder le plus vieux, transférer RDV+devis+paiements, soft delete l'autre).

## 4. Fiche client détaillée

`GET /api/clients/[id]` retourne :
- Infos client (nom, email, phone, adresse, notes, source, createdAt)
- Historique RDV (avec status incluant `no_show`)
- Historique devis (avec status + total)
- Historique paiements (avec status + type)
- Notes libres (jointes)
- **Agrégats calculés** : totalRevenue (SUM completed), noShows, completedAppointments, totalAppointments, totalQuotes

Page dashboard : `/dashboard/clients/[id]` — layout complet avec KPIs, warning si ≥ 2 no-show, sections tabs pour RDV/devis/paiements/notes, modal édition, bouton suppression soft.

## 5. No-show tracking

- Nouveau status `no_show` dans `appointment_status` enum (ADD VALUE IF NOT EXISTS)
- Nouvelle colonne `clients.no_shows_count integer NOT NULL DEFAULT 0`
- Quand un pro passe un RDV en `no_show` via `PATCH /api/appointments/[id]`, le compteur client est incrémenté (fire-and-forget)
- Dashboard fiche client : **badge orange "Client à risque"** si `noShows >= 2` (recommande demande d'acompte à l'avance)

## 6. Cron relance impayés

`GET /api/cron/payment-reminders` — quotidien à 10h (vercel.json).

**Cible** : `payments.status = 'pending'` depuis >= 7 jours ET `reminder_count < 3`.

**Cadence** :
- J+7 : 1ère relance aimable
- J+15 (soit 8j après la 1ère) : 2ème rappel plus ferme
- J+30 (soit 15j après la 2ème) : dernière avant mise en demeure

**Anti-spam** :
- `payments.last_reminder_at` + `payments.reminder_count` (colonnes ajoutées Lot 24)
- Skip si pas d'email client (l'user peut relancer manuellement)
- Cap dur 3 relances max

**Sécurité** : `CRON_SECRET` obligatoire en prod.

**Templates emails** : intégrés inline dans `src/app/api/cron/payment-reminders/route.ts` (à externaliser dans `email.ts` si on veut personnaliser par pro un jour).

## 7. Colonnes DB ajoutées

Dans `sql/00_apply_safe.sql` (bloc "4quinquies Lot 24") :
- `ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'no_show'`
- `clients.no_shows_count integer NOT NULL DEFAULT 0`
- `payments.last_reminder_at timestamp`
- `payments.reminder_count integer NOT NULL DEFAULT 0`
- Index `payments_reminder_scan_idx` partiel sur `status = 'pending'`

## 8. Actions post-déploiement

1. **Jouer `sql/00_apply_safe.sql`** dans Supabase (~10s, idempotent)
2. **Vérifier `CRON_SECRET`** sur Vercel (le nouveau cron ne s'exécutera qu'avec)
3. Tester import :
   - Créer un fichier `clients.csv` avec headers `firstName,lastName,phone,email`
   - Aller sur `/dashboard/clients` → bouton "Importer CSV" → sélectionner le fichier
   - Vérifier toast succès + reload liste
4. Tester export : bouton "Exporter CSV" → fichier `clients-vitrix-YYYY-MM-DD.csv` téléchargé
5. Créer un RDV, le passer en `no_show` via PATCH direct (l'UI dashboard `/appointments` ne propose que 4 statuses — enrichir plus tard avec un menu déroulant), vérifier fiche client
6. Attendre 7 jours puis vérifier premier email de relance impayé (ou modifier `created_at` d'un paiement pending pour tester immédiatement)
