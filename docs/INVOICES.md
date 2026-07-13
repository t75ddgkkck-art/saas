# Factures (F9 — Lot 42)

Génération automatique de factures PDF post-signature de devis.

## Contexte réglementaire FR

**Article 289 CGI** : toute facture émise doit :

1. Être numérotée dans une **série continue** (aucun trou dans la séquence)
2. Contenir des **mentions obligatoires** (SIRET, TVA, adresse, date, échéance, pénalités de retard)
3. Rester **immuable** une fois émise (une modif = émission d'un avoir)

Vitrix garantit les 3 automatiquement.

## Architecture

```
POST /api/quotes/sign
   ├── signature DB (transaction)
   ├── notif pro (async)
   └── generateInvoiceForSignedQuote(quoteId)  ← fire-and-forget
         ├── check entitlement `invoices.auto_generation`  (Pro+)
         ├── check idempotence (unique quoteId)
         ├── generateInvoiceNumber() [transaction SELECT FOR UPDATE]
         ├── INSERT invoice (status=draft)
         ├── generateInvoicePDF() [jsPDF côté serveur]
         ├── uploadBuffer() [Supabase Storage]
         ├── sendEmailRaw() [Resend + PDF en attachment]
         ├── UPDATE invoice (status=issued, sentAt, pdfUrl)
         └── notifyAsync(invoice.generated)
```

Fire-and-forget = la signature répond au client en < 3s même si l'email tarde.
Si le PDF ou l'email échoue : facture reste en DB status=draft, l'artisan peut
la renvoyer manuellement depuis `/dashboard/invoices`.

## Numérotation sans trou (art. 289 CGI)

`src/lib/invoice-number.ts` — `generateInvoiceNumber(businessId)` :

```sql
BEGIN;
  SELECT invoice_prefix, invoice_counter FROM businesses WHERE id = $1 FOR UPDATE;
  -- ↑ lock la ligne : toute autre transaction concurrente attend ici
  UPDATE businesses SET invoice_counter = counter + 1 WHERE id = $1;
  INSERT INTO invoices (...) VALUES (...);
COMMIT;
```

**Pourquoi FOR UPDATE et pas `nextval()` ?**
Une séquence Postgres bump à chaque `nextval` même si la transaction rollback →
trou dans la série → non conforme. Le FOR UPDATE garantit qu'un rollback rend le
compteur intact.

**Format** : `<prefix><année>-<compteur padStart 4>` → `F-2026-0001`
Préfixe configurable par business (colonne `invoice_prefix`, défaut `F-`).

## Immutabilité (snapshot)

La colonne `invoices.snapshot` (jsonb) contient à l'émission :

- business (nom, adresse, SIRET, IBAN...)
- client (nom, email, adresse...)
- items du devis
- devis (numéro, total, hash signature)

Si l'artisan modifie plus tard son adresse ou le client change d'email : la facture
émise reste identique. Le snapshot est la source de vérité pour :

- Régénérer le PDF à l'identique
- Export comptable
- Preuve en cas de litige

## Table `invoices`

```
id                uuid PK
business_id       uuid FK (cascade)
quote_id          uuid FK (set null, UNIQUE partial : 1 facture / devis)
client_id         uuid FK (set null)
payment_id        uuid FK (set null)
invoice_number    varchar(50) — UNIQUE (business_id, invoice_number)
issue_date        varchar(10) YYYY-MM-DD
due_date          varchar(10)
subtotal, tax, total decimal(10,2)
currency          varchar(3) default 'EUR'
status            enum draft|issued|paid|cancelled
pdf_url           text (Supabase Storage URL)
snapshot          jsonb (immuable)
sent_at, paid_at  timestamp
notes             text
deleted_at        timestamp (soft delete Lot 14)
```

Indexes :
- `invoices_quote_uidx` partial : garantit 1 facture max / devis
- `invoices_business_number_uidx` : unicité numéro / business
- `invoices_business_status_idx` : dashboard "mes factures par statut"
- `invoices_due_status_idx` : cron future relance impayés

## Routes API

- `GET /api/invoices?status=issued&limit=50` — liste
- `GET /api/invoices/[id]` — détail
- `PATCH /api/invoices/[id]` — `{ status: "paid" | "cancelled" }` uniquement

**Interdit** : modifier `total`, `items`, `invoice_number` (immutabilité légale).
Une facture cancelled reste cancelled (émettre un avoir sinon).

## Entitlement

`invoices.auto_generation` — plans `pro | premium`.
Sur Free : la facture n'est PAS générée (no-op silencieux, log info).
La signature du devis reste OK — l'entitlement ne bloque JAMAIS la signature.

## Storage PDF

- **Supabase Storage** (si `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` + `SUPABASE_STORAGE_BUCKET`)
- URL publique : `{bucket}/invoices/{businessId}/{invoiceNumber}.pdf`
- **Fallback base64** interdit en prod pour les PDF (fait exploser la DB)

En dev sans Supabase : `pdf_url` peut être `null`, le PDF est quand même envoyé
en attachment email (Buffer direct).

## Email

Envoi via `sendEmailRaw` avec `attachments: [{ filename, content: Buffer, contentType }]`.
Resend supporte nativement les attachments (< 40 MB total).

Le template email :
- Salutation nominale si `client.firstName`
- Numéro + total + échéance en gras
- Lien direct download PDF si `pdf_url`
- PDF joint dans tous les cas
- Reply-to = email du business (le client peut répondre au pro)

## UI Dashboard

`/dashboard/invoices` :
- Stats en haut (total facturé, encaissé, en attente)
- Filtres 3 boutons : Toutes / Envoyées / Payées
- Actions par ligne : télécharger PDF, marquer payée, annuler
- Gate `<UpgradeGate feature="invoices.auto_generation">` → CTA Pro pour Free

## Idempotence

`generateInvoiceForSignedQuote(quoteId)` peut être appelée N fois pour le même
`quoteId` — elle détecte l'existant via le partial unique index `invoices_quote_uidx`
et retourne `{ ok: true, reason: "already_exists" }`.

Utile pour :
- Rejouer manuellement si l'email a échoué
- Retry en cas de crash entre INSERT invoice et envoi email

## Prochaines évolutions possibles

- Cron relance impayés (J+7, J+15, J+30) sur `WHERE status='issued' AND due_date < today`
- Endpoint `POST /api/invoices/[id]/resend` (bouton "Renvoyer" UI)
- Endpoint `POST /api/invoices/[id]/credit-note` (avoir automatique)
- Webhook Stripe : marquer paid auto si `payment_intent.succeeded` matche `paymentId`
- Export FEC (Fichier des Écritures Comptables) pour l'expert-comptable
