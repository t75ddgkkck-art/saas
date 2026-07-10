# 🛠️ Améliorations issues de l'audit

Ce document liste **exactement** ce qui a changé. Rapport détaillé dans [`AUDIT_REPORT.md`](./AUDIT_REPORT.md) et [`AUDIT_FULL_V2.md`](./AUDIT_FULL_V2.md).

---

# 🟢 Tour 8 — Lot 8 I18N (multilingue)

## 8.1 — `src/lib/i18n.ts` refondu (source de vérité typée)

Avant : ~25 clés de vitrine + ~40 clés dashboard, dictionnaires inline non typés, aucune interpolation.
Après : **116 clés** unifiées dans un module i18n complet :

- Type `TranslationKey` **dérivé automatiquement** de `TRANSLATIONS.fr` — si tu ajoutes une clé en FR, TS te force à la déclarer partout (ou fallback silencieux sur FR).
- **Interpolation `{name}`** supportée : `t("fr", "emailFooterLegal", { business: "Nathan" })`.
- **Fallback intelligent** : si la clé manque dans en/es/de, on prend la version FR (jamais de clé littérale visible côté user).
- **4 langues** au complet : fr / en / es / de.
- **Catégories de clés** : vitrine CTA, sections, réservation, devis, erreurs génériques, dashboard, éditeur vitrine, accessibilité, emails.

Nouvelles fonctions exportées :
- `t(lang, key, vars?)` — traduction principale typée
- `td(lang, key)` — alias historique (compat dashboard)
- `detectLangFromAcceptLanguage(header)` — parse `Accept-Language`
- `formatLocaleDate(date, lang, opts?)` — format date locale
- `formatLocaleCurrency(amount, lang, currency?)` — format devise locale
- `allKeys()` — liste toutes les clés (utile aux outils)
- Constantes `SUPPORTED_LANGS`, `DEFAULT_LANG`

## 8.2 — Dashboard : `LangContext` enrichi

- `useLang()` expose maintenant `t(key, vars?)` en plus de `td(key)` — permet l'interpolation partout dans le dashboard.
- L'ancien contrat `td` reste identique → **aucune régression**.
- Détection auto de la langue au chargement (voir 8.5).

## 8.3 — Emails multilingues

Nouveau **`src/lib/email-i18n.ts`** avec fonctions `e(lang, key)` + `ei(template, vars)` :

- **7 sujets traduits** (booking, quote, review, reminder…)
- **20+ labels traduits** (Date, Heure, Adresse, Téléphone, "Laisser un avis", "Merci de votre confiance"…)
- **4 langues complètes** avec fallback FR

`EmailTemplates.bookingConfirmationClient` accepte maintenant `lang?: Lang` :
- Sujet, titre, tableau des infos, footer — tout traduit dans la langue passée.
- Le nom du business et les données dynamiques restent inchangés.

`/api/book-appointment` passe `emailLang = business.language || "fr"` — la vitrine anglophone envoie ses confirmations en anglais.

*Les autres templates (`newBookingPro`, `quoteRequestClient`, `newQuoteRequestPro`) restent en FR pour l'instant (utilisés uniquement pour notifier le pro, qui parle presque toujours français dans le contexte Vitrix).*

## 8.4 — Formats date/heure via `formatLocaleDate`

- Nouvel helper `formatLocaleDate(date, lang, opts)` dans `src/lib/i18n.ts`
- `/api/book-appointment` : la date de confirmation utilise maintenant la locale du pro (`business.language`) au lieu de `fr-FR` en dur
- Variable renommée `dateFr` → `dateLocalized` pour refléter le comportement

## 8.5 — Détection auto-langue

**Client (`LangContext`)** :
1. `localStorage.vitrix_lang` (choix explicite précédent)
2. `navigator.language` (préférence navigateur)
3. `business.language` via `/api/my-business` (si connecté et pas de choix précédent)
4. `"fr"` par défaut

**Server (`src/lib/get-lang-from-request.ts` nouveau)** :
1. `preferredLang` argument (ex: langue du business)
2. Header `Accept-Language` du navigateur
3. `"fr"` par défaut

Utilisation dans les Server Components :
```ts
import { getLangFromRequest } from "@/lib/get-lang-from-request";
const lang = await getLangFromRequest(business?.language);
```

## Tests unitaires (+25 : 63 → 88)

Nouveau `tests/unit/i18n.test.ts` — 25 tests couvrant :
- `t()` par langue + fallback FR + interpolation `{var}` + placeholder non substitué
- `td()` alias dashboard
- `detectLangFromAcceptLanguage` (7 cas dont langue non supportée)
- `formatLocaleDate` en fr/en
- `formatLocaleCurrency` en fr/en
- Cohérence dictionnaire : 4 langues, 116+ clés, chaque clé FR a une traduction
- `email-i18n.e()` : subjects (fonctions) + labels (strings)
- `email-i18n.ei()` : interpolation

## Validations finales

```
tsc --noEmit  → 0 erreur
vitest run    → 88/88 tests OK
next build    → Compiled successfully, 42/42 pages, 0 warning
```

## Utilisation

**Vitrine publique** (Server Component) :
```tsx
import { t } from "@/lib/i18n";
<h2>{t(business.language, "hours")}</h2>
```

**Dashboard** (Client Component) :
```tsx
import { useLang } from "@/contexts/LangContext";
const { t, td } = useLang();
<button>{t("book")}</button>
<span>{t("emailFooterLegal", { business: "Nathan" })}</span>
```

**Emails** :
```ts
import { EmailTemplates } from "@/lib/email";
await sendEmail(EmailTemplates.bookingConfirmationClient({
  ...data,
  lang: business.language, // 👈 traduit automatiquement
}));
```

## Reste à faire (roadmap incrémentale)

Les templates emails **pro** (`newBookingPro`, `newQuoteRequestPro`) restent en FR — à traduire quand le premier pro non-francophone s'inscrit. Structure prête : il suffit d'ajouter les sujets/labels dans `email-i18n.ts` et de passer `lang` à ces templates.

Le dashboard utilise déjà `td()` à ~30 % — pour couvrir les 70 % restants (chaînes hardcodées type "Modifier", "Supprimer", "Annuler", "Ajouter", etc.), un pass ciblé sur `dashboard/vitrine/page.tsx` (1085 lignes) serait le plus rentable.

---

# Historique tours précédents

- `8fcc196` — Tour 7 : Lot 6 SEO (sitemap-index paginé, rich snippets, hreflang, slugs)
- `7beadb6` — Tour 6 : Lot 5 perf (ISR, index DB, next/image, next/font, proxy.ts)
- `2c928bb` — Tour 5 : Lot 4 a11y (WCAG AA)
- `5380ed0` — Tour 4 : Lot 3 UI/UX
- `f5b3f2b` — Tour 3 : Lots 1+2 (sécurité + code mort)
- `096b2aa` — Fix SQL tolérant tables absentes
- `89d448b` — SQL idempotent + audit v2
- `e642e8b` — Tour 2 : favicon, Vercel/IONOS
- `4c25f9c` — Tour 1 : sécurité fondamentale
