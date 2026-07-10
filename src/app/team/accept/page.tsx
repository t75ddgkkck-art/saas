/**
 * F5 (Lot 32) — /team/accept?token=<raw>
 *
 * Page publique d'acceptation d'invitation d'équipe.
 * Flux :
 *  - Peek /api/team/accept?token= → affiche infos business + role
 *  - Si user connecté avec le bon email → bouton "Accepter"
 *  - Si user pas connecté → CTA "Se connecter" + "Créer un compte"
 *  - Si user connecté avec mauvais email → CTA "Se déconnecter et se reconnecter"
 */

"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Users, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_LABELS } from "@/lib/team-permissions";

interface PeekResult {
  ok: boolean;
  email?: string;
  memberRole?: "admin" | "employee" | "viewer";
  businessName?: string | null;
  businessSlug?: string | null;
  expiresAt?: string;
  reason?: string;
}

function AcceptInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";
  const { user } = useAuth();
  const [peek, setPeek] = useState<PeekResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setPeek({ ok: false, reason: "missing_token" });
      setLoading(false);
      return;
    }
    fetch(`/api/team/accept?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => setPeek(data))
      .catch(() => setPeek({ ok: false, reason: "network" }))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleAccept() {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/team/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Erreur lors de l'acceptation");
        return;
      }
      // Redirect vers dashboard — l'user est maintenant membre
      router.push("/dashboard?welcome=team");
    } catch {
      setErrorMsg("Erreur réseau, veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-hidden />
      </div>
    );
  }

  if (!peek?.ok) {
    return (
      <Card>
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 text-red-600">
          <AlertCircle className="h-7 w-7" aria-hidden />
        </div>
        <h1 className="mb-2 text-xl font-semibold text-slate-900 dark:text-white">
          Invitation invalide
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {peek?.reason === "not_found_or_expired"
            ? "Cette invitation est expirée ou a déjà été utilisée."
            : peek?.reason === "invalid_token"
              ? "Le lien d'invitation est incomplet."
              : "Nous n'avons pas pu trouver cette invitation."}
        </p>
        <Link
          href="/"
          className="mt-6 inline-block text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          Retour à l&apos;accueil
        </Link>
      </Card>
    );
  }

  const roleInfo = peek.memberRole ? ROLE_LABELS[peek.memberRole] : null;

  // User pas connecté → CTA login/register
  if (!user) {
    return (
      <Card>
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600">
          <Users className="h-7 w-7" aria-hidden />
        </div>
        <h1 className="mb-2 text-xl font-semibold text-slate-900 dark:text-white">
          Rejoindre {peek.businessName ?? "cette équipe"}
        </h1>
        <p className="mb-6 text-sm text-slate-600 dark:text-slate-300">
          Vous êtes invité à rejoindre <strong>{peek.businessName ?? "cette équipe"}</strong> en
          tant que <strong>{roleInfo?.label ?? peek.memberRole}</strong>.
        </p>
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
          Connectez-vous avec l&apos;email <strong>{peek.email}</strong> pour accepter cette
          invitation. Si vous n&apos;avez pas encore de compte, créez-le d&apos;abord.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href={`/login?next=${encodeURIComponent(`/team/accept?token=${token}`)}`}
            className="flex-1 inline-flex items-center justify-center rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-2.5 text-sm font-semibold"
          >
            Se connecter
          </Link>
          <Link
            href={`/register?email=${encodeURIComponent(peek.email ?? "")}&next=${encodeURIComponent(`/team/accept?token=${token}`)}`}
            className="flex-1 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200"
          >
            Créer un compte
          </Link>
        </div>
      </Card>
    );
  }

  // User connecté mais email différent
  if ((user.email || "").toLowerCase() !== (peek.email || "").toLowerCase()) {
    return (
      <Card>
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600">
          <AlertCircle className="h-7 w-7" aria-hidden />
        </div>
        <h1 className="mb-2 text-xl font-semibold text-slate-900 dark:text-white">
          Compte différent
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Vous êtes connecté avec <strong>{user.email}</strong>, mais cette invitation cible{" "}
          <strong>{peek.email}</strong>.
        </p>
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
          Déconnectez-vous et reconnectez-vous avec {peek.email} pour accepter cette invitation.
        </p>
      </Card>
    );
  }

  // User connecté avec le bon email → bouton Accepter
  return (
    <Card>
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600">
        <Users className="h-7 w-7" aria-hidden />
      </div>
      <h1 className="mb-2 text-xl font-semibold text-slate-900 dark:text-white">
        Rejoindre {peek.businessName ?? "cette équipe"}
      </h1>
      <p className="mb-2 text-sm text-slate-600 dark:text-slate-300">
        Vous allez rejoindre <strong>{peek.businessName ?? "cette équipe"}</strong> en tant que{" "}
        <strong>{roleInfo?.label ?? peek.memberRole}</strong>.
      </p>
      {roleInfo && (
        <p className="mb-6 rounded-lg bg-slate-100 dark:bg-slate-800 p-3 text-xs text-slate-600 dark:text-slate-300">
          {roleInfo.description}
        </p>
      )}
      {errorMsg && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{errorMsg}</span>
        </div>
      )}
      <Button onClick={handleAccept} loading={submitting} className="w-full">
        <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden />
        Accepter l&apos;invitation
      </Button>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto mt-8 max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 text-center shadow-sm">
      {children}
    </div>
  );
}

export default function TeamAcceptPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto mt-12 max-w-md text-center text-slate-500">Chargement…</div>
      }
    >
      <AcceptInner />
    </Suspense>
  );
}
