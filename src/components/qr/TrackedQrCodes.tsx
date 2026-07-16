"use client";

/**
 * Lot 47 (F12) — Gestion des QR codes trackables (multi-supports avec source).
 *
 * Section AJOUTÉE dans /dashboard/qr-code, à côté du QR "principal" existant.
 * Le pro peut créer plusieurs QR différenciés (carte visite, camionnette, flyer…)
 * et voir le nombre de scans par source.
 *
 * Flow :
 *  1. Fetch initial → liste des QR + scans agrégés
 *  2. Bouton "+ Nouveau QR" → modal (label + source auto-slugifiée + UTM optionnels)
 *  3. Preview du QR via /api/qr-codes/[id]/download?format=png embedded en <img>
 *  4. Actions par QR : Download PNG, Download SVG, Copy URL, Delete
 */

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/useConfirm";
import { QrCode, Plus, Download, Copy, Trash2, TrendingUp, Info } from "lucide-react";
import { slugifySource } from "@/lib/qr-tracking";

interface TrackedQr {
  id: string;
  label: string;
  source: string;
  utmCampaign: string | null;
  utmMedium: string | null;
  utmContent: string | null;
  scansCount: number;
  createdAt: string;
}

interface Props {
  /** Slug de la vitrine (fournit par le parent qui l'a déjà fetché) */
  businessSlug: string;
}

export function TrackedQrCodes({ businessSlug }: Props) {
  const [qrCodes, setQrCodes] = useState<TrackedQr[] | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ label: "", source: "", utmCampaign: "", utmContent: "" });
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/qr-codes");
      const data = await res.json();
      if (data.ok) setQrCodes(data.qrCodes ?? []);
    } catch {
      toast.error("Impossible de charger vos QR codes");
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Auto-remplissage : quand le label change, propose une source slugifiée.
   * L'user peut override manuellement.
   */
  const handleLabelChange = (label: string) => {
    setForm((prev) => ({
      ...prev,
      label,
      // Ne remplace la source QUE si elle a été auto-générée (ou vide)
      source: prev.source === slugifySource(prev.label) || !prev.source ? slugifySource(label) : prev.source,
    }));
  };

  const handleCreate = async () => {
    if (!form.label.trim() || !form.source.trim()) {
      toast.error("Libellé et source requis");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/qr-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: form.label.trim(),
          source: form.source.trim(),
          utmCampaign: form.utmCampaign.trim() || undefined,
          utmContent: form.utmContent.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("QR code créé avec succès");
        setForm({ label: "", source: "", utmCampaign: "", utmContent: "" });
        setShowModal(false);
        await load();
      } else if (res.status === 403 && data.limit !== undefined) {
        // Quota atteint
        toast.error(
          `${data.error} Upgrade vers ${data.upgradeTo === "pro" ? "Pro" : "Premium"} pour plus.`
        );
      } else if (res.status === 409) {
        toast.error(data.error ?? "Cette source est déjà utilisée");
      } else {
        toast.error(data.error ?? "Impossible de créer le QR code");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setCreating(false);
    }
  };

  const handleCopyUrl = (qr: TrackedQr) => {
    // On reconstruit l'URL trackée côté client (identique à celle du QR)
    const url = new URL(`${appUrl}/${businessSlug}`);
    url.searchParams.set("src", qr.source);
    url.searchParams.set("utm_source", "qr");
    url.searchParams.set("utm_medium", qr.utmMedium || "qr");
    if (qr.utmCampaign) url.searchParams.set("utm_campaign", qr.utmCampaign);
    if (qr.utmContent) url.searchParams.set("utm_content", qr.utmContent);

    navigator.clipboard.writeText(url.toString());
    toast.success("URL copiée dans le presse-papier");
  };

  const handleDelete = async (qr: TrackedQr) => {
    const ok = await confirm({
      title: "Supprimer ce QR code ?",
      description: `Le QR "${qr.label}" ne sera plus imprimable, mais les ${qr.scansCount} scan${qr.scansCount > 1 ? "s" : ""} déjà enregistré${qr.scansCount > 1 ? "s" : ""} resteront dans vos analytics.`,
      variant: "danger",
      confirmLabel: "Supprimer",
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/qr-codes/${qr.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("QR code supprimé");
        await load();
      } else {
        toast.error("Impossible de supprimer");
      }
    } catch {
      toast.error("Erreur réseau");
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              QR codes trackés
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Créez un QR différent par support (carte visite, camionnette, flyer…) et voyez
              d&apos;où viennent vos scans dans vos analytics.
            </p>
          </div>
          <Button onClick={() => setShowModal(true)} size="sm">
            <Plus className="mr-1 h-4 w-4" /> Nouveau QR
          </Button>
        </div>

        {/* Liste */}
        {qrCodes === null ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : qrCodes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center">
            <QrCode className="mx-auto mb-2 h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Aucun QR tracké pour l&apos;instant. Créez-en un pour mesurer vos campagnes.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {qrCodes.map((qr) => (
              <div
                key={qr.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3 sm:flex-row sm:items-center"
              >
                {/* Preview mini via l'API download PNG (cache 1h côté nav) */}
                <div className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/qr-codes/${qr.id}/download?format=png&size=128`}
                    alt={`QR code ${qr.label}`}
                    width={64}
                    height={64}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-900 dark:text-slate-100">{qr.label}</p>
                    <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-600 dark:text-slate-400">
                      {qr.source}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <TrendingUp className="h-3 w-3" aria-hidden />
                    <span>
                      {qr.scansCount} scan{qr.scansCount > 1 ? "s" : ""} enregistré
                      {qr.scansCount > 1 ? "s" : ""}
                    </span>
                    {qr.utmCampaign && <span className="ml-2">· {qr.utmCampaign}</span>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <a href={`/api/qr-codes/${qr.id}/download?format=png&size=1024`} download>
                    <Button size="sm" variant="ghost" aria-label="Télécharger PNG">
                      <Download className="h-4 w-4" /> PNG
                    </Button>
                  </a>
                  <a href={`/api/qr-codes/${qr.id}/download?format=svg`} download>
                    <Button size="sm" variant="ghost" aria-label="Télécharger SVG">
                      <Download className="h-4 w-4" /> SVG
                    </Button>
                  </a>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopyUrl(qr)}
                    aria-label="Copier URL"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(qr)}
                    aria-label="Supprimer"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info tracking */}
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 p-3 text-xs text-slate-600 dark:text-slate-400">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Les scans sont trackés automatiquement dans vos analytics (page{" "}
            <strong>Statistiques</strong>). Chaque QR envoie un paramètre <code>?src=</code> unique
            reconnu par notre tracker RGPD-friendly.
          </span>
        </div>
      </CardContent>

      {/* Modal création */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Nouveau QR code tracké"
        description="Chaque QR aura sa propre source pour identifier d'où viennent les scans."
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Libellé"
            placeholder="Ex: Carte de visite avril 2026"
            value={form.label}
            onChange={(e) => handleLabelChange(e.target.value)}
            required
            autoFocus
          />
          <Input
            label="Source (identifiant URL)"
            placeholder="carte-visite-avril"
            value={form.source}
            onChange={(e) => setForm({ ...form, source: e.target.value })}
            required
            helperText="Auto-remplie depuis le libellé. Uniquement lettres, chiffres et tirets."
          />
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Paramètres UTM (optionnels)
            </p>
            <div className="space-y-3">
              <Input
                label="Campagne"
                placeholder="printemps-2026"
                value={form.utmCampaign}
                onChange={(e) => setForm({ ...form, utmCampaign: e.target.value })}
              />
              <Input
                label="Contenu"
                placeholder="flyer-a5-recto"
                value={form.utmContent}
                onChange={(e) => setForm({ ...form, utmContent: e.target.value })}
              />
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreate} loading={creating}>
              Créer le QR
            </Button>
          </div>
        </div>
      </Modal>

      {dialog}
    </Card>
  );
}
