"use client";

/**
 * Lightbox photos vitrine (Lot 23).
 *
 * Zero dépendance NPM (pas de yet-another-react-lightbox — trop lourd pour
 * ~10 photos). Fait maison ~150 lignes :
 *  - Overlay full-screen noir
 *  - Navigation flèches gauche/droite (clavier + boutons)
 *  - Fermeture Escape ou clic-outside
 *  - Swipe tactile mobile (touchstart/touchend, seuil 50px)
 *  - Support vidéo (YouTube/Vimeo/URL brute) + image
 *  - Compteur "3 / 12"
 *  - Scroll lock + focus restore (comme Modal Lot 4)
 *  - A11y : role="dialog", aria-modal, aria-labelledby
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import NextImage from "next/image";

export interface LightboxItem {
  id: string;
  type: "image" | "video";
  url: string;
  thumbnailUrl?: string | null;
  title?: string | null;
}

interface Props {
  items: LightboxItem[];
  /** Index initial (0-based). null = fermé */
  startIndex: number | null;
  onClose: () => void;
}

/** Extrait un ID YouTube depuis une URL variée (youtu.be, youtube.com/watch, embed). */
function youtubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

/** Extrait un ID Vimeo depuis vimeo.com/12345 ou player.vimeo.com/video/12345. */
function vimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

export function Lightbox({ items, startIndex, onClose }: Props) {
  const [index, setIndex] = useState(startIndex ?? 0);
  const touchStartX = useRef<number | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // Reset index quand on rouvre sur un nouveau start
  useEffect(() => {
    if (startIndex !== null) setIndex(startIndex);
  }, [startIndex]);

  const isOpen = startIndex !== null && items.length > 0;

  const goPrev = useCallback(
    () => setIndex((i) => (i - 1 + items.length) % items.length),
    [items.length]
  );
  const goNext = useCallback(
    () => setIndex((i) => (i + 1) % items.length),
    [items.length]
  );

  // Clavier + scroll lock + focus restore
  useEffect(() => {
    if (!isOpen) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      restoreFocusRef.current?.focus?.();
    };
  }, [isOpen, onClose, goPrev, goNext]);

  if (!isOpen) return null;

  const current = items[index];

  // Handlers swipe tactile
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 50) return; // seuil pour éviter les faux swipes
    if (dx > 0) goPrev();
    else goNext();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={current.title || "Galerie"}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Bouton fermer */}
      <button
        type="button"
        aria-label="Fermer la galerie"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white backdrop-blur transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>

      {/* Compteur */}
      <div className="absolute left-4 top-4 z-10 rounded-full bg-white/10 px-3 py-1 text-xs text-white backdrop-blur">
        {index + 1} / {items.length}
      </div>

      {/* Précédent */}
      {items.length > 1 && (
        <button
          type="button"
          aria-label="Image précédente"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          className="absolute left-2 z-10 rounded-full bg-white/10 p-3 text-white backdrop-blur transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:left-4"
        >
          <ChevronLeft className="h-6 w-6" aria-hidden="true" />
        </button>
      )}

      {/* Suivant */}
      {items.length > 1 && (
        <button
          type="button"
          aria-label="Image suivante"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          className="absolute right-2 z-10 rounded-full bg-white/10 p-3 text-white backdrop-blur transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-4"
        >
          <ChevronRight className="h-6 w-6" aria-hidden="true" />
        </button>
      )}

      {/* Contenu (clic à l'intérieur ne ferme pas) */}
      <div
        className="relative flex h-full w-full max-w-6xl items-center justify-center p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {current.type === "video" ? (
          <MediaVideo url={current.url} title={current.title} />
        ) : (
          <div className="relative h-full max-h-[85vh] w-full">
            <NextImage
              src={current.url}
              alt={current.title || `Image ${index + 1}`}
              fill
              sizes="100vw"
              className="object-contain"
              priority
            />
          </div>
        )}
      </div>

      {/* Légende */}
      {current.title && (
        <p className="absolute bottom-4 left-1/2 z-10 max-w-[90%] -translate-x-1/2 truncate rounded-full bg-white/10 px-4 py-2 text-center text-sm text-white backdrop-blur">
          {current.title}
        </p>
      )}
    </div>
  );
}

/** Vidéo : YouTube, Vimeo ou URL brute (mp4/webm). */
function MediaVideo({ url, title }: { url: string; title?: string | null }) {
  const yt = youtubeId(url);
  const vm = vimeoId(url);

  if (yt) {
    return (
      <iframe
        className="aspect-video h-auto w-full max-w-4xl rounded-xl"
        src={`https://www.youtube.com/embed/${yt}?rel=0`}
        title={title || "Vidéo YouTube"}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }
  if (vm) {
    return (
      <iframe
        className="aspect-video h-auto w-full max-w-4xl rounded-xl"
        src={`https://player.vimeo.com/video/${vm}`}
        title={title || "Vidéo Vimeo"}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    );
  }
  // URL brute (mp4, webm…) → <video> natif
  return (
    <video
      src={url}
      controls
      className="max-h-[85vh] w-full max-w-4xl rounded-xl"
      title={title || undefined}
    />
  );
}

// Export interne des helpers pour tests
export const __lightboxInternals = { youtubeId, vimeoId };
