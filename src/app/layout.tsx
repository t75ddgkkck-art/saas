import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr"),
  title: {
    default: "Vitrix - Visibilité & clients pour artisans | Page pro, réservation, devis",
    template: "%s | Vitrix",
  },
  keywords: [
    "vitrine artisan", "page professionnelle artisan", "réservation en ligne artisan",
    "devis en ligne plombier", "site web artisan gratuit", "visibilité artisan",
    "trouver des clients artisan", "plombier", "électricien", "coiffeur", "peintre",
  ],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
  verification: {
    // Renseignez votre code Google Search Console ici après l'avoir obtenu
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
  },
  description: "Augmentez votre visibilité et ramenez plus de clients. Page pro optimisée SEO, réservation en ligne, avis Google authentiques, paiements (Stripe, Apple Pay, espèces). Simple, rapide, efficace.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: "/apple-icon.png",
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Vitrix - Visibilité & clients pour artisans",
    description: "Augmentez votre visibilité et ramenez plus de clients. Page pro SEO, réservation, avis Google, paiements.",
    images: [{ url: "/og-image.svg", width: 1200, height: 630 }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#0f172a" />
      </head>
      <body className="bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100 min-h-screen">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
