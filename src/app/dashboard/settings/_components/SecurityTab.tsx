"use client";

/**
 * Onglet "Sécurité" du dashboard (Lot 19).
 *
 * Regroupe :
 *  - Statut de vérification email + bouton "renvoyer"
 *  - Changement de mot de passe (ancien + nouveau + confirmation)
 *
 * Toutes les erreurs API remontent en Toast, jamais en alert().
 */

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { CheckCircle2, AlertCircle, Mail, Lock, Eye, EyeOff } from "lucide-react";

interface Props {
  emailVerified: boolean;
  onEmailVerifiedRefresh: () => void;
}

export function SecurityTab({ emailVerified, onEmailVerifiedRefresh }: Props) {
  const toast = useToast();

  // Verify email
  const [verifySending, setVerifySending] = useState(false);
  async function resendVerify() {
    setVerifySending(true);
    try {
      const res = await fetch("/api/auth/verify-email/send", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      if (data.alreadyVerified) {
        toast.info("Votre email est déjà vérifié.");
        onEmailVerifiedRefresh();
      } else {
        toast.success("Email de vérification envoyé. Vérifiez votre boîte mail.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setVerifySending(false);
    }
  }

  // Change password
  const [pwdOld, setPwdOld] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwdNew.length < 8) {
      toast.error("Nouveau mot de passe : 8 caractères minimum");
      return;
    }
    if (pwdNew !== pwdConfirm) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    setPwdSaving(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwdOld, newPassword: pwdNew }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      toast.success("Mot de passe mis à jour.");
      setPwdOld("");
      setPwdNew("");
      setPwdConfirm("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setPwdSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Statut email verified */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <Mail className="h-4 w-4" aria-hidden="true" />
          Adresse email
        </h3>
        {emailVerified ? (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-900/20">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" aria-hidden="true" />
            <p className="text-sm text-emerald-800 dark:text-emerald-300">
              Votre adresse email est vérifiée.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-900/20 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                Votre email n&apos;est pas encore vérifié. Certaines fonctionnalités peuvent être
                limitées.
              </p>
            </div>
            <Button size="sm" variant="outline" loading={verifySending} onClick={resendVerify}>
              Renvoyer l&apos;email
            </Button>
          </div>
        )}
      </section>

      {/* Changement mot de passe */}
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <Lock className="h-4 w-4" aria-hidden="true" />
          Changer mon mot de passe
        </h3>
        <form onSubmit={changePassword} className="space-y-3">
          <Input
            label="Mot de passe actuel"
            type="password"
            autoComplete="current-password"
            value={pwdOld}
            onChange={(e) => setPwdOld(e.target.value)}
            required
          />
          <div className="relative">
            <Input
              label="Nouveau mot de passe"
              type={showPwd ? "text" : "password"}
              autoComplete="new-password"
              value={pwdNew}
              onChange={(e) => setPwdNew(e.target.value)}
              required
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              aria-label={showPwd ? "Masquer" : "Afficher"}
              className="absolute right-3 top-[38px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Input
            label="Confirmer le nouveau mot de passe"
            type={showPwd ? "text" : "password"}
            autoComplete="new-password"
            value={pwdConfirm}
            onChange={(e) => setPwdConfirm(e.target.value)}
            required
            minLength={8}
          />
          <Button type="submit" size="sm" loading={pwdSaving}>
            Mettre à jour
          </Button>
        </form>
      </section>
    </div>
  );
}
