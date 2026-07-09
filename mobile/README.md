# ArtisanPro Mobile (React Native + Expo)

Application mobile native pour les artisans.

## Fonctionnalités

- 📱 **Push natif** : notifications pour nouveaux RDV, devis signés, etc.
- 📴 **Mode offline** : consultation des RDV/clients sans connexion
- ⚡ **Sync automatique** : quand la connexion revient

## Installation

```bash
cd mobile
npm install
npx expo start
```

## Structure

```
mobile/
├── App.tsx                 # Entry point + push setup
├── screens/
│   ├── DashboardScreen.tsx
│   ├── AppointmentsScreen.tsx
│   ├── QuotesScreen.tsx
│   └── ClientsScreen.tsx
├── package.json
└── README.md
```

## Push Notifications

Le token Expo est généré au premier lancement et doit être envoyé au serveur :

```ts
const token = await Notifications.getExpoPushTokenAsync();
// POST /api/push/register { token: token.data, userId }
```

## Build

```bash
# iOS
eas build --platform ios

# Android
eas build --platform android
```

## État actuel

Version **MVP fonctionnelle** :
- Navigation entre écrans
- Push configuré
- Données mockées (à connecter à l'API backend)

**TODO** :
- Connexion API réelle (login + fetch RDV/devis/clients)
- Sync offline avec SQLite + WatermelonDB
- Signature électronique mobile
- Scan QR code pour accéder à la page publique
