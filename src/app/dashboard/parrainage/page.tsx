"use client";

/**
 * Lot 52 (F14) — Dashboard "Parrainage".
 *
 * Page complète avec :
 *  - Hero : code parrain + URL + boutons partage (WhatsApp/SMS/Email/Copy)
 *  - 4 KPIs : invités / convertis / en attente / mois gagnés (avec plafond)
 *  - Table filleuls (email masqué, statut Free/Pro/Premium)
 *  - Templates copier-coller
 *  - FAQ intégrée en accordion
 *
 * Aucun gate — programme ouvert à tous plans (mécanisme de croissance).
 */

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageTitle } from "@/components/layout/PageTitle";
import { useAuth } from "@/contexts/AuthContext";
import {
  Gift,
  Copy,
  Mail,
  MessageCircle,
  Smartphone,
  Users,
  TrendingUp,
  Trophy,
  Clock,
  Check,
} from "lucide-react";
import {
  buildShareTemplates,
  buildEmailShareLink,
  buildWhatsappShareLink,
  buildSmsShareLink,
} from "@/lib/referral-share";

interface ReferredUser {
  id: string;
  displayName: string;
  maskedEmail: string;
  subscription: "free" | "pro" | "premium";
  isConverted: boolean;
  createdAt: string;
}

interface ReferralPayload {
  ok: boolean;
  referralCode: string | null;
  shareUrl: string | null;
  creditMonths: number;
  maxCreditMonths: number;
  atMaxCredit: boolean;
  stats: {
    totalReferred: number;
    converted: number;
    pending: number;
  };
  referredList: ReferredUser[];
}

export default function ParrainagePage() {
  const [data, setData] = useState<ReferralPayload | null>(null);
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  const { user } = useAuth();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/account/referral");
      const d = await res.json();
      if (d.ok) setData(d);
    } catch {
      toast.error("Impossible de charger vos statistiques");
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCopy = async () => {
    if (!data?.shareUrl) return;
    await navigator.clipboard.writeText(data.shareUrl);
    setCopied(true);
    toast.success("Lien copié dans le presse-papier");
    setTimeout(() => setCopied(false), 2000);
  };

  // Templates de partage (recalculés à chaque render — c'est cheap, pas besoin useMemo)
  const templates = data?.shareUrl
    ? buildShareTemplates(data.shareUrl, user?.firstName)
    : null;

  if (!data) {
    return (
      <div className="mx-auto max-w-5xl p-4 sm:p-6 space-y-6">
        <Skeleton className="h-64 w-full rounded-2xl" />
        <div className="grid gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  // Cas edge : user sans code (rare — devrait être auto-généré au register).
  // On propose un CTA support pour régénération.
  if (!data.referralCode || !data.shareUrl) {
    return (
      <div className="mx-auto max-w-5xl p-4 sm:p-6">
        <PageTitle title="Parrainage" />
        <EmptyState
          icon={<Gift className="h-10 w-10" />}
          title="Programme de parrainage non initialisé"
          description="Votre code parrain n'a pas encore été généré. Contactez le support pour l'activer."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 space-y-6">
      <PageTitle title="Parrainage" />

      {/* Hero — code + partage */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 p-6 text-white sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
            <Gift className="h-6 w-6" aria-hidden />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold sm:text-3xl">
              Parrainez, gagnez jusqu&apos;à {data.maxCreditMonths} mois offerts
            </h1>
            <p className="mt-2 text-sm text-emerald-100 sm:text-base">
              Pour chaque ami qui s&apos;inscrit avec votre code ET passe en Pro ou Premium,
              vous recevez <strong>1 mois offert</strong> sur votre abonnement (plafond{" "}
              {data.maxCreditMonths} mois cumulés).
            </p>
          </div>
        </div>

        {/* Code + URL de partage */}
        <div className="mt-6 space-y-3">
          <div className="rounded-xl bg-white/10 backdrop-blur px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-emerald-200">Votre code</p>
            <p className="mt-1 font-mono text-2xl font-bold">{data.referralCode}</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1 rounded-xl bg-white/10 backdrop-blur px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-emerald-200">Lien de partage</p>
              <p className="mt-1 truncate text-sm font-mono">{data.shareUrl}</p>
            </div>
            <Button
              variant="outline"
              onClick={handleCopy}
              className="!border-white/30 !bg-white/10 !text-white hover:!bg-white/20"
              leftIcon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            >
              {copied ? "Copié !" : "Copier"}
            </Button>
          </div>
        </div>

        {/* Boutons partage rapide */}
        {templates && (
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={buildEmailShareLink(templates)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Partager par email"
            >
              <Button
                variant="outline"
                size="sm"
                className="!border-white/30 !bg-white/10 !text-white hover:!bg-white/20"
              >
                <Mail className="mr-1.5 h-4 w-4" /> Email
              </Button>
            </a>
            <a
              href={buildWhatsappShareLink(templates)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Partager par WhatsApp"
            >
              <Button
                variant="outline"
                size="sm"
                className="!border-white/30 !bg-white/10 !text-white hover:!bg-white/20"
              >
                <MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp
              </Button>
            </a>
            <a
              href={buildSmsShareLink(templates)}
              aria-label="Partager par SMS"
            >
              <Button
                variant="outline"
                size="sm"
                className="!border-white/30 !bg-white/10 !text-white hover:!bg-white/20"
              >
                <Smartphone className="mr-1.5 h-4 w-4" /> SMS
              </Button>
            </a>
          </div>
        )}

        {/* Bandeau plafond atteint */}
        {data.atMaxCredit && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-yellow-500/20 border border-yellow-300/30 p-3 text-sm">
            <Trophy className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              <strong>Plafond atteint 🏆</strong> — vous avez cumulé le maximum de{" "}
              {data.maxCreditMonths} mois offerts. Continuez à parrainer pour la fierté !
            </span>
          </div>
        )}
      </div>

      {/* 4 KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={<Users className="h-4 w-4 text-slate-400" />}
          label="Filleuls invités"
          value={data.stats.totalReferred}
        />
        <Kpi
          icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
          label="Convertis Pro/Premium"
          value={data.stats.converted}
          highlight="emerald"
        />
        <Kpi
          icon={<Clock className="h-4 w-4 text-amber-500" />}
          label="En attente (Free)"
          value={data.stats.pending}
          highlight="amber"
        />
        <Kpi
          icon={<Trophy className="h-4 w-4 text-purple-500" />}
          label={`Mois gagnés (max ${data.maxCreditMonths})`}
          value={data.creditMonths}
          highlight="purple"
        />
      </div>

      {/* Template messages copier-coller */}
      {templates && (
        <Card>
          <CardContent className="p-4 sm:p-5 space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Messages prêts à envoyer
            </h3>

            <TemplateBlock
              label="📧 Email"
              content={`Objet : ${templates.emailSubject}\n\n${templates.emailBody}`}
              onCopy={(txt) => {
                navigator.clipboard.writeText(txt);
                toast.success("Template email copié");
              }}
            />
            <TemplateBlock
              label="💬 Message court (SMS / WhatsApp)"
              content={templates.shortMessage}
              onCopy={(txt) => {
                navigator.clipboard.writeText(txt);
                toast.success("Template court copié");
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Liste filleuls */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
            Mes filleuls ({data.referredList.length})
          </h3>
          {data.referredList.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center">
              <Gift className="mx-auto mb-2 h-8 w-8 text-slate-300 dark:text-slate-600" />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Personne ne s&apos;est encore inscrit avec votre code.
                <br />
                Partagez votre lien pour commencer !
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Filleul
                    </th>
                    <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hidden sm:table-cell">
                      Email
                    </th>
                    <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Statut
                    </th>
                    <th className="p-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hidden sm:table-cell">
                      Inscrit le
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.referredList.map((r) => (
                    <tr key={r.id}>
                      <td className="p-3 font-medium text-slate-900 dark:text-slate-100">
                        {r.displayName}
                      </td>
                      <td className="p-3 text-xs font-mono text-slate-500 hidden sm:table-cell">
                        {r.maskedEmail}
                      </td>
                      <td className="p-3">
                        <StatusBadge subscription={r.subscription} isConverted={r.isConverted} />
                      </td>
                      <td className="p-3 text-xs text-slate-500 hidden sm:table-cell">
                        {new Date(r.createdAt).toLocaleDateString("fr-FR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* FAQ */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
            Questions fréquentes
          </h3>
          <div className="space-y-2">
            <FaqItem q="Comment fonctionne le parrainage ?" a="Vous partagez votre code (ou lien) avec un ami. S'il s'inscrit ET souscrit à Pro ou Premium, vous gagnez automatiquement 1 mois offert." />
            <FaqItem q="Quand est appliqué le mois offert ?" a="Le crédit est appliqué au moment de la conversion Stripe de votre filleul. Il sera utilisé lors de votre prochaine facturation (aujourd'hui : décompte manuel via support, à automatiser en v2)." />
            <FaqItem q={`Y a-t-il un plafond ?`} a={`Oui, ${data.maxCreditMonths} mois cumulés au maximum. C'est notre limite pour préserver l'équilibre économique du programme. Contactez-nous si vous êtes exceptionnellement au-dessus.`} />
            <FaqItem q="Puis-je parrainer sans être moi-même Pro/Premium ?" a="Oui. Un compte Free peut parrainer et cumuler des mois offerts, utilisables dès son upgrade en Pro ou Premium." />
            <FaqItem q="Mon filleul reste en Free : je gagne quelque chose ?" a="Non — l'objectif est de récompenser les conversions payantes. En attendant, encouragez-le à essayer Pro (14j gratuits proposés)." />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sous-composants privés
// -----------------------------------------------------------------------------

function Kpi({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  highlight?: "emerald" | "amber" | "purple";
}) {
  const colorClass =
    highlight === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : highlight === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : highlight === "purple"
          ? "text-purple-600 dark:text-purple-400"
          : "text-slate-900 dark:text-slate-100";

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {icon}
          <span>{label}</span>
        </div>
        <p className={`mt-2 text-3xl font-bold tabular-nums ${colorClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function TemplateBlock({
  label,
  content,
  onCopy,
}: {
  label: string;
  content: string;
  onCopy: (txt: string) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 p-3">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
        <Button variant="ghost" size="sm" onClick={() => onCopy(content)}>
          <Copy className="mr-1 h-3.5 w-3.5" /> Copier
        </Button>
      </div>
      <pre className="whitespace-pre-wrap p-3 text-xs font-mono text-slate-600 dark:text-slate-400">
        {content}
      </pre>
    </div>
  );
}

function StatusBadge({
  subscription,
  isConverted,
}: {
  subscription: "free" | "pro" | "premium";
  isConverted: boolean;
}) {
  if (isConverted && subscription === "premium") {
    return (
      <span className="rounded-full bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 text-xs font-medium text-purple-800 dark:text-purple-300">
        ⭐ Premium
      </span>
    );
  }
  if (isConverted && subscription === "pro") {
    return (
      <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
        ✓ Pro
      </span>
    );
  }
  return (
    <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-400">
      Free (en attente)
    </span>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
      <summary className="cursor-pointer p-3 text-sm font-medium text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/50 list-none flex justify-between items-center">
        <span>{q}</span>
        <span className="text-slate-400 group-open:rotate-180 transition-transform">▾</span>
      </summary>
      <div className="p-3 text-sm text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800">
        {a}
      </div>
    </details>
  );
}
