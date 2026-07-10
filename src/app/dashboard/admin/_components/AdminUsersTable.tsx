"use client";

/**
 * Table des utilisateurs — recherche + pagination + ban/unban inline.
 * Client Component pour interactions live (fetch API, refresh, toast).
 */

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/useConfirm";

interface AdminUserRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  subscription: string;
  subscriptionStatus: string | null;
  bannedAt: string | null;
  createdAt: string;
}

interface UsersResponse {
  users: AdminUserRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function AdminUsersTable() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  // Lot 22 : modal ban avec raison (remplace window.prompt)
  const [banTarget, setBanTarget] = useState<string | null>(null);
  const [banReason, setBanReason] = useState("");
  const [banning, setBanning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL("/api/admin/users", window.location.origin);
      url.searchParams.set("page", String(page));
      url.searchParams.set("limit", "25");
      if (q) url.searchParams.set("q", q);
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Erreur de chargement");
      setData(await res.json());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [q, page, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  // Lot 22 : ban = ouvrir modal dédié (raison requise, UX pro vs window.prompt)
  function openBan(id: string) {
    setBanTarget(id);
    setBanReason("");
  }

  async function submitBan() {
    if (!banTarget) return;
    if (banReason.trim().length < 3) {
      toast.error("La raison doit contenir au moins 3 caractères");
      return;
    }
    setBanning(true);
    try {
      const res = await fetch(`/api/admin/users/${banTarget}/ban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: banReason.trim() }),
      });
      if (res.ok) {
        toast.success("Utilisateur banni");
        setBanTarget(null);
        setBanReason("");
        void load();
      } else {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error || "Erreur");
      }
    } finally {
      setBanning(false);
    }
  }

  // Lot 22 : unban via ConfirmDialog stylé (remplace window.confirm)
  async function unban(id: string) {
    const ok = await confirm({
      title: "Réactiver ce compte ?",
      description: "L'utilisateur pourra à nouveau se connecter immédiatement.",
      variant: "info",
      confirmLabel: "Débannir",
    });
    if (!ok) return;
    const res = await fetch(`/api/admin/users/${id}/ban`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Utilisateur réactivé");
      void load();
    } else {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error || "Erreur");
    }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          void load();
        }}
        className="flex gap-2"
      >
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher email, nom, prénom…"
          aria-label="Recherche utilisateur"
        />
        <Button type="submit" disabled={loading}>
          {loading ? "…" : "Rechercher"}
        </Button>
      </form>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <th className="py-2 pr-3">Email</th>
              <th className="py-2 pr-3">Nom</th>
              <th className="py-2 pr-3">Plan</th>
              <th className="py-2 pr-3">Statut</th>
              <th className="py-2 pr-3">Créé le</th>
              <th className="py-2 pr-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data?.users.map((u) => (
              <tr
                key={u.id}
                className="border-b border-slate-100 last:border-0 dark:border-slate-800/50"
              >
                <td className="py-2 pr-3 font-mono text-xs">{u.email}</td>
                <td className="py-2 pr-3">
                  {u.firstName} {u.lastName}
                </td>
                <td className="py-2 pr-3">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">
                    {u.subscription}
                  </span>
                </td>
                <td className="py-2 pr-3">
                  {u.bannedAt ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
                      banni
                    </span>
                  ) : u.subscriptionStatus ? (
                    <span className="text-xs text-slate-500">{u.subscriptionStatus}</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2 pr-3 text-xs text-slate-500">
                  {new Date(u.createdAt).toLocaleDateString("fr-FR")}
                </td>
                <td className="py-2 pr-3">
                  {u.bannedAt ? (
                    <Button size="sm" variant="outline" onClick={() => unban(u.id)}>
                      Débannir
                    </Button>
                  ) : (
                    <Button size="sm" variant="destructive" onClick={() => openBan(u.id)}>
                      Bannir
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {data && data.users.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-sm text-slate-500">
                  Aucun utilisateur trouvé.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            Page {data.page} / {data.totalPages} · {data.total} au total
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              ← Précédent
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page >= data.totalPages}
            >
              Suivant →
            </Button>
          </div>
        </div>
      )}

      {/* Lot 22 : dialog impératif pour unban (remplace window.confirm) */}
      {dialog}

      {/* Lot 22 : modal ban avec raison textarea (remplace window.prompt) */}
      <Modal
        isOpen={banTarget !== null}
        onClose={() => {
          setBanTarget(null);
          setBanReason("");
        }}
        title="Bannir cet utilisateur"
        description="Le compte sera immédiatement suspendu. L'utilisateur ne pourra plus se connecter mais ses données restent intactes."
        size="md"
      >
        <div className="space-y-4">
          <Textarea
            label="Raison du bannissement"
            placeholder="Ex : violation CGU section 8 (faux avis)"
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
            required
            minLength={3}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setBanTarget(null);
                setBanReason("");
              }}
            >
              Annuler
            </Button>
            <Button variant="destructive" onClick={submitBan} loading={banning}>
              Bannir
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
