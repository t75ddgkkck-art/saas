# SQL — DB Vitrix

Deux scripts, à jouer sur **Supabase → SQL Editor → New query** (ou via `psql`) :

## 1. Vérification (lecture seule)

```bash
psql "$DATABASE_URL" -f sql/01_check.sql
```

Retourne 5 blocs de résultats :
- Tables présentes
- Colonnes attendues manquantes
- Valeurs d'enum manquantes
- Index recommandés manquants
- Stats globales

**Rien n'est modifié.** À exécuter d'abord pour voir ce qui manque.

## 2. Application idempotente (safe)

```bash
psql "$DATABASE_URL" -f sql/00_apply_safe.sql
```

- Aucun `DROP`, aucun `TRUNCATE`, aucune perte de données possible.
- Toutes les instructions utilisent `IF NOT EXISTS` / `DO $$` / `ADD COLUMN IF NOT EXISTS`.
- Peut être **rejoué N fois** sans effet secondaire.
- Ajoute les extensions (`pgcrypto`, `uuid-ossp`), les valeurs d'enum manquantes, les colonnes ajoutées récemment, et les **23 index de performance** absents du schéma Drizzle.

À la fin, un `RAISE NOTICE` affiche le nombre de lignes par table principale.

## Source de vérité

Le schéma Drizzle `src/db/schema.ts` reste **la source unique**. En dev local, préférez `npm run db:push`. En prod (Supabase existante), utilisez `sql/00_apply_safe.sql` pour rattraper l'écart sans risque.
