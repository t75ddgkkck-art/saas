import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/contexts/ThemeContext";
import { ToastProvider } from "@/components/ui/Toast";
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
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
  },
  description:
    "Augmentez votre visibilité et ramenez plus de clients. Page pro optimisée SEO, réservation en ligne, avis Google authentiques, paiements (Stripe, Apple Pay, espèces). Simple, rapide, efficace.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Vitrix - Visibilité & clients pour artisans",
    description:
      "Augmentez votre visibilité et ramenez plus de clients. Page pro SEO, réservation, avis Google, paiements.",
    type: "website",
    locale: "fr_FR",
    siteName: "Vitrix",
    images: [
      { url: "/og-image.png", width: 1200, height: 630, alt: "Vitrix" },
      // SVG conservé en secondaire pour compat
      { url: "/og-image.svg", width: 1200, height: 630, alt: "Vitrix" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vitrix",
    description: "Visibilité et clients pour artisans",
    images: ["/og-image.png"],
  },
};

// theme-color adaptatif : slate-50 en clair, slate-950 en sombre
// (utilisé par les navigateurs pour colorer la barre système)
export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* Applique le thème AVANT le first paint pour éviter le FOUC.
            Sûr : lit uniquement localStorage + prefers-color-scheme, aucun input externe. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100 min-h-screen">
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>{children}</ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
