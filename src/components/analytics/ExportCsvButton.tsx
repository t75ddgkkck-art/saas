"use client";

/**
 * Lot 56 — Bouton d'export CSV analytics.
 *
 * Comportement :
 *  - Fetch GET /api/analytics/export?period=X en Blob
 *  - Déclenche le téléchargement navigateur via <a download>
 *  - Loading state pendant le fetch (peut prendre ~500ms sur période longue)
 *  - Toast succès / erreur
 *
 * Design : bouton `<Button variant="outline">` cohérent avec le reste des
 * dashboards. Icon Download → devient spinner pendant le fetch.
 *
 * Note : on utilise Blob + <a download> plutôt qu'un simple `<a href="/api/...">`
 * pour pouvoir gérer les erreurs (401/500) via toast au lieu d'un download vide.
 */

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

interface Props {
  /** Période sélectionnée dans le picker parent (7d / 30d / 90d) */
  period: "7d" | "30d" | "90d";
}

export function ExportCsvButton({ period }: Props) {
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/export?period=${period}`);
      if (!res.ok) {
        // On lit le message d'erreur si JSON, sinon générique
        try {
          const err = await res.json();
          toast.error(err.error ?? "Export impossible");
        } catch {
          toast.error(`Export impossible (${res.status})`);
        }
        return;
      }

      // Récupère le filename depuis Content-Disposition ou fallback
      const cd = res.headers.get("Content-Disposition") || "";
      const match = /filename="([^"]+)"/.exec(cd);
      const filename = match?.[1] ?? `vitrix-analytics-${period}.csv`;

      // Blob + <a download> pour déclencher le save-as
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Cleanup — libère la mémoire du Blob
      setTimeout(() => URL.revokeObjectURL(url), 100);

      toast.success("Export CSV téléchargé");
    } catch {
      toast.error("Erreur réseau pendant l'export");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={loading}
      loading={loading}
      leftIcon={loading ? undefined : <Download className="h-4 w-4" />}
      aria-label={`Exporter les analytics de la période ${period} en CSV`}
    >
      {loading ? "Export…" : "Exporter CSV"}
    </Button>
  );
}
