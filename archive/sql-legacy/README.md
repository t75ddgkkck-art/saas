# Archives SQL (legacy)

Ces fichiers étaient à la racine du projet et faisaient **doublon avec Drizzle**.
Ils sont conservés ici pour référence historique mais **ne doivent plus être joués manuellement**.

## Source de vérité actuelle

Le schéma est défini exclusivement dans [`src/db/schema.ts`](../../src/db/schema.ts).
Pour appliquer / mettre à jour la DB :

```bash
npm run db:push        # applique le schéma courant (dev)
npm run db:generate    # génère un fichier de migration versionné
```

## Contenu de l'archive

| Fichier                      | Contenu                        | Statut                            |
| ---------------------------- | ------------------------------ | --------------------------------- |
| `supabase-schema.sql`        | Schéma initial complet         | Remplacé par Drizzle              |
| `sql-migration-complete.sql` | Migration cumulative           | Obsolète                          |
| `sql-migration-update.sql`   | Delta partiel                  | Obsolète                          |
| `sql-fidelite.sql`           | Ajout du programme de fidélité | Intégré au schéma Drizzle         |
| `sql-clean-demo-data.sql`    | Purge des données de démo      | À utiliser manuellement si besoin |

## Purge des données de démo (usage manuel uniquement)

Si vous avez inséré des données de démo à supprimer sur un environnement partagé :

```bash
psql "$DATABASE_URL" -f archive/sql-legacy/sql-clean-demo-data.sql
```

⚠️ **Ne jamais** exécuter en production sans backup préalable.
