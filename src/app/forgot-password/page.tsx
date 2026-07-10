"use client";

/**
 * Page publique : demande de réinitialisation mot de passe (Lot 19).
 *
 * UX :
 * - Affiche un formulaire minimal (email)
 * - Après submit : message générique "si un compte existe, un email arrive"
 *   (anti-énumération — même réponse que le backend)
 * - Captcha Turnstile si `NEXT_PUBLIC_TURNSTILE_SITE_KEY` défini
 */

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CheckCircle2, Store, ArrowLeft } from "lucide-react";
import { CaptchaWidget } from "@/components/auth/CaptchaWidget";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, captchaToken: captchaToken ?? undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erreur");
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
            <Store className="h-7 w-7" />
          </div>
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Mot de passe oublié
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Entrez votre email, nous vous enverrons un lien de réinitialisation.
          </p>
        </div>

        {sent ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-900 dark:bg-emerald-900/20">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
            <h2 className="mt-4 text-lg font-semibold text-emerald-800 dark:text-emerald-300">
              Vérifiez votre boîte mail
            </h2>
            <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">
              Si un compte est associé à cette adresse, vous allez recevoir un lien
              de réinitialisation dans les prochaines minutes.
            </p>
            <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-400">
              Pensez à vérifier vos spams. Le lien expire dans 1 heure.
            </p>
            <Link href="/login" className="mt-6 inline-block">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour à la connexion
              </Button>
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="vous@exemple.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <CaptchaWidget onToken={setCaptchaToken} />

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" loading={loading}>
              Envoyer le lien
            </Button>

            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
              <Link href="/login" className="font-medium text-slate-900 hover:underline dark:text-slate-100">
                Retour à la connexion
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
