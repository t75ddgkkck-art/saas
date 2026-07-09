"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Avatar de business — évite l'emoji 🏪 par défaut peu pro.
 * - Si `logo` fourni : affiche le logo.
 * - Sinon : cercle avec initiales sur un fond dérivé du nom (déterministe).
 */

interface BusinessAvatarProps {
  name: string;
  logo?: string | null;
  size?: number;
  rounded?: "full" | "xl" | "2xl";
  className?: string;
  /** Couleur d'accent pour aligner sur la charte du pro. */
  primaryColor?: string | null;
}

// Palette d'appoint (mêmes teintes que ColorPicker suggestions)
const BG_PALETTE = [
  "#0f172a", // slate
  "#3730a3", // indigo
  "#1d4ed8", // blue
  "#047857", // emerald
  "#166534", // green
  "#991b1b", // red
  "#c2410c", // orange
  "#6d28d9", // violet
  "#be185d", // pink
  "#475569", // slate-medium
];

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function initials(name: string): string {
  const parts = name
    .replace(/[^\p{L}\s]/gu, "")
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function BusinessAvatar({
  name,
  logo,
  size = 80,
  rounded = "2xl",
  className,
  primaryColor,
}: BusinessAvatarProps) {
  const [hasError, setHasError] = useState(false);

  const bg = useMemo(() => {
    if (primaryColor && /^#[0-9a-fA-F]{6}$/.test(primaryColor)) return primaryColor;
    return BG_PALETTE[hash(name) % BG_PALETTE.length];
  }, [name, primaryColor]);

  const chars = useMemo(() => initials(name), [name]);

  const roundedClass =
    rounded === "full" ? "rounded-full" : rounded === "xl" ? "rounded-xl" : "rounded-2xl";

  // Utilise next/image quand un logo est fourni : AVIF/WebP + srcset auto + lazy natif.
  // Fallback initiales si l'URL 404 (via state `errored`).
  // Note : le composant interne gère lui-même le state — voir plus bas.
  if (logo && !hasError) {
    return (
      <Image
        src={logo}
        alt={`Logo ${name}`}
        width={size}
        height={size}
        loading="lazy"
        onError={() => setHasError(true)}
        className={cn("object-cover shadow-sm", roundedClass, className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={`Initiales de ${name}`}
      className={cn(
        "flex select-none items-center justify-center font-bold text-white shadow-sm",
        roundedClass,
        className
      )}
      style={{
        width: size,
        height: size,
        background: bg,
        fontSize: Math.max(14, Math.floor(size * 0.38)),
      }}
    >
      {chars}
    </div>
  );
}
