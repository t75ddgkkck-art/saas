"use client";

/**
 * Lot 45 — Modal "Générer un devis avec l'IA".
 *
 * Wrap AUTOMATIQUEMENT par UpgradeGate(quotes.ai_generation) :
 * - Free / Pro → voient un CTA "Passer Premium" au lieu de la modal (mode blur)
 * - Premium → voient le vrai form
 *
 * Flow :
 *  1. User tape "Rénovation salle de bain 5m² carrelage sol + douche"
 *  2. Optionnel : titre custom
 *  3. Optionnel : radio "Remplacer / Ajouter à la suite" (défaut : Remplacer si
 *     0 ligne existante ou 1 ligne vide, Ajouter sinon)
 *  4. Clic "Générer" → POST /api/quotes/ai-generate (5-15s)
 *  5. Preview des lignes proposées + warning IA si présent
 *  6. Clic "Utiliser ces lignes" → onGenerated() callback qui injecte dans le form parent
 *  7. Modal se ferme
 *
 * Pattern : composant CONTRÔLÉ (isOpen + onClose venant du parent, comme les
 * autres Modal du projet).
 */

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { UpgradeGate } from "@/components/entitlements/UpgradeGate";
import { Sparkles, AlertTriangle, Wand2 } from "lucide-react";
import { formatPrice } from "@/lib/utils";

// -----------------------------------------------------------------------------
// Types miroir de la réponse API (voir /api/quotes/ai-generate/route.ts)
// -----------------------------------------------------------------------------
export interface AiGeneratedItem {
  description: string;
  quantity: number;
  unit_price: number;
  unit?: string;
}

export interface AiGenerateResult {
  title: string;
  items: AiGeneratedItem[];
  notes: string | null;
  warning: string | null;
  estimatedDays: number | null;
  suggestedTotal: number;
  tokensUsed: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Callback invoqué quand le pro valide l'utilisation des lignes IA.
   * Le parent est responsable de mapper vers son propre state form.
   * `mode` indique le choix radio : "replace" écrase / "append" ajoute à la suite.
   */
  onGenerated: (result: AiGenerateResult, mode: "replace" | "append") => void;
  /**
   * Nombre de lignes NON VIDES déjà présentes dans le form parent.
   * Sert à choisir le défaut du radio (0 → replace, ≥1 → append).
   */
  existingItemsCount: number;
}

/**
 * Wrapper — la Modal reste montée en permanence (contrôlée), mais le contenu
 * intérieur passe par le gate. Sur plans Free/Pro le user voit un CTA upgrade
 * PLEINE PAGE dans la modal, avec lien vers /tarifs.
 */
export function AiGenerateModal(props: Props) {
  return (
    <Modal
      isOpen={props.isOpen}
      onClose={props.onClose}
      title="Générer un devis avec l'IA"
      description="Décrivez le chantier en 1-2 phrases, l'IA propose les lignes détaillées avec prix médians du marché."
      size="lg"
    >
      <UpgradeGate feature="quotes.ai_generation" mode="card">
        <AiGenerateForm
          onClose={props.onClose}
          onGenerated={props.onGenerated}
          existingItemsCount={props.existingItemsCount}
        />
      </UpgradeGate>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Form interne — visible UNIQUEMENT si l'user a l'entitlement Premium
// -----------------------------------------------------------------------------
function AiGenerateForm({
  onClose,
  onGenerated,
  existingItemsCount,
}: {
  onClose: () => void;
  onGenerated: (result: AiGenerateResult, mode: "replace" | "append") => void;
  existingItemsCount: number;
}) {
  const [description, setDescription] = useState("");
  const [title, setTitle] = useState("");
  // Défaut : replace si 0 ligne existante, append sinon (moins destructif)
  const [mode, setMode] = useState<"replace" | "append">(
    existingItemsCount === 0 ? "replace" : "append"
  );
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<AiGenerateResult | null>(null);
  const toast = useToast();

  const submit = async () => {
    if (description.trim().length < 10) {
      toast.error("Description trop courte (10 caractères minimum)");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/quotes/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          title: title.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.items) {
        // handleApiError renvoie {ok:false, message} ou similaire
        const msg =
          data?.error ??
          data?.message ??
          (res.status === 402
            ? "Fonctionnalité Premium requise"
            : res.status === 429
              ? "Trop de générations récentes, patientez quelques minutes"
              : "Impossible de générer le devis");
        toast.error(msg);
        return;
      }
      setPreview(data as AiGenerateResult);
    } catch {
      toast.error("Erreur réseau, réessayez");
    } finally {
      setLoading(false);
    }
  };

  const apply = () => {
    if (!preview) return;
    onGenerated(preview, mode);
    toast.success(
      `${preview.items.length} ligne${preview.items.length > 1 ? "s" : ""} injectée${preview.items.length > 1 ? "s" : ""} dans le devis`
    );
    // Reset + close (le parent gère la fermeture via onClose s'il veut)
    setPreview(null);
    setDescription("");
    setTitle("");
    onClose();
  };

  // === Étape 2 : preview des lignes proposées ===
  if (preview) {
    return (
      <div className="space-y-4">
        {preview.warning && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{preview.warning}</span>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="border-b border-slate-200 p-3 dark:border-slate-800">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              {preview.items.length} ligne{preview.items.length > 1 ? "s" : ""} proposée
              {preview.items.length > 1 ? "s" : ""} par l&apos;IA
            </p>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {preview.items.map((it, i) => (
              <li key={i} className="flex items-start justify-between gap-3 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="text-slate-900 dark:text-slate-100">{it.description}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {it.quantity} {it.unit ?? "u"} × {formatPrice(it.unit_price)}
                  </p>
                </div>
                <p className="shrink-0 font-medium tabular-nums text-slate-900 dark:text-slate-100">
                  {formatPrice(it.quantity * it.unit_price)}
                </p>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-slate-200 p-3 text-sm font-semibold dark:border-slate-800">
            <span>Sous-total HT suggéré</span>
            <span className="tabular-nums">{formatPrice(preview.suggestedTotal)}</span>
          </div>
        </div>

        {preview.notes && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            <p className="mb-1 font-semibold uppercase tracking-wide text-slate-500">
              Notes suggérées
            </p>
            <p className="whitespace-pre-wrap">{preview.notes}</p>
          </div>
        )}

        {preview.estimatedDays && (
          <p className="text-xs text-slate-500">
            Délai estimé : <strong>{preview.estimatedDays} jour(s)</strong>
          </p>
        )}

        {/* Info tokens — pratique pour transparence + debug quota */}
        <p className="text-[10px] text-slate-400">
          {preview.tokensUsed} tokens utilisés
        </p>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button variant="outline" onClick={() => setPreview(null)}>
            ← Modifier la description
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button onClick={apply} leftIcon={<Wand2 className="h-4 w-4" />}>
              {mode === "replace" ? "Remplacer les lignes" : "Ajouter au devis"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // === Étape 1 : saisie description ===
  return (
    <div className="space-y-4">
      <Textarea
        label="Décrivez le chantier"
        placeholder="Ex: Rénovation complète d'une salle de bain de 5 m² : dépose ancien carrelage, pose carrelage sol + mur, installation douche italienne, remplacement WC et lavabo."
        rows={4}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
      />
      <p className="-mt-2 text-xs text-slate-500">
        Plus vous êtes précis (surface, matériaux, options), plus l&apos;IA propose des prix
        justes. Les prix sont indicatifs, à ajuster selon vos marges.
      </p>

      <Input
        label="Titre du devis (optionnel)"
        placeholder="Ex: Rénovation salle de bain 5m²"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      {/* Radio replace/append — visible SEULEMENT si le form parent a déjà des lignes.
          Sinon le défaut "replace" est OK sans demander. */}
      {existingItemsCount > 0 && (
        <div className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-800">
          <p className="mb-2 font-medium text-slate-700 dark:text-slate-300">
            Vous avez déjà {existingItemsCount} ligne{existingItemsCount > 1 ? "s" : ""} — que faire ?
          </p>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="ai-mode"
              checked={mode === "append"}
              onChange={() => setMode("append")}
              className="h-4 w-4 text-slate-900 focus:ring-slate-500"
            />
            <span>
              <strong>Ajouter à la suite</strong> — conserve vos lignes existantes
            </span>
          </label>
          <label className="mt-1 flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="ai-mode"
              checked={mode === "replace"}
              onChange={() => setMode("replace")}
              className="h-4 w-4 text-slate-900 focus:ring-slate-500"
            />
            <span>
              <strong>Remplacer</strong> — efface les lignes actuelles
            </span>
          </label>
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onClose}>
          Annuler
        </Button>
        <Button
          onClick={submit}
          loading={loading}
          leftIcon={<Sparkles className="h-4 w-4" />}
          disabled={description.trim().length < 10}
        >
          Générer avec l&apos;IA
        </Button>
      </div>
    </div>
  );
}
