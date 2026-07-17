"use client";

/**
 * Lot 58 MAJ3 — Configuration Google Reviews depuis /dashboard/reviews.
 * Lot 59 : guide "Comment trouver mon Place ID" intégré (accordéon) car
 *          l'artisan lambda ne connaît pas ce terme technique.
 *
 * Approche pragmatique v1 : l'user récupère son Place ID Google manuellement
 * (5 clics sur https://developers.google.com/maps/documentation/places/web-service/place-id)
 * et le colle ici. Pas d'OAuth Google Business (workflow scope `business.manage`
 * en review Google = semaines d'attente).
 *
 * Ce composant remplace l'ancien flux "Connecter Google Business" qui était fake
 * (voir Lot 58 MAJ3 : /api/google/callback ne persistait rien).
 */

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Star, ExternalLink, CheckCircle2, HelpCircle, ChevronDown } from "lucide-react";

export function GoogleReviewsCard() {
  const toast = useToast();
  const [placeId, setPlaceId] = useState("");
  const [initialPlaceId, setInitialPlaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Lot 59 : accordéon "guide pas à pas" replié par défaut.
  const [showGuide, setShowGuide] = useState(false);

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
        </div>

        {/* Lot 59 : guide pas à pas intégré. La plupart des artisans n'ont
            jamais entendu parler de "Place ID" → si on renvoie juste vers la
            doc dev.google.com ils décrochent. On explique 3 méthodes, la plus
            simple étant l'outil officiel Google en 3 clics. */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setShowGuide((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/50"
            aria-expanded={showGuide}
          >
            <span className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-blue-500" />
              C&apos;est quoi un Place ID ? Comment le trouver ?
            </span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${showGuide ? "rotate-180" : ""}`}
            />
          </button>

          {showGuide && (
            <div className="space-y-4 border-t border-slate-200 px-4 py-4 text-sm dark:border-slate-800">
              <div className="rounded-md bg-blue-50 p-3 text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
                <p>
                  <strong>Le Place ID</strong>, c&apos;est l&apos;identifiant unique de votre
                  entreprise sur Google Maps (comme un numéro d&apos;immatriculation). Il ressemble
                  à ça : <code className="rounded bg-white/60 px-1 font-mono text-xs dark:bg-slate-900/60">ChIJN1t_tDeuEmsRUsoyG83frY4</code>.
                  Il permet à Vitrix de savoir précisément quelle fiche Google est la vôtre pour
                  y récupérer vos vrais avis et diriger vos clients dessus.
                </p>
              </div>

              <div>
                <p className="mb-2 font-semibold text-slate-900 dark:text-slate-100">
                  ✅ Méthode 1 — La plus simple (3 clics, recommandée)
                </p>
                <ol className="list-inside list-decimal space-y-2 pl-1 text-slate-700 dark:text-slate-300">
                  <li>
                    Ouvrez l&apos;outil officiel Google :{" "}
                    <a
                      href="https://developers.google.com/maps/documentation/places/web-service/place-id?hl=fr#find-id"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Place ID Finder <ExternalLink className="h-3 w-3" />
                    </a>
                  </li>
                  <li>
                    Dans la barre de recherche (sur la carte), tapez le nom de votre entreprise
                    + votre ville (ex: <em>Plomberie Dupont Villepinte</em>).
                  </li>
                  <li>
                    Cliquez sur votre fiche → une bulle blanche s&apos;ouvre avec votre
                    <strong> Place ID </strong> en gras. Copiez-le et collez-le dans le champ
                    ci-dessus.
                  </li>
                </ol>
              </div>

              <div>
                <p className="mb-2 font-semibold text-slate-900 dark:text-slate-100">
                  🔎 Méthode 2 — Depuis l&apos;URL Google Maps
                </p>
                <ol className="list-inside list-decimal space-y-1 pl-1 text-slate-700 dark:text-slate-300">
                  <li>
                    Allez sur{" "}
                    <a
                      href="https://www.google.com/maps"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Google Maps
                    </a>
                    , cherchez votre entreprise et cliquez sur votre fiche.
                  </li>
                  <li>
                    Regardez l&apos;URL dans votre navigateur, elle contient une longue chaîne
                    du type <code className="rounded bg-slate-100 px-1 font-mono text-xs dark:bg-slate-800">!1s0x…:0xABC…</code>.
                  </li>
                  <li>
                    ⚠️ Cette chaîne n&apos;est PAS votre Place ID directement — préférez la méthode 1
                    qui est plus fiable.
                  </li>
                </ol>
              </div>

              <div>
                <p className="mb-2 font-semibold text-slate-900 dark:text-slate-100">
                  📱 Méthode 3 — Depuis votre compte Google Business Profile
                </p>
                <ol className="list-inside list-decimal space-y-1 pl-1 text-slate-700 dark:text-slate-300">
                  <li>
                    Connectez-vous sur{" "}
                    <a
                      href="https://business.google.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      business.google.com
                    </a>
                    .
                  </li>
                  <li>Ouvrez votre fiche → menu &quot;Partager votre fiche&quot;.</li>
                  <li>
                    Le lien court obtenu (<code className="rounded bg-slate-100 px-1 font-mono text-xs dark:bg-slate-800">g.page/…</code>)
                    contient l&apos;ID lisible mais pas le Place ID technique. Utilisez plutôt
                    la méthode 1.
                  </li>
                </ol>
              </div>

              <div className="rounded-md bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <p className="text-xs">
                  <strong>Pas encore de fiche Google Business ?</strong> Créez-la gratuitement
                  sur{" "}
                  <a
                    href="https://business.google.com/create"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline"
                  >
                    business.google.com/create
                  </a>
                  . Google mettra 1 à 2 semaines pour vérifier votre adresse (envoi d&apos;un code
                  par courrier), puis vous pourrez récupérer votre Place ID.
                </p>
              </div>
            </div>
          )}
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
