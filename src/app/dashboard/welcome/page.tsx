"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  CheckCircle2,
  Circle,
  Sparkles,
  Store,
  Palette,
  ImageIcon,
  Phone,
  Calendar,
  Share2,
  ArrowRight,
  Rocket,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Onboarding wizard affiché après register.
 * 6 étapes essentielles pour rendre la vitrine "prête à recevoir des clients".
 */

interface Business {
  id: string;
  slug: string;
  name: string;
  logo: string | null;
  coverImage: string | null;
  phone: string | null;
  description: string | null;
  primaryColor: string | null;
}

interface Step {
  id: string;
  label: string;
  description: string;
  icon: typeof Store;
  href: string;
  done: (b: Business, servicesCount: number, hoursCount: number) => boolean;
}

const STEPS: Step[] = [
  {
    id: "identity",
    label: "Personnalisez votre identité",
    description: "Ajoutez votre logo, une photo de couverture et une couleur.",
    icon: Palette,
    href: "/dashboard/vitrine",
    done: (b) => Boolean(b.logo || b.coverImage),
  },
  {
    id: "description",
    label: "Décrivez votre activité",
    description: "Une description claire améliore votre référencement Google.",
    icon: Store,
    href: "/dashboard/vitrine",
    done: (b) => Boolean(b.description && b.description.length >= 50),
  },
  {
    id: "contact",
    label: "Renseignez votre téléphone",
    description: "Pour que vos clients puissent vous joindre en un clic.",
    icon: Phone,
    href: "/dashboard/vitrine",
    done: (b) => Boolean(b.phone),
  },
  {
    id: "services",
    label: "Ajoutez vos services",
    description: "Listez au moins 3 prestations avec leurs prix.",
    icon: ImageIcon,
    href: "/dashboard/vitrine?section=services",
    done: (_b, servicesCount) => servicesCount >= 3,
  },
  {
    id: "hours",
    label: "Configurez vos horaires",
    description: "Indispensable pour la prise de rendez-vous en ligne.",
    icon: Calendar,
    href: "/dashboard/vitrine?section=horaires",
    done: (_b, _s, hoursCount) => hoursCount >= 1,
  },
  {
    id: "share",
    label: "Partagez votre vitrine",
    description: "QR code, réseaux sociaux, email de signature.",
    icon: Share2,
    href: "/dashboard/qr-code",
    done: () => false, // action manuelle, jamais "auto-cochée"
  },
];

export default function WelcomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [business, setBusiness] = useState<Business | null>(null);
  const [servicesCount, setServicesCount] = useState(0);
  const [hoursCount, setHoursCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/my-business").then((r) => r.json()),
      fetch("/api/services").then((r) => r.json()),
      fetch("/api/my-availability").then((r) => r.json()),
    ])
      .then(([biz, svc, avail]) => {
        setBusiness(biz);
        setServicesCount(svc?.services?.length ?? 0);
        setHoursCount((avail?.hours ?? []).filter((h: { isClosed: boolean }) => !h.isClosed).length);
      })
      .catch(() => {
        /* silencieux : la page reste utilisable même si les fetch échouent */
      })
      .finally(() => setLoading(false));
  }, []);

  const completed = business
    ? STEPS.filter((s) => s.done(business, servicesCount, hoursCount)).length
    : 0;
  const progress = Math.round((completed / STEPS.length) * 100);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 p-8 text-white">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
            <Sparkles className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">
              Bienvenue{user?.firstName ? `, ${user.firstName}` : ""} !
            </h1>
            <p className="mt-2 text-slate-200">
              Votre vitrine est créée. Complétez ces {STEPS.length} étapes pour maximiser vos chances
              d&apos;être trouvé et contacté.
            </p>
          </div>
        </div>

        {/* Barre de progression */}
        <div className="mt-6">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{completed} sur {STEPS.length} étapes complétées</span>
            <span className="font-bold">{progress}%</span>
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-white/20"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progression de la configuration"
          >
            <div
              className="h-full rounded-full bg-emerald-400 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Liste des étapes */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration de votre vitrine</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2">
            {STEPS.map((step, index) => {
              const isDone = business
                ? step.done(business, servicesCount, hoursCount)
                : false;
              return (
                <li key={step.id}>
                  <Link
                    href={step.href}
                    className={`group flex items-start gap-4 rounded-xl border p-4 transition-all ${
                      isDone
                        ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <div className="shrink-0" aria-hidden="true">
                      {isDone ? (
                        <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                      ) : (
                        <Circle className="h-6 w-6 text-slate-300 dark:text-slate-700" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Étape {index + 1}
                        </span>
                        {isDone && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                            Fait
                          </span>
                        )}
                      </div>
                      <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                        {step.label}
                      </p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {step.description}
                      </p>
                    </div>
                    <ArrowRight
                      className="h-5 w-5 shrink-0 self-center text-slate-300 transition-transform group-hover:translate-x-0.5 dark:text-slate-600"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>

      {/* Actions rapides */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            {business ? "Voir ma vitrine en ligne" : "Chargement..."}
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {business
              ? `vitrix.fr/${business.slug}`
              : "Votre URL personnalisée sera affichée ici"}
          </p>
        </div>
        <div className="flex gap-3">
          {business && (
            <Link href={`/${business.slug}`} target="_blank">
              <Button variant="outline">Aperçu</Button>
            </Link>
          )}
          <Button
            onClick={() => router.push("/dashboard")}
            leftIcon={<Rocket className="h-4 w-4" aria-hidden="true" />}
            disabled={loading}
          >
            Accéder au dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
