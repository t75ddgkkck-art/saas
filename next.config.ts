import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ne pas exposer la stack Next.js dans les headers
  poweredByHeader: false,

  // Compression gzip côté server (redondant avec Vercel/Nginx mais utile en self-host)
  compress: true,

  // Génère des sourcemaps de prod pour Sentry / debug (léger surcoût CI, gros gain support)
  productionBrowserSourceMaps: false, // passer à true si Sentry configuré

  // Tree-shaking agressif sur les gros packages qui exportent des barrels.
  // Réduit typiquement 30-50% du bundle client sur les pages qui importent
  // beaucoup d'icônes ou de composants recharts.
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "recharts",
      "jspdf",
      "jspdf-autotable",
      "@react-navigation/native",
    ],
  },

  // Images : formats modernes (AVIF/WebP), tailles pré-calculées pour srcset
  images: {
    // AVIF en priorité (30% de moins que WebP), fallback WebP puis format d'origine
    formats: ["image/avif", "image/webp"],
    // Tailles utilisées pour srcset auto quand on met `sizes` sur <Image>
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Cache 24h côté CDN Next.js (tokens éphémères)
    minimumCacheTTL: 86400,
    // Sources externes tolérées (Supabase Storage + hosts fréquents)
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },

  async headers() {
    return [
      // Sécurité (déjà géré par middleware, doublé ici pour défense en profondeur)
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self), payment=(self)",
          },
        ],
      },
      // Cache long pour les assets statiques immuables générés par Next
      {
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // Cache long pour les images/icons (contenu déjà versionné dans le nom)
      {
        source: "/icons/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800, immutable" },
        ],
      },
      {
        source: "/(favicon.ico|favicon.svg|apple-icon.png|og-image.png|og-image.svg)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, must-revalidate" },
        ],
      },
    ];
  },

  async redirects() {
    return [
      // Anciennes URLs /p/slug redirigées vers les URLs propres /slug
      { source: "/p/:slug*", destination: "/:slug*", permanent: true },
    ];
  },
};

export default nextConfig;
