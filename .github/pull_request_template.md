<!--
  Merci de compléter ce template. Une PR bien décrite = review 3x plus rapide.
  Convention : préfixer le titre par `lot N <domaine>: ...` si c'est un lot d'audit,
  sinon `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.
-->

## Contexte

<!-- Pourquoi cette PR ? Quel problème utilisateur / technique elle résout ? -->

## Changements

<!-- Liste concise des modifications structurantes. Pas besoin de lister chaque fichier. -->

-
-
-

## Tests

- [ ] `npm run typecheck` passe
- [ ] `npm run lint` passe
- [ ] `npm run format:check` passe
- [ ] `npm run test` passe
- [ ] Nouveaux tests unitaires ajoutés (si logique métier)
- [ ] Testé manuellement en local

## Impact

- **DB** : <!-- oui/non — si oui, migration ajoutée dans `sql/00_apply_safe.sql` ? -->
- **Env vars** : <!-- nouvelles variables à ajouter sur Vercel ? -->
- **Breaking change** : <!-- non / oui (préciser) -->
- **Doc mise à jour** : <!-- CHANGELOG_AUDIT.md / docs/... -->

## Checklist sécurité (si touche auth / uploads / API / rate-limit / cookies)

- [ ] Rate-limit ajouté sur les nouvelles routes API publiques
- [ ] Validation Zod des inputs
- [ ] Vérification session / entitlements
- [ ] Pas de secrets committés
- [ ] Headers CSP toujours valides

## Screenshots / vidéos

<!-- Optionnel mais utile pour tout changement UI. -->
