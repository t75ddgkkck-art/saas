"use client";

/**
 * Carousel des avis clients (Lot 23).
 *
 * Remplace le rendu "liste verticale" par un carousel horizontal :
 *  - Mobile : 1 avis visible + swipe tactile
 *  - Desktop : 2 puis 3 avis visibles selon largeur (grid CSS scroll-snap)
 *  - Flèches Prev/Next
 *  - Zéro dépendance NPM (scroll-snap CSS + refs)
 *  - A11y : role="region", aria-roledescription="carousel", flèches focusables
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";

export interface CarouselReview {
  id: string;
  clientName: string;
  rating: number;
  comment: string | null;
  createdAt?: string | Date;
  source?: string | null;
}

interface Props {
  reviews: CarouselReview[];
}

export function ReviewsCarousel({ reviews }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  // Recalcule l'état des boutons quand on scrolle
  const updateArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 8);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, [updateArrows, reviews.length]);

  const scrollBy = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    // On scroll d'une "carte" à la fois (largeur d'un enfant)
    const child = el.querySelector<HTMLDivElement>(":scope > *");
    const step = child?.offsetWidth ?? el.clientWidth;
    el.scrollBy({ left: step * dir, behavior: "smooth" });
  };

  if (reviews.length === 0) return null;

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={`${reviews.length} avis clients`}
      className="relative"
    >
      <div
        ref={trackRef}
        className="flex gap-3 overflow-x-auto scroll-smooth pb-2 [scroll-snap-type:x_mandatory] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {reviews.map((r) => (
          <article
            key={r.id}
            className="w-[85%] shrink-0 [scroll-snap-align:start] rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:w-[48%] lg:w-[32%]"
          >
            <div className="flex items-center gap-1" aria-label={`Note ${r.rating} sur 5`}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-slate-300 dark:text-slate-700"}`}
                  aria-hidden="true"
                />
              ))}
            </div>
            {r.comment && (
              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {r.comment}
              </p>
            )}
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium text-slate-700 dark:text-slate-300">{r.clientName}</span>
              {r.source && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
                  {r.source}
                </span>
              )}
            </div>
          </article>
        ))}
      </div>

      {/* Flèches (masquées si un seul avis ne dépasse pas) */}
      {reviews.length > 1 && (
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            aria-label="Avis précédent"
            disabled={!canPrev}
            className="rounded-full border border-slate-200 bg-white p-2 text-slate-600 transition enabled:hover:bg-slate-50 disabled:opacity-40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:enabled:hover:bg-slate-800"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            aria-label="Avis suivant"
            disabled={!canNext}
            className="rounded-full border border-slate-200 bg-white p-2 text-slate-600 transition enabled:hover:bg-slate-50 disabled:opacity-40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:enabled:hover:bg-slate-800"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
