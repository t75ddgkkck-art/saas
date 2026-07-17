"use client";

/**
 * Lot 58 MAJ3 — Configuration Google Reviews depuis /dashboard/reviews.
 *
 * Approche pragmatique v1 : l'user récupère son Place ID Google manuellement
 * (5 clics sur https://developers.google.com/maps/documentation/places/web-service/place-id)
 * et le colle ici. Pas d'OAuth Google Business (workflow trop lourd, scope
 * `business.manage` en review Google = semaines d'attente).
 *
 * Ce composant remplace l'ancien flux "Connecter Google Business" qui était fake
 * (voir Lot 58 MAJ3 : /api/google/callback ne persistait rien).
 */

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Star, ExternalLink, CheckCircle2 } from "lucide-react";

export function GoogleReviewsCard() {
  const toast = useToast();
  const [placeId, setPlaceId] = useState("");
  const [initialPlaceId, setInitialPlaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Charge le Place ID actuel du business à l'ouverture
  useEffect(() => {
    fetch("/api/my-business")
      .then((r) => r.json())
      .then((b: { googlePlaceId?: string | null }) => {
        setInitialPlaceId(b.googlePlaceId ?? null);
        setPlaceId(b.googlePlaceId ?? "");
      })
      .catch(() => toast.error("Impossible de charger la configuration Google Reviews."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    // Nettoyage : on retire les espaces éventuels (users copient parfois avec)
    const cleaned = placeId.trim();
    // Validation côté client — même regex que le schéma Zod côté serveur
    if (cleaned && !/^[A-Za-z0-9_-]+$/.test(cleaned)) {
      toast.error("Place ID invalide (caractères alphanumériques, _ et - uniquement).");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/my-business", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ googlePlaceId: cleaned }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? "Enregistrement impossible.");
        return;
      }
      setInitialPlaceId(cleaned || null);
      toast.success(
        cleaned ? "Place ID enregistré." : "Place ID retiré — avis Google désactivés."
      );
    } catch {
      toast.error("Erreur réseau. Réessayez.");
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = placeId.trim() !== (initialPlaceId ?? "");
  const isConfigured = initialPlaceId !== null && initialPlaceId.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
          Avis Google
          {isConfigured && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 className="h-3 w-3" /> Configuré
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Importez vos vrais avis Google sur votre vitrine + envoyez à vos clients un lien
          direct pour laisser un avis Google après chaque RDV.
        </p>

        <div>
          <label
            htmlFor="place-id"
            className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Place ID Google de votre fiche
          </label>
          <input
            id="place-id"
            type="text"
            value={placeId}
            onChange={(e) => setPlaceId(e.target.value)}
            placeholder="Ex: ChIJN1t_tDeuEmsRUsoyG83frY4"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900"
            disabled={loading || saving}
            maxLength={200}
          />
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Comment le trouver ?{" "}
            <a
              href="https://developers.google.com/maps/documentation/places/web-service/place-id"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
            >
              Guide officiel Google <ExternalLink className="h-3 w-3" />
            </a>{" "}
            (recherchez votre entreprise, copiez l&apos;ID affiché).
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSave} loading={saving} disabled={!hasChanges || loading}>
            {isConfigured && !placeId.trim() ? "Retirer" : "Enregistrer"}
          </Button>
          {isConfigured && (
            <a
              href={`https://search.google.com/local/writereview?placeid=${encodeURIComponent(
                initialPlaceId ?? ""
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Tester le lien avis <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
