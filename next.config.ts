import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Anciennes URLs /p/slug redirigées vers les URLs propres /slug
      { source: "/p/:slug*", destination: "/:slug*", permanent: true },
    ];
  },
};

export default nextConfig;
