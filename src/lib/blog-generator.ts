// Générateur d'articles de blog optimisés SEO par métier
// Articles 100% sans fautes d'orthographe, structurés, avec mots-clés

export interface BlogArticle {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  keywords: string[];
}

// Articles génériques SEO valables pour tous les métiers (complètent jusqu'à 3 minimum)
const genericArticles: BlogArticle[] = [
  {
    title: "Comment bien choisir son artisan : 5 critères essentiels",
    slug: "bien-choisir-son-artisan",
    excerpt:
      "Assurances, avis, devis détaillé... Voici les points à vérifier avant de confier vos travaux à un professionnel.",
    category: "general",
    keywords: ["artisan", "choisir", "devis", "assurance", "avis clients"],
    content: `# Comment bien choisir son artisan : 5 critères essentiels

Confier ses travaux à un professionnel est une décision importante. Voici les cinq critères à vérifier avant de vous engager.

## 1. Les assurances et certifications

Un artisan sérieux dispose d'une assurance responsabilité civile professionnelle et, pour les travaux de construction, d'une garantie décennale. N'hésitez pas à demander les attestations.

## 2. Les avis clients authentiques

Consultez les avis en ligne, en privilégiant les plateformes qui vérifient leur authenticité. Un professionnel avec des avis réguliers et détaillés est généralement fiable.

## 3. Un devis détaillé et transparent

Le devis doit préciser chaque prestation, les matériaux utilisés et les délais. Méfiez-vous des devis trop vagues ou anormalement bas.

## 4. La réactivité et la communication

Un professionnel qui répond rapidement et clairement à vos questions sera généralement aussi rigoureux dans son travail.

## 5. Le numéro SIRET

Vérifiez que l'entreprise est bien déclarée. C'est une garantie de sérieux et un recours en cas de litige.

**Besoin d'un professionnel de confiance ? Contactez-nous pour un devis gratuit.**`,
  },
  {
    title: "Pourquoi demander un devis avant tous travaux ?",
    slug: "pourquoi-demander-un-devis",
    excerpt:
      "Le devis protège le client comme le professionnel. Découvrez ce qu'il doit contenir et pourquoi il est indispensable.",
    category: "general",
    keywords: ["devis", "travaux", "obligation", "prix", "protection"],
    content: `# Pourquoi demander un devis avant tous travaux ?

Le devis n'est pas une simple formalité : c'est un document qui protège à la fois le client et le professionnel.

## Une obligation légale dans de nombreux cas

En France, le devis est obligatoire pour les travaux dont le montant dépasse 150 euros. Il doit être daté, signé et mentionner le détail des prestations.

## Ce qu'un bon devis doit contenir

- L'identité complète de l'entreprise (nom, adresse, SIRET)
- Le détail de chaque prestation avec les quantités
- Les prix unitaires et le montant total (HT et TTC)
- La durée de validité de l'offre
- Les délais d'exécution

## Un engagement réciproque

Une fois signé, le devis engage les deux parties : le professionnel sur le prix et les prestations, le client sur le paiement.

**Demandez votre devis gratuit directement depuis notre page : réponse sous 24 à 48 heures.**`,
  },
  {
    title: "Entretien de votre logement : le calendrier des vérifications annuelles",
    slug: "calendrier-entretien-logement",
    excerpt:
      "Chauffage, plomberie, électricité, toiture : voici les vérifications à programmer chaque année pour éviter les mauvaises surprises.",
    category: "general",
    keywords: ["entretien", "logement", "maintenance", "prévention", "vérifications"],
    content: `# Entretien de votre logement : le calendrier des vérifications annuelles

Un logement bien entretenu, c'est moins de pannes, moins de dépenses imprévues et une meilleure valeur à la revente.

## Au printemps

- Vérification de la toiture après l'hiver (tuiles, gouttières)
- Nettoyage des systèmes de ventilation
- Contrôle des joints de fenêtres

## En été

- Entretien de la climatisation
- Travaux de peinture extérieure (météo favorable)
- Vérification des installations extérieures

## À l'automne

- Entretien annuel de la chaudière (obligatoire)
- Purge des radiateurs
- Nettoyage des gouttières avant les pluies

## En hiver

- Surveillance des canalisations exposées au gel
- Contrôle des détecteurs de fumée
- Vérification de l'isolation

**Programmez vos vérifications annuelles avec un professionnel : prenez rendez-vous directement en ligne.**`,
  },
];

export const generateBlogArticles = (category: string): BlogArticle[] => {
  const articles: Record<string, BlogArticle[]> = {
    plombier: [
      {
        title: "5 signes qui montrent que votre plomberie doit être rénovée",
        slug: "5-signes-renovation-plomberie",
        excerpt:
          "Vous pensez que votre plomberie vieillit ? Voici les signes qui ne trompent pas et quand il faut agir.",
        category: "plombier",
        keywords: ["plomberie", "rénovation", "fuite", "tuyaux", "diagnostic"],
        content: `# 5 signes qui montrent que votre plomberie doit être rénovée

Votre plomberie est un élément essentiel de votre maison. Avec le temps, elle s'use et peut causer des problèmes coûteux si on ne la remplace pas à temps. Voici 5 signes qui indiquent qu'il est temps de rénover votre plomberie.

## 1. Une baisse de pression d'eau

Si le débit de vos robinets diminue progressivement, cela peut indiquer une accumulation de calcaire ou de rouille dans vos tuyaux. Ce problème est fréquent dans les installations anciennes.

## 2. Des fuites répétées

Des fuites qui reviennent au même endroit sont souvent le signe de tuyaux corrodés ou fissurés. Ne les ignorez pas, car elles peuvent causer des dégâts importants.

## 3. Une eau décolorée

Une eau jaune ou marron au robinet indique souvent une corrosion interne des tuyaux. C'est un signe qu'il faut agir rapidement.

## 4. Des bruits inhabituels

Des sifflements ou des coups de bélier réguliers signalent un problème de pression ou des tuyaux endommagés.

## 5. L'âge de votre installation

Au-delà de 30-40 ans, il est recommandé de faire inspecter votre plomberie par un professionnel.

**N'hésitez pas à nous contacter pour un diagnostic gratuit de votre installation.**`,
      },
    ],
    electricien: [
      {
        title: "Mettre son installation électrique aux normes : pourquoi et comment",
        slug: "mettre-installation-electrique-aux-normes",
        excerpt:
          "Une installation aux normes garantit votre sécurité. Découvrez les étapes clés de la mise aux normes NF C 15-100.",
        category: "electricien",
        keywords: ["électricité", "normes", "sécurité", "tableau électrique", "diagnostic"],
        content: `# Mettre son installation électrique aux normes

La norme NF C 15-100 encadre les installations électriques en France. Elle évolue régulièrement pour garantir la sécurité des personnes et des biens.

## Pourquoi se mettre aux normes ?

- **Sécurité** : Réduire les risques d'incendie et d'électrocution
- **Assurance** : Votre habitation doit être aux normes pour être couverte
- **Vente** : Un diagnostic électrique est obligatoire pour la vente d'un bien de plus de 15 ans

## Les points clés de la norme

1. **Tableau électrique** : Disjoncteurs différentiels 30mA par circuit
2. **Prises** : Minimum 6 prises par pièce principale, 2 par pièce secondaire
3. **Mise à la terre** : Obligatoire sur tous les circuits
4. **Salle de bain** : Volumes de protection spécifiques

**Contactez-nous pour un diagnostic de votre installation électrique.**`,
      },
    ],
    coiffeur: [
      {
        title: "Les tendances coiffure 2025 : ce qu'il faut savoir",
        slug: "tendances-coiffure-2025",
        excerpt:
          "Découvrez les coupes et couleurs qui feront sensation cette année. Du bob français au balayage miel.",
        category: "coiffeur",
        keywords: ["coiffure", "tendances", "coupe", "coloration", "2025"],
        content: `# Les tendances coiffure 2025

L'année 2025 apporte son lot de nouveautés en matière de coiffure. Voici les tendances incontournables.

## Le Bob Français

Plus court à l'arrière, plus long devant, le bob français est LA coupe star de 2025. Il se porte avec des ondulations naturelles pour un effet effortless.

## Le Balayage Miel

Des reflets dorés et chauds qui illuminent le visage. Parfait pour les cheveux bruns qui veulent du soleil dans leur chevelure.

## Le Shag 70's

La coupe shag revient en force avec ses nombreuses couches et son volume naturel. Un look rétro et moderne à la fois.

**Réservez votre créneau dès maintenant pour un changement de look !**`,
      },
    ],
  };

  const specific = articles[category] || [];
  // Compléter avec les articles génériques pour avoir au moins 3 modèles
  const combined = [...specific, ...genericArticles];
  return combined;
};
