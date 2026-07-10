"use client";

/**
 * PageTitle — met à jour dynamiquement `document.title` (Lot 22).
 *
 * Les pages dashboard sont toutes en `"use client"`, donc l'export
 * `metadata` de Next ne peut pas être utilisé. On met à jour le titre
 * côté client dans un useEffect — simple, léger, safe SSR.
 *
 * Usage :
 *   <PageTitle title="Rendez-vous" />
 *
 * Le template global "%s | Vitrix" configuré dans app/layout.tsx s'applique
 * automatiquement via document.title (on n'ajoute que le préfixe).
 */

import { useEffect } from "react";

const SUFFIX = " | Vitrix";

export function PageTitle({ title }: { title: string }) {
  useEffect(() => {
    // On garde l'ancien title pour restaurer au unmount (évite un flash
    // de titre bizarre pendant la transition entre 2 pages).
    const previous = typeof document !== "undefined" ? document.title : "";
    document.title = `${title}${SUFFIX}`;
    return () => {
      if (typeof document !== "undefined") document.title = previous;
    };
  }, [title]);

  return null;
}
