// Blog post templates by trade category
export interface BlogTemplate {
  title: string;
  excerpt: string;
  content: string;
  coverImage: string;
}

export const blogTemplates: Record<string, BlogTemplate[]> = {
  plombier: [
    {
      title: "5 signes qui montrent que votre plomberie doit être rénovée",
      excerpt:
        "Vous pensez que votre plomberie vieillit ? Voici les signes qui ne trompent pas et quand il faut agir.",
      content: `# 5 signes qui montrent que votre plomberie doit être rénovée

Votre plomberie est un élément essentiel de votre maison. Avec le temps, elle s'use et peut causer des problèmes coûteux si on ne la remplace pas à temps. Voici 5 signes qui indiquent qu'il est temps de rénover votre plomberie.

## 1. Une baisse de pression d'eau
Si le débit de vos robinets diminue progressivement, cela peut indiquer une accumulation de calcaire ou de rouille dans vos tuyaux.

## 2. Des fuites répétées
Des fuites qui reviennent au même endroit sont souvent le signe de tuyaux corrodés ou fissurés.

## 3. Une eau décolorée
Une eau jaune ou marron au robinet indique souvent une corrosion interne des tuyaux.

## 4. Des bruits inhabituels
Des sifflements ou des coups de bélier réguliers signalent un problème de pression ou des tuyaux endommagés.

## 5. L'âge de votre installation
Au-delà de 30-40 ans, il est recommandé de faire inspecter votre plomberie par un professionnel.

**N'hésitez pas à nous contacter pour un diagnostic gratuit de votre installation.**`,
      coverImage:
        "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=800&h=400&fit=crop",
    },
    {
      title: "Comment déboucher un évier naturellement : guide complet",
      excerpt:
        "Fini les produits chimiques ! Découvrez nos astuces écologiques pour déboucher votre évier efficacement.",
      content: `# Comment déboucher un évier naturellement

Un évier bouché est un problème courant dans toute maison. Heureusement, il existe plusieurs méthodes naturelles et écologiques pour résoudre ce problème sans produits chimiques agressifs.

## Le mélange bicarbonate + vinaigre

C'est la méthode la plus connue et la plus efficace :
1. Versez 3 cuillères à soupe de bicarbonate de soude dans la canalisation
2. Ajoutez un verre de vinaigre blanc
3. Laissez agir 30 minutes
4. Rincez avec de l'eau bouillante

## Le furet de plomberie

Pour les bouchons plus tenaces, utilisez un furet que vous introduisez dans la canalisation en tournant.

## Quand faire appel à un professionnel ?

Si aucune de ces méthodes ne fonctionne, il est temps de nous contacter. Un bouchon persistant peut cacher un problème plus profond dans vos canalisations.

**Contactez-nous pour une intervention rapide et efficace !**`,
      coverImage: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=400&fit=crop",
    },
  ],

  electricien: [
    {
      title: "Mettre son installation électrique aux normes : pourquoi et comment",
      excerpt:
        "Une installation aux normes garantit votre sécurité. Découvrez les étapes clés de la mise aux normes NF C 15-100.",
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
      coverImage:
        "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&h=400&fit=crop",
    },
  ],

  coiffeur: [
    {
      title: "Les tendances coiffure été 2025 : ce qu'il faut savoir",
      excerpt:
        "Découvrez les coupes et couleurs qui feront sensation cet été. Du bob français au balayage miel.",
      content: `# Les tendances coiffure été 2025

L'été est la saison idéale pour changer de look ! Voici les tendances incontournables cette saison.

## Le Bob Français

Plus court à l'arrière, plus long devant, le bob français est LA coupe star de 2025. Il se porte avec des ondulations naturelles pour un effet effortless.

## Le Balayage Miel

Des reflets dorés et chauds qui illuminent le visage. Parfait pour les cheveux bruns qui veulent du soleil dans leur chevelure.

## Le Shag 70's

La coupe shag revient en force avec ses nombreuses couches et son volume naturel. Un look rétro et moderne à la fois.

**Réservez votre créneau dès maintenant pour un changement de look estival !**`,
      coverImage: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&h=400&fit=crop",
    },
  ],

  peintre: [
    {
      title: "Quelles couleurs choisir pour votre intérieur en 2025 ?",
      excerpt:
        "Terracotta, vert sauge, bleu canard... Découvrez les couleurs tendance pour votre décoration intérieure.",
      content: `# Les couleurs tendance 2025 pour votre intérieur

Chaque année, les tendances couleurs évoluent. Voici les teintes incontournables pour 2025.

## Le Vert Sauge

Un vert doux et apaisant, parfait pour une chambre ou un salon. Il se marie bien avec le bois naturel et le rotin.

## Le Terracotta

Une couleur chaude et terreuse qui apporte du caractère à n'importe quelle pièce. Idéale en accent sur un mur.

## Le Bleu Canard

Élégant et intemporel, le bleu canard est parfait pour une salle de bain ou une entrée.

**Faites appel à nous pour une consultation couleur personnalisée et un devis gratuit.**`,
      coverImage:
        "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=800&h=400&fit=crop",
    },
  ],

  garagiste: [
    {
      title: "L'entretien de votre voiture avant les vacances : checklist indispensable",
      excerpt:
        "Pneus, freins, vidange... Voici la check-list complète pour partir l'esprit tranquille.",
      content: `# Checklist entretien voiture avant les vacances

Partir en vacances sereinement passe par un véhicule en parfait état. Voici les points essentiels à vérifier avant le départ.

## Les pneus

- Vérifiez la pression (y compris la roue de secours)
- Contrôlez l'usure : profondeur minimum 1,6mm
- Regardez l'état des flancs

## Les freins

- Épaisseur des plaquettes (minimum 2mm)
- Niveau et qualité du liquide de frein

## La vidange

- Dernière vidange il y a moins de 15 000 km ou 1 an
- Vérification du niveau d'huile

**Passez au garage pour un check-up complet avant les vacances ! Réservation rapide et devis gratuit.**`,
      coverImage:
        "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=800&h=400&fit=crop",
    },
  ],
};

export function getBlogTemplates(category: string): BlogTemplate[] {
  return (
    blogTemplates[category] || [
      {
        title: "Bien choisir son professionnel : 5 critères essentiels",
        excerpt:
          "Comment trouver le bon prestataire pour vos travaux ? Voici nos conseils pour faire le meilleur choix.",
        content: `# Bien choisir son professionnel : 5 critères essentiels

Trouver le bon professionnel pour vos travaux n'est pas toujours facile. Voici 5 critères à vérifier avant de vous engager.

## 1. Les certifications et assurances

Un bon professionnel doit avoir une assurance décennale et des certifications reconnues.

## 2. Les avis clients

Consultez les avis en ligne et n'hésitez pas à demander des références.

## 3. Le devis détaillé

Un devis sérieux doit être détaillé, avec le prix de chaque prestation.

## 4. La réactivité

Un professionnel sérieux répond rapidement à vos demandes.

## 5. Le rapport qualité/prix

Ne choisissez pas uniquement sur le prix. La qualité du travail est primordiale.

**Nous cumulons tous ces critères. N'hésitez pas à nous contacter pour un devis gratuit !**`,
        coverImage:
          "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&h=400&fit=crop",
      },
    ]
  );
}
