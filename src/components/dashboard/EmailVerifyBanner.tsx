"use client";

/**
 * Bannière discrète en tête de dashboard pour rappeler à l'user de vérifier
 * son email (Lot 19).
 *
 * - N'apparaît que si `user.emailVerified === false` (l'AuthContext charge la valeur)
 * - Cacheable via localStorage pour la session (X = pas cette semaine)
 * - Bouton "Renvoyer" appelle /api/auth/verify-email/send
 * - Lien "En savoir plus" → /dashboard/settings?tab=securite
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { AlertCircle, X } from "lucide-react";

const DISMISS_KEY = "vx_verify_dismissed_until";

export function EmailVerifyBanner() {
  const { user } = useAuth();
  const toast = useToast();
  const [dismissed, setDismissed] = useState<boolean>(true); // vrai par défaut (SSR safe)
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const until = Number(window.localStorage.getItem(DISMISS_KEY) || "0");
      setDismissed(until > Date.now());
    } catch {
      setDismissed(false);
    }
  }, []);

  // Guard : n'affiche rien si user pas chargé OU email déjà vérifié OU dismissé
  if (!user || user.emailVerified !== false || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      // Re-afficher dans 7 jours
      const until = Date.now() + 7 * 24 * 60 * 60 * 1000;
      window.localStorage.setItem(DISMISS_KEY, String(until));
    } catch {
      /* noop */
    }
  }

  async function resend() {
    setSending(true);
    try {
      const res = await fetch("/api/auth/verify-email/send", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      if (data.alreadyVerified) {
        toast.info("Votre email est déjà vérifié — rafraîchissez la page.");
      } else {
        toast.success("Email envoyé. Vérifiez votre boîte mail.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-900/20 sm:flex-row sm:items-center sm:gap-4"
    >
      <AlertCircle
        className="h-5 w-5 shrink-0 text-amber-500 dark:text-amber-400"
        aria-hidden="true"
      />
      <p className="flex-1 text-sm text-amber-800 dark:text-amber-200">
        Vérifiez votre adresse email <span className="font-medium">{user.email}</span> pour activer
        toutes les fonctionnalités.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={resend}
          disabled={sending}
          className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-60"
        >
          {sending ? "Envoi…" : "Renvoyer"}
        </button>
        <Link
          href="/dashboard/settings?tab=securite"
          className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-transparent dark:text-amber-200 dark:hover:bg-amber-900/30"
        >
          Détails
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Ne plus afficher cette semaine"
          className="rounded-lg p-1.5 text-amber-600 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/30"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
