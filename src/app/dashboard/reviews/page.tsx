"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Star, ThumbsUp, Send, Check, Sparkles, Copy } from "lucide-react";
// Lot 58 MAJ3 : remplacement de la bannière "Bientôt disponible" par un vrai
// composant fonctionnel (saisie Place ID, test du lien avis).
import { GoogleReviewsCard } from "@/components/reviews/GoogleReviewsCard";

const mockReviews = [
  {
    id: 1,
    name: "Marie L.",
    rating: 5,
    comment:
      "Excellent service ! Jean est intervenu rapidement pour une fuite d'eau. Travail impeccable et prix raisonnable.",
    source: "google",
    date: "2025-01-12",
    published: true,
  },
  {
    id: 2,
    name: "Pierre M.",
    rating: 5,
    comment: "Très professionnel et ponctuel. Il a réparé notre chauffe-eau en moins d'une heure.",
    source: "google",
    date: "2025-01-11",
    published: true,
  },
  {
    id: 3,
    name: "Sophie B.",
    rating: 4,
    comment: "Bon travail, un peu d'attente mais le résultat est parfait.",
    source: "platform",
    date: "2025-01-10",
    published: true,
  },
  {
    id: 4,
    name: "Lucas R.",
    rating: 5,
    comment: "Intervention d'urgence un dimanche soir. Service exceptionnel !",
    source: "google",
    date: "2025-01-09",
    published: true,
  },
  {
    id: 5,
    name: "Claire P.",
    rating: 3,
    comment: "Correct mais un peu cher.",
    source: "platform",
    date: "2025-01-08",
    published: false,
  },
];

export default function ReviewsPage() {
  const [reviews, setReviews] = useState(mockReviews);
  const [aiReplies, setAiReplies] = useState<Record<number, string>>({});
  const [loadingReply, setLoadingReply] = useState<number | null>(null);
  const [copiedReply, setCopiedReply] = useState<number | null>(null);

  const generateReply = async (reviewId: number) => {
    setLoadingReply(reviewId);
    try {
      const res = await fetch("/api/reviews/ai-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId: String(reviewId) }),
      });
      const data = await res.json();
      setAiReplies((prev) => ({ ...prev, [reviewId]: data.reply || data.error }));
    } finally {
      setLoadingReply(null);
    }
  };

  const copyReply = async (reviewId: number) => {
    await navigator.clipboard.writeText(aiReplies[reviewId]);
    setCopiedReply(reviewId);
    setTimeout(() => setCopiedReply(null), 2000);
  };
  const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

  return (
    <div className="space-y-6">
      {/* Lot 58 MAJ3 : configuration Google Reviews (Place ID + lien avis). */}
      <GoogleReviewsCard />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Avis clients</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Gérez les avis de vos clients
          </p>
        </div>
        <Button>
          <Send className="mr-2 h-4 w-4" />
          Demander un avis
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="flex items-center justify-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-6 w-6 ${i < Math.round(avgRating) ? "fill-amber-400 text-amber-400" : "text-slate-200 dark:text-slate-700"}`}
                />
              ))}
            </div>
            <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">
              {avgRating.toFixed(1)}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Note moyenne</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              {reviews.filter((r) => r.published).length}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Avis publiés</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              {reviews.filter((r) => r.source === "google").length}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Avis Google</p>
          </CardContent>
        </Card>
      </div>

      {/* Reviews list */}
      <div className="space-y-3">
        {reviews.map((review) => (
          <Card key={review.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {review.name[0]}
                  </div>
                  <div>
                    <h3 className="font-medium text-slate-900 dark:text-slate-100">
                      {review.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{review.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${i < review.rating ? "fill-amber-400 text-amber-400" : "text-slate-200 dark:text-slate-700"}`}
                      />
                    ))}
                  </div>
                  <Badge variant={review.source === "google" ? "info" : "default"}>
                    {review.source === "google" ? "Google" : "Plateforme"}
                  </Badge>
                  {!review.published && <Badge variant="warning">Non publié</Badge>}
                </div>
              </div>
              {review.comment && (
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{review.comment}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {review.published ? (
                  <Badge variant="success">
                    <Check className="mr-1 h-3 w-3" /> Publié
                  </Badge>
                ) : (
                  <Button variant="outline" size="sm">
                    <ThumbsUp className="mr-1 h-3 w-3" /> Publier
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  loading={loadingReply === review.id}
                  onClick={() => generateReply(review.id)}
                >
                  <Sparkles className="mr-1 h-3 w-3" /> Répondre avec l'IA
                </Button>
              </div>
              {aiReplies[review.id] && (
                <div className="mt-3 rounded-xl bg-purple-50 p-4 dark:bg-purple-900/10">
                  <p className="text-xs font-medium uppercase tracking-wider text-purple-500 mb-1">
                    ✨ Réponse suggérée
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {aiReplies[review.id]}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => copyReply(review.id)}
                  >
                    {copiedReply === review.id ? (
                      <Check className="mr-1 h-3 w-3" />
                    ) : (
                      <Copy className="mr-1 h-3 w-3" />
                    )}
                    {copiedReply === review.id ? "Copié !" : "Copier la réponse"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
