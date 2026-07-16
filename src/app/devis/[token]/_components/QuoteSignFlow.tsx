/**
 * F8 (Lot 38) — <QuoteSignFlow> : UI complète de signature devis pour le client.
 *
 * 3 états :
 *  1. loading — fetch peek du devis
 *  2. preview — devis affiché + bouton "Signer"
 *  3. signed — confirmation, "Merci !"
 *
 * Signature = typed name + checkbox CGV. Dessin canvas optionnel via
 * <SignaturePad> déjà existant.
 */

"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertCircle, ShieldCheck, Building2, User2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { SignaturePad } from "@/components/ui/SignaturePad";

interface QuoteData {
  ok: boolean;
  quote?: {
    id: string;
    number: string;
    title: string;
    description: string | null;
    subtotal: string | null;
    tax: string | null;
    total: string | null;
    depositAmount: string | null;
    validUntil: string | null;
    termsAndConditions: string | null;
    status: string;
    alreadySigned: boolean;
    signedAt: string | null;
  };
  items?: {
    id: string;
    description: string;
    quantity: number;
    unitPrice: string;
    total: string;
  }[];
  client?: { firstName: string | null; lastName: string | null; email: string | null };
  business?: {
    name: string;
    address: string | null;
    city: string | null;
    postalCode: string | null;
    phone: string | null;
    email: string | null;
    siret: string | null;
  };
}

export function QuoteSignFlow({ token }: { token: string }) {
  const [data, setData] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSignPad, setShowSignPad] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [typedName, setTypedName] = useState("");
  const [email, setEmail] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [signed, setSigned] = useState(false);
  // Lot 43 : URL Checkout Stripe renvoyée par POST /api/quotes/sign quand
  // un acompte est demandé. Si présent → écran de redirection avant "Merci".
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [depositCents, setDepositCents] = useState<number | null>(null);
  const toast = useToast();

  useEffect(() => {
    void fetch(`/api/quotes/sign?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d: QuoteData) => {
        setData(d);
        // Pré-remplit email + nom du client si dispo
        if (d.ok && d.client?.email) setEmail(d.client.email);
        if (d.ok && d.client) {
          setTypedName([d.client.firstName, d.client.lastName].filter(Boolean).join(" ") || "");
        }
      })
      .catch(() => setData({ ok: false }))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!typedName.trim() || !email.trim() || !acceptTerms) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/quotes/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          typedName: typedName.trim(),
          email: email.trim().toLowerCase(),
          acceptTerms: true,
          signatureDataUrl: signatureDataUrl ?? undefined,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.ok) {
        toast.error(result.error ?? "Impossible de signer");
        return;
      }
      // Lot 43 : si un acompte peut être encaissé, on affiche l'écran de
      // redirection Stripe AVANT le "Merci". Sinon on passe directement à signé.
      if (result.checkoutUrl) {
        setCheckoutUrl(result.checkoutUrl);
        setDepositCents(result.depositAmountCents ?? null);
        setSigned(true); // on considère le devis signé (c'est fait en DB)
      } else {
        setSigned(true);
      }
    } catch {
      toast.error("Erreur réseau, réessayez");
    } finally {
      setSubmitting(false);
    }
  }

  // Lot 43 : auto-redirection Stripe après 4s pour laisser lire le message.
  // Le client peut cliquer "Payer maintenant" avant si impatient.
  useEffect(() => {
    if (!checkoutUrl) return;
    const t = setTimeout(() => {
      window.location.href = checkoutUrl;
    }, 4000);
    return () => clearTimeout(t);
  }, [checkoutUrl]);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-hidden />
      </div>
    );
  }

  if (!data?.ok || !data.quote) {
    return (
      <Card>
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 text-red-600">
          <AlertCircle className="h-7 w-7" aria-hidden />
        </div>
        <h1 className="mb-2 text-xl font-semibold text-slate-900 dark:text-white">
          Lien invalide ou expiré
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Ce devis n&apos;est plus accessible via ce lien. Demandez à votre professionnel de vous en
          envoyer un nouveau.
        </p>
      </Card>
    );
  }

  // Lot 43 : écran intermédiaire "devis signé + acompte à payer"
  // Prend le pas sur le "Merci" simple si l'API a renvoyé un checkoutUrl.
  if (checkoutUrl) {
    const eur = depositCents ? (depositCents / 100).toFixed(2) : null;
    return (
      <Card>
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600">
          <CheckCircle2 className="h-7 w-7" aria-hidden />
        </div>
        <h1 className="mb-2 text-xl font-semibold text-slate-900 dark:text-white">
          Devis signé ✍️
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Dernière étape : verrouiller votre créneau avec un acompte
          {eur ? (
            <>
              {" "}
              de <strong>{eur} €</strong>
            </>
          ) : null}
          .
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Redirection automatique vers le paiement sécurisé Stripe…
        </p>
        <a
          href={checkoutUrl}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Payer l&apos;acompte maintenant
        </a>
        <p className="mt-3 text-xs text-slate-400">
          Paiement par carte via Stripe. L&apos;acompte sera déduit du montant final.
        </p>
      </Card>
    );
  }

  if (data.quote.alreadySigned || signed) {
    return (
      <Card>
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600">
          <CheckCircle2 className="h-7 w-7" aria-hidden />
        </div>
        <h1 className="mb-2 text-xl font-semibold text-slate-900 dark:text-white">
          Devis signé ✍️
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Merci ! {data.business?.name} a été notifié et vous recontactera prochainement.
        </p>
        {data.quote.signedAt && (
          <p className="mt-2 text-xs text-slate-500">
            Signé le {new Date(data.quote.signedAt).toLocaleString("fr-FR")}
          </p>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header : business + client */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <InfoCard icon={<Building2 className="h-4 w-4" />} title="De">
          <p className="font-semibold text-slate-900 dark:text-white">{data.business?.name}</p>
          {data.business?.address && (
            <p className="text-xs text-slate-500">
              {data.business.address}
              {data.business.city ? `, ${data.business.city}` : ""}
              {data.business.postalCode ? ` ${data.business.postalCode}` : ""}
            </p>
          )}
          {data.business?.siret && (
            <p className="text-xs text-slate-500">SIRET : {data.business.siret}</p>
          )}
        </InfoCard>
        <InfoCard icon={<User2 className="h-4 w-4" />} title="Pour">
          <p className="font-semibold text-slate-900 dark:text-white">
            {[data.client?.firstName, data.client?.lastName].filter(Boolean).join(" ") || "Vous"}
          </p>
          {data.client?.email && <p className="text-xs text-slate-500">{data.client.email}</p>}
        </InfoCard>
      </div>

      {/* Devis */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Devis N° {data.quote.number}
            </p>
            <h2 className="mt-0.5 text-xl font-bold text-slate-900 dark:text-white">
              {data.quote.title}
            </h2>
          </div>
          {data.quote.validUntil && (
            <span className="rounded-md bg-amber-100 dark:bg-amber-900/40 px-2 py-1 text-[10px] font-semibold text-amber-900 dark:text-amber-200">
              Valable jusqu&apos;au {data.quote.validUntil}
            </span>
          )}
        </div>

        {data.quote.description && (
          <p className="mb-4 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
            {data.quote.description}
          </p>
        )}

        {/* Table items */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-left">
                <th className="pb-2 font-medium text-slate-600 dark:text-slate-400">Description</th>
                <th className="pb-2 text-right font-medium text-slate-600 dark:text-slate-400">
                  Qté
                </th>
                <th className="pb-2 text-right font-medium text-slate-600 dark:text-slate-400">
                  P.U.
                </th>
                <th className="pb-2 text-right font-medium text-slate-600 dark:text-slate-400">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {(data.items ?? []).map((it) => (
                <tr key={it.id} className="border-b border-slate-100 dark:border-slate-800/60">
                  <td className="py-2 text-slate-900 dark:text-slate-100">{it.description}</td>
                  <td className="py-2 text-right tabular-nums">{it.quantity}</td>
                  <td className="py-2 text-right tabular-nums">
                    {Number(it.unitPrice).toFixed(2)} €
                  </td>
                  <td className="py-2 text-right font-medium tabular-nums">
                    {Number(it.total).toFixed(2)} €
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totaux */}
        <div className="mt-4 space-y-1 border-t border-slate-200 dark:border-slate-800 pt-3 text-sm">
          {data.quote.subtotal && (
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Sous-total</span>
              <span className="tabular-nums">{Number(data.quote.subtotal).toFixed(2)} €</span>
            </div>
          )}
          {data.quote.tax && Number(data.quote.tax) > 0 && (
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>TVA</span>
              <span className="tabular-nums">{Number(data.quote.tax).toFixed(2)} €</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-800">
            <span>Total TTC</span>
            <span className="tabular-nums">{Number(data.quote.total ?? 0).toFixed(2)} €</span>
          </div>
          {data.quote.depositAmount && Number(data.quote.depositAmount) > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              Acompte demandé à la signature :{" "}
              <strong>{Number(data.quote.depositAmount).toFixed(2)} €</strong>
            </p>
          )}
        </div>

        {/* CGV du devis */}
        {data.quote.termsAndConditions && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300">
              Conditions générales
            </summary>
            <p className="mt-2 whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-400">
              {data.quote.termsAndConditions}
            </p>
          </details>
        )}
      </div>

      {/* Formulaire signature */}
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-4"
      >
        <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
          <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden />
          Signature électronique
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Signature légale sécurisée. Vos coordonnées + un horodatage sont enregistrés comme preuve
          d&apos;acceptation.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Votre nom complet"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            required
            autoComplete="name"
            placeholder="Jean Dupont"
          />
          <Input
            label="Votre email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="vous@exemple.com"
          />
        </div>

        {/* Signature dessin optionnelle */}
        {!showSignPad && !signatureDataUrl && (
          <button
            type="button"
            onClick={() => setShowSignPad(true)}
            className="w-full rounded-md border-2 border-dashed border-slate-200 dark:border-slate-700 py-3 text-xs text-slate-500 hover:border-slate-400"
          >
            ✍️ Dessiner ma signature (optionnel — le nom tapé suffit légalement)
          </button>
        )}
        {showSignPad && !signatureDataUrl && (
          <div className="rounded-md border border-slate-200 dark:border-slate-700 p-2">
            <SignaturePad
              width={560}
              height={200}
              onSave={(url: string) => {
                setSignatureDataUrl(url);
                setShowSignPad(false);
              }}
              onCancel={() => setShowSignPad(false)}
            />
          </div>
        )}
        {signatureDataUrl && (
          <div className="rounded-md border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={signatureDataUrl} alt="Signature enregistrée" className="mx-auto h-16" />
            <button
              type="button"
              onClick={() => {
                setSignatureDataUrl(null);
                setShowSignPad(true);
              }}
              className="mt-1 block w-full text-center text-xs text-emerald-700 dark:text-emerald-300 hover:underline"
            >
              Redessiner
            </button>
          </div>
        )}

        <label className="flex cursor-pointer items-start gap-2 rounded-md bg-slate-50 dark:bg-slate-800/50 p-3 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            required
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span>
            J&apos;accepte les conditions ci-dessus et je m&apos;engage à régler le montant de{" "}
            <strong>{Number(data.quote.total ?? 0).toFixed(2)} €</strong> selon les modalités
            convenues avec {data.business?.name}.
          </span>
        </label>

        <Button
          type="submit"
          loading={submitting}
          disabled={!typedName.trim() || !email.trim() || !acceptTerms}
          className="w-full bg-emerald-600 hover:bg-emerald-700"
        >
          <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden />
          Signer ce devis
        </Button>
      </form>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto mt-8 max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center shadow-sm">
      {children}
    </div>
  );
}

function InfoCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-500">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}
