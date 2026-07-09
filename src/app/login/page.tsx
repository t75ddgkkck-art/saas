"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Store, Loader2, Shield } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Erreur de connexion");

      // ⚠️  Ne PAS stocker l'utilisateur en localStorage : le rôle/plan y serait
      // manipulable. Le AuthContext ré-hydrate via GET /api/auth/session
      // (source de vérité = cookie httpOnly signé).
      // Full navigation pour que le cookie soit pris en compte par le middleware.
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.message || "Erreur de connexion");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
            <Store className="h-7 w-7" />
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Vitrix
          </h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            Connectez-vous à votre espace professionnel
          </p>
        </div>

        {/* Pro badge */}
        <div className="flex items-center justify-center gap-2 rounded-xl bg-blue-50 px-4 py-2 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
          <Shield className="h-4 w-4" />
          Réservé aux professionnels vérifiés
        </div>

        {/* Form */}
        <div className="rounded-2xl border border-slate-200/60 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}
            <Input
              label="Email"
              type="email"
              placeholder="vous@entreprise.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Mot de passe"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button type="submit" className="w-full" loading={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connexion...
                </>
              ) : (
                "Se connecter"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-slate-500 dark:text-slate-400">Pas encore de compte ? </span>
            <Link href="/register" className="font-medium text-slate-900 hover:underline dark:text-slate-100">
              S&apos;inscrire avec mon SIRET
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
