"use client";

/**
 * Table des utilisateurs — recherche + pagination + ban/unban inline.
 * Client Component pour interactions live (fetch API, refresh, toast).
 */

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

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

  async function ban(id: string) {
    const reason = window.prompt("Raison du bannissement (min. 3 caractères) :");
    if (!reason || reason.length < 3) return;
    const res = await fetch(`/api/admin/users/${id}/ban`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (res.ok) {
      toast.success("Utilisateur banni");
      void load();
    } else {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error || "Erreur");
    }
  }

  async function unban(id: string) {
    if (!window.confirm("Débannir cet utilisateur ?")) return;
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
                    <Button size="sm" variant="destructive" onClick={() => ban(u.id)}>
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
    </div>
  );
}
