"use client";

/**
 * Page publique : confirmation d'email via token (Lot 19).
 *
 * Lit `?token=<64hex>` puis POST /api/auth/verify-email/confirm en useEffect.
 * On garde POST (pas GET) pour éviter que des bots préfetch consomment le token.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { CheckCircle2, XCircle, Loader2, Store } from "lucide-react";

type Status = "pending" | "ok" | "error";

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<Status>("pending");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function run() {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      if (!token || !/^[0-9a-f]{64}$/.test(token)) {
        setStatus("error");
        setMessage("Lien de vérification invalide.");
        return;
      }
      try {
        const res = await fetch("/api/auth/verify-email/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur");
        setStatus("ok");
        setMessage(data.message || "Email vérifié.");
      } catch (err) {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Erreur");
      }
    }
    void run();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
          <Store className="h-7 w-7" />
        </div>

        {status === "pending" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-slate-500" aria-hidden="true" />
            <h1 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
              Vérification en cours…
            </h1>
          </div>
        )}

        {status === "ok" && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 dark:border-emerald-900 dark:bg-emerald-900/20">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
            <h1 className="mt-4 text-lg font-semibold text-emerald-800 dark:text-emerald-300">
              Email vérifié !
            </h1>
            <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">{message}</p>
            <Link href="/dashboard" className="mt-6 inline-block">
              <Button>Accéder à mon dashboard</Button>
            </Link>
          </div>
        )}

        {status === "error" && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-8 dark:border-red-900 dark:bg-red-900/20">
            <XCircle className="mx-auto h-10 w-10 text-red-500" />
            <h1 className="mt-4 text-lg font-semibold text-red-800 dark:text-red-300">
              Vérification échouée
            </h1>
            <p className="mt-2 text-sm text-red-700 dark:text-red-400">{message}</p>
            <Link href="/dashboard" className="mt-6 inline-block">
              <Button variant="outline">Retour au dashboard</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
