import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/contexts/ThemeContext";
import { ToastProvider } from "@/components/ui/Toast";
import { SkipToContent } from "@/components/layout/SkipToContent";
import { CookieConsent } from "@/components/layout/CookieConsent";
import "./globals.css";

// Préchargement Inter via next/font :
// - Auto self-hosting (aucun fetch runtime vers Google)
// - Subsetting `latin` (réduit ~85% du poids)
// - font-display: swap (aucun FOIT/FOUT)
// - Génère automatiquement --font-inter, exposé via style var + fontFamily
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  preload: true,
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://www.vitrix.fr"),
  title: {
    default: "Vitrix - Visibilité & clients pour artisans | Page pro, réservation, devis",
    template: "%s | Vitrix",
  },
  keywords: [
    "vitrine artisan",
    "page professionnelle artisan",
    "réservation en ligne artisan",
    "devis en ligne plombier",
    "site web artisan gratuit",
    "visibilité artisan",
    "trouver des clients artisan",
    "plombier",
    "électricien",
    "coiffeur",
    "peintre",
  ],
  alternates: {
    canonical: "/",
    // Vitrix étant francophone-first, on déclare fr comme langue principale
    // et x-default pour indiquer aux crawlers qu'il n'y a pas d'URL par langue.
    languages: {
      "x-default": "/",
      fr: "/",
    },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
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
// F6 (Lot 34, B29) : `viewportFit: cover` est OBLIGATOIRE sur iOS pour que
// `env(safe-area-inset-*)` retourne des valeurs non-nulles. Sans ça, la
// PWA en standalone laisse l'encoche masquer les composants fixed en haut/bas.
export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover" as const,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Applique le thème AVANT le first paint pour éviter le FOUC.
            Sûr : lit uniquement localStorage + prefers-color-scheme, aucun input externe. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        {/* F6 (Lot 34) : titre PWA sur home screen iOS */}
        <meta name="apple-mobile-web-app-title" content="Vitrix" />
        {/* Format-detection : évite qu'iOS transforme "01 23..." en lien tel automatique
            (on les rend explicitement avec <a href="tel:"> quand pertinent) */}
        <meta name="format-detection" content="telephone=no" />
        {/* Lot 40 : balises favicon EXPLICITES en dur (belt-and-suspenders vs Next
            metadata qui peut être ignoré par Googlebot dans certains cas).
            Google Search Central 2024 : recommande fortement le link rel="icon" avec
            un .ico multi-résolution (16/32/48) OU un SVG carré avec fond opaque. */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-icon.png" sizes="180x180" />
        <link rel="mask-icon" href="/favicon.svg" color="#0f172a" />
      </head>
      <body className="bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100 min-h-screen">
        <SkipToContent />
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              {children}
              {/* Lot 15.2 : bannière consent cookies, s'auto-cache si déjà répondu */}
              <CookieConsent />
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
