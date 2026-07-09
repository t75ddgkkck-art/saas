"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Wrapper autour de next/image avec :
 *  - Fallback silencieux si l'URL est absente ou 404
 *  - Placeholder blur automatique pour images distantes (via BLUR_PLACEHOLDER)
 *  - Format AVIF/WebP auto (déjà géré par next.config formats)
 *
 * Utile pour les cover images, logos et galerie où l'URL peut être null
 * ou pointer vers un domaine tiers qui tombe.
 */

// Data-URI d'un placeholder 1×1 gris — suffit à Next.js pour blur-up
const BLUR_PLACEHOLDER =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxIDEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNlMmU4ZjAiLz48L3N2Zz4=";

type Props = Omit<ImageProps, "src" | "alt" | "onError"> & {
  src?: string | null;
  alt: string;
  /** Rendu si src absent ou erreur (fallback UI custom). */
  fallback?: React.ReactNode;
};

export function OptimizedImage({
  src,
  alt,
  fallback = null,
  className,
  placeholder = "blur",
  blurDataURL = BLUR_PLACEHOLDER,
  ...rest
}: Props) {
  const [errored, setErrored] = useState(false);

  if (!src || errored) return <>{fallback}</>;

  return (
    <Image
      src={src}
      alt={alt}
      onError={() => setErrored(true)}
      placeholder={placeholder}
      blurDataURL={blurDataURL}
      className={cn(className)}
      {...rest}
    />
  );
}
