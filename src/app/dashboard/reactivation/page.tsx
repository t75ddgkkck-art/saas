"use client";

/**
 * Lot 49 (F13) — Dashboard "Clients à recontacter".
 *
 * Layer 1 (scoring déterministe) : accessible à TOUS plans → aperçu gratuit
 * Layer 2 (génération message IA) : gated Premium → bouton "Générer avec l'IA"
 *
 * UI :
 *  1. Header pédagogique
 *  2. Liste top 10 candidats avec score + factors (badges)
 *  3. Panneau side pour message généré + éditable + envoi
 */

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageTitle } from "@/components/layout/PageTitle";
import { useEntitlement } from "@/hooks/useEntitlement";
import Link from "next/link";
import {
  Sparkles,
  Send,
  Mail,
  MessageSquare,
  RefreshCw,
  Users,
  TrendingUp,
  Lock,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface Factor {
  key: string;
  label: string;
  impact: "positive" | "negative" | "neutral";
}

interface Candidate {
  clientId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  lastContact: string | null;
  appointmentsCount: number;
  totalSpent: string | null;
  score: number;
  factors: Factor[];
  daysSinceLastContact: number | null;
}

interface Suggestion {
  clientId: string;
  reason: string;
  suggestedChannel: "email" | "sms";
  suggestedMessage: string;
}

// Palette badge selon impact
function badgeVariant(impact: Factor["impact"]): "success" | "danger" | "default" {
  if (impact === "positive") return "success";
  if (impact === "negative") return "danger";
  return "default";
}

export default function ReactivationPage() {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<Map<string, Suggestion>>(new Map());
  const [editedMessages, setEditedMessages] = useState<Map<string, string>>(new Map());
  const [subjects, setSubjects] = useState<Map<string, string>>(new Map());
  const [sending, setSending] = useState<string | null>(null);
  const toast = useToast();

  const { allowed: canGenerateAi } = useEntitlement("crm.reactivation_ai");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reactivation/candidates?limit=10");
      const data = await res.json();
      if (data.ok) {
        setCandidates(data.candidates ?? []);
      } else {
        toast.error("Impossible de charger les candidats");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleGenerate = async () => {
    if (!candidates || candidates.length === 0) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/reactivation/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientIds: candidates.slice(0, 10).map((c) => c.clientId),
        }),
      });
      const data = await res.json();
      if (data.ok && data.suggestions) {
        const map = new Map<string, Suggestion>();
        for (const s of data.suggestions as Suggestion[]) {
          map.set(s.clientId, s);
        }
        setSuggestions(map);
        toast.success(`${map.size} messages générés par l'IA`);
      } else if (res.status === 402) {
        toast.error("Fonctionnalité Premium requise");
      } else if (res.status === 429 && data.quotaExceeded) {
        toast.error(
          `Quota IA mensuel atteint (${data.used}/${data.limit}). Réessayez le mois prochain.`
        );
      } else {
        toast.error(data.error ?? "Génération IA impossible");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async (candidate: Candidate) => {
    const suggestion = suggestions.get(candidate.clientId);
    const messageToSend =
      editedMessages.get(candidate.clientId) ?? suggestion?.suggestedMessage ?? "";
    if (!messageToSend.trim()) {
      toast.error("Message vide");
      return;
    }
    setSending(candidate.clientId);
    try {
      const res = await fetch("/api/reactivation/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: candidate.clientId,
          channel: suggestion?.suggestedChannel ?? "email",
          message: messageToSend,
          subject: subjects.get(candidate.clientId),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(
          `Message envoyé à ${candidate.firstName} ${candidate.lastName}`
        );
        // Retire le candidat de la liste (déjà contacté)
        setCandidates((prev) =>
          prev ? prev.filter((c) => c.clientId !== candidate.clientId) : prev
        );
        // Nettoie les états locaux
        setSuggestions((prev) => {
          const next = new Map(prev);
          next.delete(candidate.clientId);
          return next;
        });
      } else {
        toast.error(data.error ?? "Envoi impossible");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 space-y-6">
      <PageTitle title="Clients à recontacter" />

      {/* Header pédagogique */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 p-6 text-white sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
            <TrendingUp className="h-6 w-6" aria-hidden />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold sm:text-3xl">Reconnectez-vous avec vos clients</h1>
            <p className="mt-2 text-sm text-slate-200 sm:text-base">
              Notre algorithme identifie vos clients dormants les plus susceptibles de vous rappeler.
              {canGenerateAi ? (
                <> L&apos;IA rédige pour vous des messages personnalisés — prêts à envoyer.</>
              ) : (
                <>
                  {" "}
                  <Link href="/tarifs" className="underline font-semibold">
                    Passez Premium
                  </Link>{" "}
                  pour laisser l&apos;IA rédiger les messages à votre place.
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={load} loading={loading} leftIcon={<RefreshCw className="h-4 w-4" />}>
          Actualiser
        </Button>
        {canGenerateAi ? (
          <Button
            onClick={handleGenerate}
            loading={generating}
            disabled={!candidates || candidates.length === 0}
            leftIcon={<Sparkles className="h-4 w-4" />}
          >
            Générer messages IA
          </Button>
        ) : (
          <Link href="/tarifs">
            <Button variant="secondary" leftIcon={<Sparkles className="h-4 w-4" />}>
              Débloquer avec Premium
            </Button>
          </Link>
        )}
      </div>

      {/* Liste candidats */}
      {loading && !candidates ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : !candidates || candidates.length === 0 ? (
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="Aucun client à recontacter pour l'instant"
          description="Il faut au moins un client avec un RDV historique et une période de silence > 2 mois pour apparaître ici."
        />
      ) : (
        <div className="space-y-3">
          {candidates.map((c) => {
            const suggestion = suggestions.get(c.clientId);
            const currentMessage = editedMessages.get(c.clientId) ?? suggestion?.suggestedMessage ?? "";
            const isSending = sending === c.clientId;
            return (
              <Card key={c.clientId}>
                <CardContent className="p-4 sm:p-5 space-y-3">
                  {/* Header candidat */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                          {c.firstName} {c.lastName}
                        </p>
                        <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Score {c.score}/100
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        {c.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {c.email}
                          </span>
                        )}
                        <span>· {c.appointmentsCount} RDV</span>
                        {c.totalSpent && Number(c.totalSpent) > 0 && (
                          <span>· {formatPrice(Number(c.totalSpent))}</span>
                        )}
                        {c.daysSinceLastContact !== null && (
                          <span>· Silence {c.daysSinceLastContact}j</span>
                        )}
                      </div>
                      {/* Factors badges */}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {c.factors.map((f) => (
                          <Badge key={f.key} variant={badgeVariant(f.impact)}>
                            {f.label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Suggestion IA si présente */}
                  {suggestion && (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3 space-y-3">
                      <div className="flex items-center gap-2 text-xs">
                        <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Suggestion IA
                        </span>
                        <span className="text-slate-500">·</span>
                        {suggestion.suggestedChannel === "email" ? (
                          <span className="flex items-center gap-1 text-slate-500">
                            <Mail className="h-3 w-3" /> Email
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-slate-500">
                            <MessageSquare className="h-3 w-3" /> SMS
                          </span>
                        )}
                      </div>
                      <p className="text-xs italic text-slate-600 dark:text-slate-400">
                        {suggestion.reason}
                      </p>

                      {suggestion.suggestedChannel === "email" && (
                        <Input
                          label="Objet email"
                          placeholder={`Un message de votre professionnel`}
                          value={subjects.get(c.clientId) ?? ""}
                          onChange={(e) =>
                            setSubjects((prev) => {
                              const next = new Map(prev);
                              next.set(c.clientId, e.target.value);
                              return next;
                            })
                          }
                        />
                      )}

                      <Textarea
                        label="Message (éditable)"
                        rows={suggestion.suggestedChannel === "sms" ? 3 : 6}
                        value={currentMessage}
                        onChange={(e) =>
                          setEditedMessages((prev) => {
                            const next = new Map(prev);
                            next.set(c.clientId, e.target.value);
                            return next;
                          })
                        }
                      />
                      {suggestion.suggestedChannel === "sms" && (
                        <p className="text-xs text-slate-500">
                          {currentMessage.length}/160 caractères
                        </p>
                      )}

                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSend(c)}
                          loading={isSending}
                          disabled={!c.email && suggestion.suggestedChannel === "email"}
                          leftIcon={<Send className="h-3.5 w-3.5" />}
                        >
                          Envoyer
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Pas de suggestion + not Premium → CTA visible */}
                  {!suggestion && !canGenerateAi && (
                    <div className="flex items-start gap-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 p-3 text-xs">
                      <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                      <span className="text-slate-600 dark:text-slate-400">
                        Passez <strong>Premium</strong> pour que l&apos;IA rédige un message
                        personnalisé pour ce client.
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
