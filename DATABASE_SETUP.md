# Configuration de la base de données

Vous avez **2 méthodes** pour créer les tables dans Supabase. Choisissez-en une.

---

## ✅ Méthode 1 (recommandée) : Drizzle Push — Aucun SQL manuel

Depuis votre machine locale, une seule commande crée toutes les tables :

```bash
DATABASE_URL="postgresql://postgres.[REF]:[MOT_DE_PASSE]@aws-0-[REGION].pooler.supabase.com:6543/postgres" npx drizzle-kit push
```

Remplacez `[REF]`, `[MOT_DE_PASSE]` et `[REGION]` par vos valeurs Supabase
(Settings → Database → Connection string → **Transaction**).

**Avantage** : reste synchronisé automatiquement si vous modifiez le schéma plus tard.

---

## ✅ Méthode 2 : SQL direct dans Supabase

1. Ouvrez **Supabase → SQL Editor → New query**
2. Copiez tout le contenu du fichier **`supabase-schema.sql`** (à la racine du projet)
3. Collez-le et cliquez sur **Run**

Le fichier crée :

- **8 types ENUM** (role, subscription, statuts, etc.)
- **24 tables** avec toutes leurs colonnes
- **Toutes les clés étrangères** et contraintes

---

## 📋 Les 24 tables créées

| Catégorie         | Tables                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| **Utilisateurs**  | `users`, `businesses`                                                                          |
| **Page publique** | `working_hours`, `social_links`, `gallery_items`, `faqs`, `reviews`, `page_themes`, `catalogs` |
| **Rendez-vous**   | `availability_slots`, `appointments`, `reminders`                                              |
| **CRM**           | `clients`, `notes`                                                                             |
| **Devis**         | `quotes`, `quote_items`, `quote_attachments`                                                   |
| **Paiements**     | `payments`, `subscriptions`                                                                    |
| **Contenu**       | `blog_posts`, `chat_messages`                                                                  |
| **Analytics**     | `analytics`                                                                                    |
| **PWA / Notifs**  | `notifications`, `push_subscriptions`                                                          |

---

## 🔍 Vérifier que les tables sont créées

Dans Supabase SQL Editor :

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Vous devez voir **24 tables**.

---

## ⚠️ Important pour Supabase

- Utilisez la connection string en mode **Transaction** (port **6543**), pas Session (5432)
- Le mode Transaction (Pooler) est requis pour les environnements serverless (Vercel)
- Row Level Security (RLS) : l'app gère l'authentification côté serveur, vous pouvez laisser RLS désactivé sur ces tables (ou l'activer si vous accédez aussi via l'API Supabase directe)
