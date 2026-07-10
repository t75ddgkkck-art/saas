/**
 * F3 (Lot 31) — /mon-compte/login
 *
 * Formulaire magic-link : demande d'email → envoi du lien.
 * Aucun mot de passe. Réponse générique anti-énumération.
 */

"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Mail, CheckCircle2, AlertCircle } from "lucide-react";

function LoginInner() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Message d'erreur venant du callback verify (token invalide)
  const initialError = params.get("error") === "invalid";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/client/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error ?? "Erreur, veuillez réessayer.");
        return;
      }
      setStatus("sent");
    } catch {
      setStatus("error");
      setErrorMsg("Erreur réseau, veuillez réessayer.");
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-7 w-7" aria-hidden />
        </div>
        <h1 className="mb-2 text-xl font-semibold text-slate-900 dark:text-white">
          Vérifiez votre boîte mail
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Si un compte existe pour <strong>{email}</strong>, un lien de connexion vous a été envoyé.
          Cliquez dessus pour vous connecter (valable 15 minutes).
        </p>
        <p className="mt-4 text-xs text-slate-500">
          Pas d&apos;email dans les 5 minutes ? Vérifiez vos spams ou{" "}
          <button
            type="button"
            onClick={() => setStatus("idle")}
            className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            réessayez
          </button>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
          <Mail className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Mon espace client</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Retrouvez vos rendez-vous, devis et factures.
        </p>
      </div>

      {(initialError || status === "error") && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            {errorMsg ??
              "Ce lien est invalide, expiré ou déjà utilisé. Demandez un nouveau lien ci-dessous."}
          </span>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Votre email
          </span>
          <Input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.com"
            className="mt-1"
          />
          <span className="mt-1 block text-xs text-slate-500">
            L&apos;email que vous utilisez pour prendre rendez-vous.
          </span>
        </label>

        <Button
          type="submit"
          className="w-full"
          loading={status === "loading"}
          disabled={!email.trim()}
        >
          Recevoir mon lien de connexion
        </Button>

        <p className="text-center text-xs text-slate-500">
          Pas de mot de passe à retenir · Lien valable 15 min · 100% gratuit
        </p>
      </form>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams doit être wrapé dans Suspense (Next 15+)
  return (
    <Suspense fallback={<div className="text-center text-slate-500">Chargement…</div>}>
      <LoginInner />
    </Suspense>
  );
}
