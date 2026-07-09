"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LangContext";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  CalendarDays, FileText, Users, CreditCard, Star, Eye, Copy, Check,
  QrCode, Loader2, TrendingUp, Palette,
} from "lucide-react";
import Link from "next/link";

type Tab = "apercu" | "rdv" | "devis" | "clients" | "paiements";

const statusLabels: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "info" | "purple" }> = {
  pending: { label: "En attente", variant: "warning" },
  confirmed: { label: "Confirmé", variant: "success" },
  cancelled: { label: "Annulé", variant: "danger" },
  completed: { label: "Terminé", variant: "info" },
  draft: { label: "Brouillon", variant: "default" },
  sent: { label: "Envoyé", variant: "warning" },
  accepted: { label: "Accepté", variant: "success" },
  signed: { label: "Signé", variant: "success" },
  rejected: { label: "Refusé", variant: "danger" },
  failed: { label: "Échoué", variant: "danger" },
  refunded: { label: "Remboursé", variant: "info" },
};

// Type "large" de la réponse /api/activity — on typera plus finement quand
// on aura extrait /api/activity dans une route dédiée avec Zod.
interface DashboardData {
  business?: { slug?: string; pageUrl?: string; name?: string; id?: string } | null;
  revenue?: number;
  stats?: {
    revenue: number;
    appointmentsCount: number;
    quotesCount: number;
    clientsCount: number;
    visitsTotal?: number;
    avgRating: number;
    [k: string]: unknown;
  };
  visits?: {
    byDay?: Array<{ date: string; count: number }>;
    bySource?: Array<{ source: string; count: number }>;
    total?: number;
  };
  appointments?: unknown[];
  quotes?: unknown[];
  clients?: unknown[];
  payments?: unknown[];
  reviews?: unknown[];
}

export default function UnifiedDashboard() {
  const { user } = useAuth();
  const { td } = useLang();
  const [tab, setTab] = useState<Tab>("apercu");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/activity")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const copyLink = async () => {
    if (!data?.business) return;
    await navigator.clipboard.writeText(`${window.location.origin}/${data.business.slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>;
  }

  const stats = data?.stats || {
    revenue: 0,
    appointmentsCount: 0,
    quotesCount: 0,
    clientsCount: 0,
    visitsTotal: 0,
    avgRating: 0,
  };

  const plan = user?.subscription || "free";
  const tabs = [
    { id: "apercu" as Tab, label: td("overview"), icon: TrendingUp },
    { id: "rdv" as Tab, label: `${td("appointments")} (${data?.appointments?.length || 0})`, icon: CalendarDays },
    // Devis réservé aux plans payants
    ...(plan !== "free" ? [{ id: "devis" as Tab, label: `${td("quotes")} (${data?.quotes?.length || 0})`, icon: FileText }] : []),
    { id: "clients" as Tab, label: `${td("clientsTab")} (${data?.clients?.length || 0})`, icon: Users },
    { id: "paiements" as Tab, label: `${td("paymentsTab")} (${data?.payments?.length || 0})`, icon: CreditCard },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{td("hello")}, {user?.firstName} 👋</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{td("activitySubtitle")}</p>
      </div>

      {/* Carte page publique */}
      {data?.business && (
        <div className="rounded-2xl bg-slate-900 p-5 text-white dark:bg-white dark:text-slate-900">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-bold">{data.business?.name}</p>
              <p className="truncate text-xs text-slate-300 dark:text-slate-600 font-mono">
                vitrix.fr/{data.business?.slug}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10 dark:border-slate-300 dark:text-slate-900" onClick={copyLink}>
                {copied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
                {copied ? "Copié" : "Copier"}
              </Button>
              <Button variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10 dark:border-slate-300 dark:text-slate-900" onClick={() => data.business?.slug && window.open(`/${data.business.slug}`, "_blank")}>
                <Eye className="mr-1 h-3.5 w-3.5" /> Voir
              </Button>
              <Link href="/dashboard/vitrine">
                <Button variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10 dark:border-slate-300 dark:text-slate-900">
                  <Palette className="mr-1 h-3.5 w-3.5" /> Personnaliser
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Onglets */}
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2.5 text-xs font-medium transition-all ${
              tab === t.id ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100" : "text-slate-600 dark:text-slate-400"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* APERÇU */}
      {tab === "apercu" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              { label: td("revenue"), value: `${stats.revenue.toFixed(0)} €`, color: "bg-emerald-500", icon: CreditCard },
              { label: td("appointmentsFull"), value: stats.appointmentsCount, color: "bg-blue-500", icon: CalendarDays },
              { label: td("quotesFull"), value: stats.quotesCount, color: "bg-purple-500", icon: FileText },
              { label: td("clientsFull"), value: stats.clientsCount, color: "bg-amber-500", icon: Users },
              { label: td("visitors"), value: stats.visitsTotal || 0, color: "bg-rose-500", icon: Eye },
            ].map(s => (
              <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${s.color} text-white`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{s.value}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Statistiques de visites réelles */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-4 font-semibold text-slate-900 dark:text-slate-100">📈 {td("visitStats")}</h3>
            {(stats.visitsTotal || 0) === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">{td("noVisits")}</p>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {/* Graphique par jour (14 jours) */}
                <div>
                  <div className="flex h-32 items-end gap-1">
                    {(data?.visits?.byDay || []).map((d) => {
                      const max = Math.max(...(data?.visits?.byDay || []).map((x) => x.count), 1);
                      return (
                        <div key={d.date} className="group relative flex-1">
                          <div
                            className="w-full rounded-t bg-blue-500 transition-all hover:bg-blue-600"
                            style={{ height: `${Math.max((d.count / max) * 100, 2)}%`, minHeight: 2 }}
                          />
                          <span className="absolute -top-6 left-1/2 hidden -translate-x-1/2 rounded bg-slate-900 px-1.5 py-0.5 text-[9px] text-white group-hover:block">
                            {d.count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-1 flex justify-between text-[9px] text-slate-400">
                    <span>{(data?.visits?.byDay || [])[0]?.date?.slice(5)}</span>
                    <span>{(data?.visits?.byDay || []).slice(-1)[0]?.date?.slice(5)}</span>
                  </div>
                </div>
                {/* Sources */}
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">{td("sources")}</p>
                  <div className="space-y-2">
                    {(data?.visits?.bySource || []).slice(0, 5).map((s) => {
                      const total = stats.visitsTotal || 1;
                      const pct = Math.round((s.count / total) * 100);
                      const icons: Record<string, string> = { direct: "🔗", google: "🔍", facebook: "📘", instagram: "📸", qr: "📱", vitrix: "🏪", autre: "🌐" };
                      return (
                        <div key={s.source} className="flex items-center gap-2 text-sm">
                          <span className="w-24 truncate capitalize text-slate-600 dark:text-slate-400">{icons[s.source] || "🌐"} {s.source}</span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-10 text-right text-xs text-slate-500">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Avis */}
          {(data?.reviews?.length ?? 0) > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-900/20">
                  <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{stats.avgRating.toFixed(1)}/5</p>
                  <p className="text-xs text-slate-500">{data?.reviews?.length ?? 0} avis clients</p>
                </div>
              </div>
            </div>
          )}

          {/* État vide */}
          {stats.appointmentsCount === 0 && stats.quotesCount === 0 && stats.clientsCount === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center dark:border-slate-800">
              <TrendingUp className="mx-auto mb-3 h-10 w-10 text-slate-300" />
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Lancez votre activité !</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                Personnalisez votre vitrine, partagez votre lien et vos premiers rendez-vous, devis et clients apparaîtront ici.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <Link href="/dashboard/vitrine"><Button size="sm"><Palette className="mr-2 h-4 w-4" /> Personnaliser ma vitrine</Button></Link>
                <Link href="/dashboard/qr-code"><Button variant="outline" size="sm"><QrCode className="mr-2 h-4 w-4" /> Mon QR Code</Button></Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* RDV */}
      {tab === "rdv" && (
        <ListSection<{ title: string; date: string; startTime: string; endTime: string; status: string }>
          items={(data?.appointments || []) as Array<{ title: string; date: string; startTime: string; endTime: string; status: string }>}
          emptyText="Aucun rendez-vous pour le moment. Ils apparaîtront ici dès qu'un client réservera sur votre vitrine."
          render={(a) => (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/20"><CalendarDays className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{a.title}</p>
                <p className="text-xs text-slate-500">{a.date} · {a.startTime} - {a.endTime}</p>
              </div>
              <Badge variant={statusLabels[a.status]?.variant || "default"}>{statusLabels[a.status]?.label || a.status}</Badge>
            </div>
          )}
        />
      )}

      {/* DEVIS */}
      {tab === "devis" && (
        <ListSection<{ quoteNumber: string; title: string; total?: string | null; status: string }>
          items={(data?.quotes || []) as Array<{ quoteNumber: string; title: string; total?: string | null; status: string }>}
          emptyText="Aucun devis. Les demandes de devis de vos clients apparaîtront ici."
          render={(q) => (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-900/20"><FileText className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{q.quoteNumber} — {q.title}</p>
                <p className="text-xs text-slate-500">{q.total ? `${parseFloat(q.total).toFixed(2)} €` : "Montant à définir"}</p>
              </div>
              <Badge variant={statusLabels[q.status]?.variant || "default"}>{statusLabels[q.status]?.label || q.status}</Badge>
            </div>
          )}
        />
      )}

      {/* CLIENTS */}
      {tab === "clients" && (
        <ListSection<{ firstName?: string | null; lastName?: string | null; phone?: string | null; email?: string | null; appointmentsCount?: number | null; quotesCount?: number | null }>
          items={(data?.clients || []) as Array<{ firstName?: string | null; lastName?: string | null; phone?: string | null; email?: string | null; appointmentsCount?: number | null; quotesCount?: number | null }>}
          emptyText="Aucun client. Chaque client qui réserve ou demande un devis est ajouté automatiquement."
          render={(c) => (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {c.firstName?.[0]}{c.lastName?.[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{c.firstName} {c.lastName}</p>
                <p className="text-xs text-slate-500">{c.phone}{c.email ? ` · ${c.email}` : ""}</p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <p>{c.appointmentsCount || 0} RDV</p>
                <p>{c.quotesCount || 0} devis</p>
              </div>
            </div>
          )}
        />
      )}

      {/* PAIEMENTS */}
      {tab === "paiements" && (
        <ListSection<{ amount: string; createdAt: string | Date; status: string }>
          items={(data?.payments || []) as Array<{ amount: string; createdAt: string | Date; status: string }>}
          emptyText="Aucun paiement. Connectez Stripe dans 'Ma vitrine' pour encaisser en ligne."
          render={(p) => (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20"><CreditCard className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{parseFloat(p.amount).toFixed(2)} €</p>
                <p className="text-xs text-slate-500">{new Date(p.createdAt).toLocaleDateString("fr-FR")}</p>
              </div>
              <Badge variant={statusLabels[p.status]?.variant || "default"}>{statusLabels[p.status]?.label || p.status}</Badge>
            </div>
          )}
        />
      )}
    </div>
  );
}

function ListSection<T>({
  items,
  emptyText,
  render,
}: {
  items: T[];
  emptyText: string;
  render: (item: T) => React.ReactNode;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center dark:border-slate-800">
        <p className="text-sm text-slate-500 dark:text-slate-400">{emptyText}</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        // On accepte tout T ; si l'objet a un `id` string on l'utilise comme clé.
        const key =
          typeof item === "object" && item !== null && "id" in item && typeof (item as { id?: unknown }).id === "string"
            ? (item as { id: string }).id
            : i;
        return (
          <div key={key} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            {render(item)}
          </div>
        );
      })}
    </div>
  );
}
