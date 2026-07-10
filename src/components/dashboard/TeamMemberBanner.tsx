/**
 * F5 (Lot 32) — Bandeau affiché en haut du dashboard si l'user est un membre
 * invité (non-owner) d'un business. Rappelle à quel business + rôle il est
 * connecté (utile pour un user qui gère plusieurs businesses).
 *
 * Dismissable via localStorage (session, pas persistant sur les jours).
 */

"use client";

import { useEffect, useState } from "react";
import { Users, X } from "lucide-react";

interface TeamContextResponse {
  ok: boolean;
  business?: { id: string; name: string; slug: string };
  role?: "owner" | "admin" | "employee" | "viewer";
  isOwner?: boolean;
}

const ROLE_LABEL_FR: Record<string, string> = {
  owner: "Propriétaire",
  admin: "Administrateur",
  employee: "Employé",
  viewer: "Lecture seule",
};

export function TeamMemberBanner() {
  const [context, setContext] = useState<TeamContextResponse | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Session storage (pas localStorage) → réapparaît à chaque nouvelle session
    if (sessionStorage.getItem("vx_team_banner_dismissed") === "1") {
      setDismissed(true);
      return;
    }
    fetch("/api/team/context")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setContext(data));
  }, []);

  if (dismissed || !context?.ok || context.isOwner) return null;

  const roleLabel = ROLE_LABEL_FR[context.role ?? "employee"] ?? context.role ?? "membre";

  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50 dark:bg-indigo-950/40 p-3 text-sm text-indigo-900 dark:text-indigo-200">
      <Users className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="flex-1">
        Vous êtes connecté en tant que <strong>{roleLabel}</strong> de{" "}
        <strong>{context.business?.name}</strong>. Vos actions sont soumises aux permissions
        associées à ce rôle.
      </div>
      <button
        type="button"
        onClick={() => {
          sessionStorage.setItem("vx_team_banner_dismissed", "1");
          setDismissed(true);
        }}
        className="rounded p-0.5 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60"
        aria-label="Fermer"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
