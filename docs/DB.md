# Base de données (Lot 14)

Ce document couvre :
- Convention soft delete
- Triggers `updated_at`
- Contraintes CHECK longueur
- Cascade delete
- Partitionnement `page_visits`
- Backups Supabase

---

## 1. Soft delete (Lot 14.3)

### Tables concernées

| Table | Colonne | Comportement au delete |
|---|---|---|
| `users` | `deleted_at` | Login refusé, session invalidée dans `getCurrentUser` |
| `businesses` | `deleted_at` | Masqué de `/annuaire`, `/[slug]`, `/metier/*`, `/ville/*`, sitemaps |
| `clients` | `deleted_at` | À filtrer dans les listings CRM (à faire) |
| `appointments` | `deleted_at` | À filtrer dans les calendriers (à faire) |
| `quotes` | `deleted_at` | À filtrer dans le listing devis (à faire) |
| `blog_posts` | `deleted_at` | Masqué du blog public + sitemap |

### Utilisation dans le code

```ts
import { markDeleted, markRestored, notDeleted } from "@/lib/soft-delete";

// Soft delete
await db.update(clients).set({ deletedAt: markDeleted() }).where(eq(clients.id, id));

// Restore
await db.update(clients).set({ deletedAt: markRestored() }).where(eq(clients.id, id));

// Lister uniquement les actifs
db.select().from(clients).where(and(
  eq(clients.businessId, bizId),
  notDeleted(clients.deletedAt)
));
```

### Pourquoi ?

- **Restauration accidentelle** (support client)
- **RGPD** : conservation ≠ visibilité. On peut cacher immédiatement, purger vraiment N jours plus tard
- **Audit** : on sait QUAND une donnée a été supprimée
- **Litiges Stripe** : disputes/chargebacks jusqu'à 60j après paiement → besoin des données
- **Obligations comptables** : 10 ans en France (factures) mais anonymisables

### Purge finale

Un cron RGPD (à ajouter au Lot 15) va faire un vrai `DELETE FROM ... WHERE deleted_at < NOW() - INTERVAL '30 days'`.

---

## 2. Triggers `updated_at` automatiques (Lot 14.4)

Avant : la colonne `updated_at` n'était mise à jour QUE si le code Drizzle passait explicitement `updatedAt: new Date()`. En pratique, oublié 8 fois sur 10.

Après : trigger PG générique appliqué à toutes les tables ayant une colonne `updated_at` :

```sql
CREATE FUNCTION public.__vx_set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_<table> BEFORE UPDATE ON public.<table>
  FOR EACH ROW EXECUTE FUNCTION public.__vx_set_updated_at();
```

Le `sql/00_apply_safe.sql` boucle sur `users`, `businesses`, `clients`, `appointments`, `quotes`, `blog_posts`, `services`, `faqs`, `working_hours`, `payments`, `reviews`, `notes`, `quote_items`, `notifications`.

**Effet** : plus jamais un `updated_at` obsolète. Cron `quote-reminders` (WHERE updated_at < now - 7d) fiabilisé.

---

## 3. CHECK longueurs texte (Lot 14.2)

Colonnes `text` sans limite → un user peut coller 1 GB. On applique :

| Table.colonne | Limite chars |
|---|---|
| `clients.notes` | 10 000 |
| `businesses.description` | 5 000 |
| `businesses.service_area` | 2 000 |
| `businesses.address` | 500 |
| `businesses.loyalty_reward` | 1 000 |
| `blog_posts.content` | 50 000 (≈ 8 000 mots) |
| `blog_posts.excerpt` | 500 |
| `notes.content` | 10 000 |

Idempotent via `EXCEPTION WHEN duplicate_object THEN NULL`.

Note : la validation Zod côté API doit également refléter ces limites — sinon l'utilisateur reçoit une erreur DB "check constraint violation" plutôt qu'un message clair. À aligner au fil de l'eau.

---

## 4. Cascade delete (Lot 14.8)

Avant : `businesses.owner_id → users.id` sans cascade → si un user est supprimé, ses businesses deviennent orphelins (FK cassée).

Après :

| FK | Comportement | Justif |
|---|---|---|
| `businesses.owner_id → users` | `CASCADE` | Un user supprimé emporte ses vitrines (RGPD) |
| `appointments.created_by → users` | `SET NULL` | RDV conservés même si l'employé quitte l'équipe |
| `quotes.created_by → users` | `SET NULL` | Idem pour les devis (historique client) |
| `notes.created_by → users` | `CASCADE` | Notes = données personnelles du créateur |

Le `sql/00_apply_safe.sql` recrée les FKs avec la bonne politique. Idempotent.

---

## 5. Duplication enum (Lot 14.1)

Le schéma avait 2 `pgEnum("appointment_status", …)` :
- `appointmentStatusEnum` : `["pending", "confirmed", "cancelled", "completed"]` — utilisé
- `appointmentStatuses` : `["pending", "confirmed", "in_progress", "completed", "cancelled", "no_show"]` — **jamais référencé, supprimé**

Pour ajouter `in_progress` / `no_show` à l'avenir → `ALTER TYPE appointment_status ADD VALUE 'no_show'` (pas un nouveau enum).

---

## 6. Table `analytics` orpheline (Lot 14.6)

La table `analytics` était définie dans `schema.ts` mais **jamais lue/écrite** dans le code. Les vraies stats de visite sont dans `page_visits` (dashboard `/analytics`).

Action : suppression de la définition Drizzle. La table SQL reste en base (pas de `DROP` dans le script safe pour préserver un éventuel historique). Si vraiment inutile → `DROP TABLE public.analytics;` à faire manuellement.

---

## 7. Partitionnement `page_visits` (Lot 14.7)

**Situation** : 1000 vitrines × 100 visites/jour × 365 = 36M rows/an. Devient lent pour agrégats dashboard et lourd à backup.

**Stratégie** : partitionner par mois sur `created_at`.

**Non-automatique dans `00_apply_safe.sql`** — trop invasif. À exécuter manuellement dès que la table dépasse ~5M lignes :

```sql
-- 1. Renommer l'ancienne table
ALTER TABLE public.page_visits RENAME TO page_visits_legacy;

-- 2. Créer la nouvelle table partitionnée
CREATE TABLE public.page_visits (
  id           uuid          DEFAULT gen_random_uuid(),
  business_id  uuid          NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  date         varchar(10)   NOT NULL,
  source       varchar(100)  DEFAULT 'direct',
  device       varchar(20)   DEFAULT 'desktop',
  path         varchar(200),
  created_at   timestamp     NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- 3. Créer les partitions mensuelles pour l'année en cours et la suivante
DO $$
DECLARE
  m timestamp := date_trunc('month', NOW() - INTERVAL '6 months');
  end_m timestamp := date_trunc('month', NOW() + INTERVAL '12 months');
  next_m timestamp;
  part_name text;
BEGIN
  WHILE m < end_m LOOP
    next_m := m + INTERVAL '1 month';
    part_name := 'page_visits_' || to_char(m, 'YYYY_MM');
    EXECUTE format(
      'CREATE TABLE public.%I PARTITION OF public.page_visits FOR VALUES FROM (%L) TO (%L)',
      part_name, m, next_m
    );
    m := next_m;
  END LOOP;
END $$;

-- 4. Index sur la nouvelle table (hérités automatiquement)
CREATE INDEX page_visits_business_date_idx ON public.page_visits (business_id, date);

-- 5. Migrer les données
INSERT INTO public.page_visits SELECT * FROM public.page_visits_legacy;

-- 6. Vérifier + drop
SELECT COUNT(*) FROM public.page_visits;         -- doit égaler legacy
SELECT COUNT(*) FROM public.page_visits_legacy;
DROP TABLE public.page_visits_legacy;
```

**Rotation mensuelle** : un cron mensuel doit créer la partition M+1. Option robuste : extension `pg_partman` (Supabase la supporte).

**Rétention** : DROP les partitions > N mois pour purger l'historique ancien sans lock.

---

## 8. `visits_reset_at` — documentation (Lot 14.5)

Colonne `businesses.visits_reset_at` (nullable timestamp).

**Rôle** : point de référence "à partir de quand compter les visites". Le dashboard analytics ne compte que `WHERE created_at >= businesses.visits_reset_at`.

**Set via** : `DELETE /api/my-availability` (bouton "Réinitialiser mes stats" côté dashboard).

**NULL** = pas de reset → toutes les visites depuis le début.

Le commentaire est maintenant dans `schema.ts`.

---

## 9. Backups Supabase (Lot 14.9)

| Plan Supabase | Backup quotidien | Point-in-time recovery |
|---|---|---|
| Free | ✅ 7 jours | ❌ |
| Pro ($25/mois) | ✅ 7 jours | ✅ 7 jours |
| Team / Enterprise | ✅ 30 jours | ✅ 30 jours |

**Recommandation prod** :
1. Passer Supabase en Pro dès qu'il y a > 10 payants actifs
2. Activer le PITR (paramètres du projet)
3. Faire un `pg_dump` mensuel externe (S3/OVH), en plus, pour ne pas dépendre de Supabase seul
4. Tester une restauration au moins 1× / an (sinon les backups sont théoriques)

Script exemple pour backup externe :

```bash
# Depuis un serveur EU quelconque (Vercel n'expose pas de cron long)
pg_dump "$DATABASE_URL" --format=custom --file=vitrix-$(date +%Y-%m-%d).dump
aws s3 cp vitrix-*.dump s3://vitrix-backups/monthly/
```

À planifier via GitHub Actions (workflow_dispatch mensuel) ou Scaleway/OVH cron.
