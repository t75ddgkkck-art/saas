/**
 * F3 (Lot 31) — Layout de l'espace client final.
 *
 * Layout minimaliste (pas de sidebar dashboard pro).
 * Le header et le footer restent ceux du site public (layout parent).
 * Meta noindex : l'espace client ne doit pas être crawlé.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mon espace client",
  description: "Retrouvez vos rendez-vous, devis et factures.",
  robots: { index: false, follow: false },
};

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto min-h-[70vh] max-w-4xl px-4 py-8 sm:py-12">{children}</div>;
}
