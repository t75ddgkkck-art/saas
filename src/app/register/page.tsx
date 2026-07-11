"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import {
  Store,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Shield,
} from "lucide-react";
import { CATEGORIES } from "@/lib/utils";
import { CaptchaWidget } from "@/components/auth/CaptchaWidget";

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [siretStatus, setSiretStatus] = useState<"checking" | "valid" | "invalid" | "idle">("idle");
  const [siretInfo, setSiretInfo] = useState<{ name?: string; address?: string } | null>(null);
  // Lot 18 B9 : capture le code parrain depuis `?ref=VX-XXXXXX` dans l'URL.
  // Lu côté effet pour éviter l'obligation de wrapper la page dans <Suspense>
  // (contrainte de `useSearchParams` sur Next 15+). Décodé pour supporter les
  // codes qui contiendraient des chars encodés.
  const [referralCode, setReferralCode] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get("ref");
      if (raw) {
        const clean = decodeURIComponent(raw).trim().toUpperCase();
        // Format attendu VX-XXXXXX — on n'accepte que ça côté client aussi
        // pour éviter d'envoyer du bruit au backend.
        if (/^VX-[0-9A-Z]{6}$/.test(clean)) {
          setReferralCode(clean);
        }
      }
    } catch {
      /* URL malformée → on ignore silencieusement */
    }
  }, []);
  const [formData, setFormData] = useState({
    // Étape 1 : Compte
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    // Étape 2 : Entreprise
    businessName: "",
    siret: "",
    category: "",
    description: "",
    // Étape 3 : Coordonnées
    phone: "",
    address: "",
    city: "",
    postalCode: "",
  });

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (field === "siret") {
      setSiretStatus("idle");
      setSiretInfo(null);
    }
  };

  const handleSiretCheck = async () => {
    const siret = formData.siret.replace(/\s/g, "");
    if (siret.length !== 14) {
      setSiretStatus("invalid");
      return;
    }
    setSiretStatus("checking");

    try {
      const res = await fetch("/api/verify-siret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siret }),
      });
      const data = await res.json();

      if (data.valid) {
        setSiretStatus("valid");
        setSiretInfo({ name: data.name, address: data.address });
        // Pré-remplir le nom si vide
        if (!formData.businessName && data.name) {
          setFormData((prev) => ({ ...prev, businessName: data.name }));
        }
      } else {
        setSiretStatus("invalid");
        setSiretInfo(null);
      }
    } catch {
      setSiretStatus("invalid");
    }
  };

  const validateStep = (): boolean => {
    setError("");

    if (step === 1) {
      if (!formData.firstName || !formData.lastName) {
        setError("Veuillez renseigner votre nom et prénom");
        return false;
      }
      if (!formData.email.includes("@")) {
        setError("Veuillez entrer un email valide");
        return false;
      }
      if (formData.password.length < 8) {
        setError("Le mot de passe doit contenir au moins 8 caractères");
        return false;
      }
      if (formData.password !== formData.confirmPassword) {
        setError("Les mots de passe ne correspondent pas");
        return false;
      }
    }

    if (step === 2) {
      if (!formData.businessName) {
        setError("Le nom de l'entreprise est requis");
        return false;
      }
      if (!formData.category) {
        setError("Veuillez sélectionner votre activité");
        return false;
      }
      if (formData.siret.replace(/\s/g, "").length !== 14) {
        setError("Le SIRET doit contenir 14 chiffres");
        return false;
      }
      if (siretStatus !== "valid") {
        setError("Veuillez d'abord vérifier votre SIRET");
        return false;
      }
    }

    if (step === 3) {
      if (!formData.city) {
        setError("La ville est requise");
        return false;
      }
    }

    return true;
  };

  const handleNext = () => {
    if (validateStep()) setStep((s) => s + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep()) return;

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Lot 18 B9 : referralCode si présent (résolution safe côté backend).
        // Lot 19 : captchaToken — obligatoire si TURNSTILE_SECRET_KEY set, ignoré sinon.
        body: JSON.stringify({
          ...formData,
          referralCode,
          captchaToken: captchaToken ?? undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur d'inscription");

      // ⚠️  Ne PAS stocker l'utilisateur en localStorage : ce serait manipulable.
      // Le AuthContext ré-hydrate via GET /api/auth/session (cookie httpOnly signé).
      // Redirection vers l'onboarding (checklist des étapes essentielles).
      window.location.href = "/dashboard/welcome";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'inscription");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
            <Store className="h-7 w-7" />
          </div>
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Créer votre espace professionnel
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Réservé aux professionnels avec numéro SIRET
          </p>
          {/* Lot 18 B9 : feedback visuel si un code parrain valide est détecté.
              Rassure l'user et l'incite à finaliser (parrain averti aussi). */}
          {referralCode && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              Parrainé par <span className="font-mono">{referralCode}</span>
            </div>
          )}
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                  s < step
                    ? "bg-emerald-500 text-white"
                    : s === step
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                }`}
              >
                {s < step ? <CheckCircle2 className="h-4 w-4" /> : s}
              </div>
              {s < 3 && (
                <div
                  className={`h-0.5 w-8 transition-colors ${s < step ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"}`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step labels */}
        <div className="flex justify-center gap-8 text-xs text-slate-500 dark:text-slate-400">
          <span className={step === 1 ? "font-semibold text-slate-900 dark:text-slate-100" : ""}>
            Compte
          </span>
          <span className={step === 2 ? "font-semibold text-slate-900 dark:text-slate-100" : ""}>
            Entreprise
          </span>
          <span className={step === 3 ? "font-semibold text-slate-900 dark:text-slate-100" : ""}>
            Coordonnées
          </span>
        </div>

        {/* SIRET Badge */}
        <div className="flex items-center justify-center gap-2 rounded-xl bg-blue-50 px-4 py-2 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
          <Shield className="h-4 w-4" />
          Vérification SIRET obligatoire — Compte professionnel uniquement
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200/60 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Step 1: Account */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Prénom"
                  autoComplete="given-name"
                  placeholder="Jean"
                  value={formData.firstName}
                  onChange={(e) => updateField("firstName", e.target.value)}
                  required
                />
                <Input
                  label="Nom"
                  autoComplete="family-name"
                  placeholder="Dupont"
                  value={formData.lastName}
                  onChange={(e) => updateField("lastName", e.target.value)}
                  required
                />
              </div>
              <Input
                label="Email professionnel"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="contact@entreprise.fr"
                value={formData.email}
                onChange={(e) => updateField("email", e.target.value)}
                required
              />
              <Input
                label="Mot de passe"
                type="password"
                autoComplete="new-password"
                placeholder="8 caractères minimum"
                value={formData.password}
                onChange={(e) => updateField("password", e.target.value)}
                required
              />
              <Input
                label="Confirmer le mot de passe"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={(e) => updateField("confirmPassword", e.target.value)}
                required
              />
              <Button
                type="button"
                className="w-full"
                onClick={handleNext}
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                Continuer
              </Button>
            </div>
          )}

          {/* Step 2: Business */}
          {step === 2 && (
            <div className="space-y-4">
              {/* SIRET */}
              <div>
                <Input
                  label="Numéro SIRET (14 chiffres)"
                  placeholder="123 456 789 01234"
                  value={formData.siret}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^\d\s]/g, "").slice(0, 17);
                    updateField("siret", v);
                  }}
                  required
                  rightIcon={
                    siretStatus === "valid" ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : siretStatus === "checking" ? (
                      <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                    ) : siretStatus === "invalid" ? (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    ) : undefined
                  }
                />
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSiretCheck}
                    loading={siretStatus === "checking"}
                    disabled={formData.siret.replace(/\s/g, "").length !== 14}
                  >
                    Vérifier le SIRET
                  </Button>
                  {siretStatus === "valid" && (
                    <Badge variant="success" className="self-center">
                      SIRET vérifié ✓
                    </Badge>
                  )}
                </div>
              </div>

              {siretInfo && (
                <div className="rounded-xl bg-emerald-50 p-4 text-sm dark:bg-emerald-900/20">
                  {siretInfo.name && (
                    <p className="font-medium text-emerald-800 dark:text-emerald-300">
                      {siretInfo.name}
                    </p>
                  )}
                  {siretInfo.address && (
                    <p className="text-emerald-600 dark:text-emerald-400">{siretInfo.address}</p>
                  )}
                </div>
              )}

              <Input
                label="Nom de l'entreprise"
                placeholder="Ex: Dupont Plomberie"
                value={formData.businessName}
                onChange={(e) => updateField("businessName", e.target.value)}
                required
              />
              <Select
                label="Type d'activité"
                placeholder="Sélectionnez votre activité"
                value={formData.category}
                onChange={(e) => updateField("category", e.target.value)}
                options={CATEGORIES.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` }))}
                required
              />
              <Textarea
                label="Description (optionnel)"
                placeholder="Décrivez votre activité en quelques lignes..."
                value={formData.description}
                onChange={(e) => updateField("description", e.target.value)}
              />

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep(1)}
                  leftIcon={<ArrowLeft className="h-4 w-4" />}
                >
                  Retour
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  onClick={handleNext}
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                >
                  Continuer
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Contact */}
          {step === 3 && (
            <div className="space-y-4">
              <Input
                label="Téléphone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="+336 12 34 56 78"
                value={formData.phone}
                onChange={(e) => updateField("phone", e.target.value)}
              />
              <Input
                label="Adresse"
                autoComplete="street-address"
                placeholder="12 Rue de la Paix"
                value={formData.address}
                onChange={(e) => updateField("address", e.target.value)}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Code postal"
                  placeholder="75001"
                  value={formData.postalCode}
                  onChange={(e) => updateField("postalCode", e.target.value)}
                />
                <Input
                  label="Ville"
                  placeholder="Paris"
                  value={formData.city}
                  onChange={(e) => updateField("city", e.target.value)}
                  required
                />
              </div>

              {/* Résumé */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800">
                <h4 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Résumé
                </h4>
                <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                  <p>
                    <strong>
                      {formData.firstName} {formData.lastName}
                    </strong>{" "}
                    — {formData.email}
                  </p>
                  <p>
                    <strong>{formData.businessName}</strong> — SIRET : {formData.siret}
                  </p>
                  <p>{formData.city}</p>
                </div>
              </div>

              {/* Lot 19 : captcha Turnstile — invisible si pas de site key */}
              <CaptchaWidget onToken={setCaptchaToken} />

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep(2)}
                  leftIcon={<ArrowLeft className="h-4 w-4" />}
                >
                  Retour
                </Button>
                <Button type="submit" className="flex-1" loading={isLoading}>
                  Créer mon compte
                </Button>
              </div>
            </div>
          )}

          <div className="mt-6 text-center text-sm">
            <span className="text-slate-500 dark:text-slate-400">Déjà inscrit ? </span>
            <Link
              href="/login"
              className="font-medium text-slate-900 hover:underline dark:text-slate-100"
            >
              Se connecter
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
