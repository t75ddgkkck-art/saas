# Sections de la vitrine publique

Composants extraits de `PublicPage.tsx` (fichier historique de ~950 lignes qu'on
découpe progressivement pour retrouver de la vélocité).

## Déjà extraits

- `WorkingHoursCard.tsx` — bloc "Horaires d'ouverture"
- `QrCodeCard.tsx` — carte "QR Code de partage"
- `PublicFooter.tsx` — pied de page + branding

## À extraire ensuite (prochain lot recommandé)

- `PublicHeader.tsx` — cover image + logo + bouton urgence
- `BusinessInfo.tsx` — nom, catégorie, adresse, badges
- `ContactButtons.tsx` — Appeler / WhatsApp / Email / SMS
- `ActionButtons.tsx` — Rendez-vous / Devis / Partager
- `MenuSection.tsx` — carte spécial restaurants
- `ServicesSection.tsx` — Services & tarifs
- `PaymentSection.tsx` — Paiement en ligne (Stripe Connect)
- `LocationSection.tsx` — Adresse + Google Maps embed
- `GallerySection.tsx` — Galerie photos/vidéos
- `ReviewsSection.tsx` — Avis clients + note moyenne
- `FaqSection.tsx` — FAQ
- `SocialLinksSection.tsx` — Liens réseaux sociaux
- `BookingModal.tsx` — Modal de prise de RDV
- `ReviewFormModal.tsx` — Modal "Laisser un avis"
- `QuoteFormModal.tsx` — Modal "Demander un devis"

## Convention

- 1 fichier = 1 composant = 1 section visuelle
- Prop typée (pas de `any`), interface `<Name>Props` exportée
- Aucun state global : tout passe par props
- Composants Client (`"use client"`) car utilisent lucide-react + interactions
