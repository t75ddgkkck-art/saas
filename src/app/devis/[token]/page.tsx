/**
 * F8 (Lot 38) — /devis/[token]
 *
 * Page publique de signature de devis. Aucune auth cookie — le token EST
 * le secret. Design mobile-first (le client signe souvent depuis son
 * téléphone).
 *
 * Noindex pour éviter que Google indexe des devis privés.
 */

import type { Metadata } from "next";
import { QuoteSignFlow } from "./_components/QuoteSignFlow";

export const metadata: Metadata = {
  title: "Signature de devis",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function DevisSignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="mx-auto min-h-screen max-w-3xl bg-slate-50 dark:bg-slate-950 p-3 sm:p-6">
      <QuoteSignFlow token={token} />
    </div>
  );
}
