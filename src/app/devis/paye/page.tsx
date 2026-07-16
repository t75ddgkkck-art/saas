/**
 * Lot 43 (F2+F8 fusion) — Page de retour Stripe post-checkout acompte devis.
 *
 * URLs cibles configurées dans POST /api/quotes/sign :
 *  - success : /devis/paye?quote=<id>
 *  - cancel  : /devis/paye?quote=<id>&canceled=1
 *
 * Le webhook Stripe met à jour `quotes.deposit_paid_at` de manière asynchrone.
 * Il peut y avoir un LAG de 1-3 secondes entre le retour Stripe et le webhook.
 * On lit la valeur en DB — si absente et pas cancel → afficher état "en cours",
 * l'utilisateur peut refresh dans 5s.
 *
 * Aucune auth — le devis a déjà été signé, la page est publique et minimale.
 * Noindex pour ne pas exposer d'ID devis à Google.
 */

import type { Metadata } from "next";
import { db } from "@/db";
import { quotes, businesses } from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { CheckCircle2, Clock, XCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Retour de paiement",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function QuoteDepositReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ quote?: string; canceled?: string }>;
}) {
  const sp = await searchParams;
  const quoteId = sp.quote;
  const canceled = sp.canceled === "1";

  // Cas 1 : URL malformée
  if (!quoteId) {
    return (
      <Shell tone="error" icon={<XCircle className="h-7 w-7" />} title="Lien invalide">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Le lien de retour est incomplet. Fermez cette page et retournez à votre email.
        </p>
      </Shell>
    );
  }

  // Cas 2 : Stripe cancel — le client a fermé le checkout sans payer
  if (canceled) {
    return (
      <Shell tone="warn" icon={<XCircle className="h-7 w-7" />} title="Paiement annulé">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Votre devis reste signé. L&apos;acompte n&apos;a pas été prélevé — vous pouvez
          contacter directement le professionnel pour convenir d&apos;un autre mode de paiement.
        </p>
      </Shell>
    );
  }

  // Cas 3 : succès Stripe → on lit le devis en DB.
  // Peut y avoir un lag webhook (1-3s), on affiche un état d'attente si depositPaidAt absent.
  const [row] = await db
    .select({
      quote: quotes,
      bizName: businesses.name,
      bizSlug: businesses.slug,
    })
    .from(quotes)
    .innerJoin(businesses, eq(quotes.businessId, businesses.id))
    .where(eq(quotes.id, quoteId))
    .limit(1);

  if (!row) {
    return (
      <Shell tone="error" icon={<XCircle className="h-7 w-7" />} title="Devis introuvable">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Ce devis n&apos;existe pas ou a été supprimé.
        </p>
      </Shell>
    );
  }

  // Webhook arrivé → deposit_paid_at renseigné = confirmé
  if (row.quote.depositPaidAt) {
    const amount = row.quote.depositAmountCents
      ? (row.quote.depositAmountCents / 100).toFixed(2)
      : row.quote.depositAmount ?? "?";
    return (
      <Shell tone="ok" icon={<CheckCircle2 className="h-7 w-7" />} title="Acompte reçu ✅">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Merci ! Votre acompte de <strong>{amount} €</strong> pour le devis{" "}
          <strong>{row.quote.quoteNumber}</strong> a bien été encaissé.
        </p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {row.bizName} a été notifié et prendra contact avec vous pour la suite.
        </p>
        {row.bizSlug && (
          <Link
            href={`/${row.bizSlug}`}
            className="mt-4 inline-block text-sm text-emerald-600 hover:underline"
          >
            Retour à la page {row.bizName}
          </Link>
        )}
      </Shell>
    );
  }

  // Webhook pas encore arrivé — état transitoire
  return (
    <Shell tone="info" icon={<Clock className="h-7 w-7" />} title="Paiement en cours…">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Votre paiement est en cours de validation par notre partenaire bancaire. Cette page se
        mettra à jour dans quelques secondes.
      </p>
      {/* Meta refresh 5s — ni JS ni framework requis, fonctionne partout */}
      <meta httpEquiv="refresh" content="5" />
    </Shell>
  );
}

function Shell({
  tone,
  icon,
  title,
  children,
}: {
  tone: "ok" | "warn" | "error" | "info";
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  const bg =
    tone === "ok"
      ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600"
      : tone === "warn"
        ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600"
        : tone === "error"
          ? "bg-red-100 dark:bg-red-900/30 text-red-600"
          : "bg-blue-100 dark:bg-blue-900/30 text-blue-600";

  return (
    <div className="mx-auto min-h-screen max-w-3xl bg-slate-50 dark:bg-slate-950 p-3 sm:p-6">
      <div className="mx-auto mt-16 max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center shadow-sm">
        <div
          className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${bg}`}
        >
          {icon}
        </div>
        <h1 className="mb-3 text-xl font-semibold text-slate-900 dark:text-white">{title}</h1>
        {children}
      </div>
    </div>
  );
}
