import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ne pas exposer la stack Next.js dans les headers
  poweredByHeader: false,

  // Compression par défaut (déjà activée par Vercel, utile en self-host)
  compress: true,

  // Optimisation des packages fréquemment importés
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns", "recharts"],
  },

  // Images : autoriser les sources externes fréquentes (à ajuster).
  // Ajoutez ici votre bucket Supabase Storage / S3 si vous en utilisez un.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },

  async headers() {
    return [
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
