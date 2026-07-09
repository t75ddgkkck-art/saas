# ArtisanPro - Guide de déploiement

## Option 1: Render + Supabase (Recommandé)

### 1. Base de données Supabase

1. Créez un projet sur [supabase.com](https://supabase.com)
2. Allez dans **Settings > Database > Connection string**
3. Copiez la **Transaction** connection string (mode Pooler)
4. Notez le mot de passe que vous avez défini

### 2. Déploiement sur Render

1. Créez un compte sur [render.com](https://render.com)
2. **New > Web Service**
3. Connectez votre repository GitHub
4. Configuration:
   - **Name**: `artisanpro`
   - **Region**: `Frankfurt` (plus proche de l'Europe)
   - **Branch**: `main`
   - **Root Directory**: `.` (laisser vide)
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npx drizzle-kit push && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free` (pour tester) ou `Starter ($7/mo)`

5. **Environment Variables** (ajoutez toutes ces clés):

| Variable | Valeur |
|----------|--------|
| `DATABASE_URL` | `postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres` |
| `NEXT_PUBLIC_APP_URL` | `https://votre-app.onrender.com` (URL Render) |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` (générer localement) |
| `NEXTAUTH_URL` | `https://votre-app.onrender.com` |
| `OPENAI_API_KEY` | `sk-proj-...` (optionnel) |
| `STRIPE_SECRET_KEY` | `sk_live_...` (optionnel) |
| `RESEND_API_KEY` | `re_...` (optionnel) |

6. Cliquez sur **Create Web Service**
7. Attendez le déploiement (~3-5 min)

### 3. Variables minimales requises

Pour un déploiement fonctionnel **minimum**:
```
DATABASE_URL=postgresql://...
NEXT_PUBLIC_APP_URL=https://...
NEXTAUTH_SECRET=...
```

---

## Option 2: Vercel + Supabase

### 1. Base de données Supabase

Même procédure que ci-dessus.

### 2. Déploiement sur Vercel

1. Installez Vercel CLI: `npm i -g vercel`
2. Dans votre projet: `vercel`
3. Ou via l'interface [vercel.com](https://vercel.com):
   - **Add New > Project**
   - Importez votre repo GitHub
   - Vercel détecte automatiquement **Next.js**
   
4. **Environment Variables** (Vercel Dashboard > Settings > Environment):

| Variable | Valeur |
|----------|--------|
| `DATABASE_URL` | `postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres` |
| `NEXT_PUBLIC_APP_URL` | `https://votre-app.vercel.app` |
| `NEXTAUTH_SECRET` | Généré avec `openssl rand -base64 32` |

5. Deploy!

### Configuration Vercel automatique

Vercel détecte automatiquement:
- **Framework**: Next.js 16
- **Build Command**: `next build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

---

## Commandes de génération de clés

```bash
# NEXTAUTH_SECRET
openssl rand -base64 32

# CRON_SECRET
openssl rand -hex 16

# VAPID Keys (pour push notifications)
npx web-push generate-vapid-keys
```

---

## Supabase - Commandes SQL utiles

```sql
-- Vérifier les entreprises
SELECT id, name, slug, category FROM businesses;

-- Vérifier les utilisateurs
SELECT id, email, first_name, role FROM users;

-- Supprimer toutes les données (reset)
TRUNCATE businesses CASCADE;
TRUNCATE users CASCADE;
```

---

## Migration des données

```bash
# Appliquer le schéma sur Supabase
DATABASE_URL=postgresql://... npx drizzle-kit push

# Vérifier la connection
psql "postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres" -c "SELECT 1;"
```

---

## Troubleshooting

### Erreur de connection DB
- Vérifiez que le **Pooler** est activé sur Supabase (Settings > Database > Connection Pooling)
- Utilisez le mode **Transaction** (port 6543), pas Session (port 5432)
- Ajoutez votre IP dans les **Allowed IPs** sur Supabase

### Build échoue sur Render
- Vérifiez que `DATABASE_URL` est correct
- Augmentez la RAM si le build OOM (`Starter` au lieu de `Free`)

### Middleware bloque le dashboard
- Vérifiez que les cookies sont bien définis
- En dev local, utilisez `http://localhost:3000`
- En production, assurez-vous que `NEXTAUTH_URL` correspond au domaine
