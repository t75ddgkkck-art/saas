/**
 * F5 (Lot 32) — <TeamManager />
 *
 * Composant client : liste des membres + invite + change role + revoke.
 * S'appuie sur useConfirm/useToast pour les interactions.
 */

"use client";

import { useEffect, useState } from "react";
import { Mail, UserPlus, Trash2, Loader2, Check, Clock, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/useConfirm";
import { ROLE_LABELS, canManageRole, type TeamRole } from "@/lib/team-permissions";
import { getLimit } from "@/lib/entitlements";
import type { SubscriptionPlan } from "@/lib/permissions";

interface Member {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  memberRole: string;
  active: boolean;
  invitedAt: string;
  acceptedAt: string | null;
  userId: string | null;
  invitedByName: string | null;
}

interface TeamManagerProps {
  currentRole: TeamRole;
  isOwner: boolean;
  plan: SubscriptionPlan;
}

export function TeamManager({ currentRole, isOwner, plan }: TeamManagerProps) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const maxSeats = getLimit(plan, "maxTeamMembers");
  const activeCount = (members ?? []).filter((m) => m.active).length;
  const seatsInfo =
    maxSeats === -1
      ? `${activeCount} sièges (illimité en ${plan})`
      : `${activeCount} / ${maxSeats} sièges (plan ${plan})`;

  const canInvite = currentRole === "owner" || currentRole === "admin";
  const canManage = canInvite;

  async function loadMembers() {
    setLoading(true);
    try {
      const res = await fetch("/api/team");
      if (!res.ok) throw new Error("load");
      const data = await res.json();
      setMembers(data.members ?? []);
    } catch {
      toast.error("Impossible de charger l'équipe");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleChangeRole(member: Member, newRole: TeamRole) {
    if (!canManageRole(currentRole, newRole)) {
      toast.error(`Votre rôle (${currentRole}) ne permet pas d'assigner ${newRole}`);
      return;
    }
    setBusyId(member.id);
    try {
      const res = await fetch(`/api/team/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberRole: newRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur");
        return;
      }
      toast.success(`Rôle mis à jour : ${ROLE_LABELS[newRole].label}`);
      await loadMembers();
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(member: Member) {
    const ok = await confirm({
      title: `Retirer ${member.firstName} ${member.lastName ?? ""} de l'équipe ?`,
      description:
        "Le membre perdra immédiatement l'accès au dashboard. Les données restent (RDV, devis créés).",
      confirmLabel: "Retirer",
      cancelLabel: "Annuler",
      variant: "danger",
    });
    if (!ok) return;

    setBusyId(member.id);
    try {
      const res = await fetch(`/api/team/${member.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur");
        return;
      }
      toast.success("Membre retiré");
      await loadMembers();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {dialog}

      {/* Header actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-600 dark:text-slate-400">{seatsInfo}</div>
        {canInvite && (
          <Button onClick={() => setInviteOpen(true)} size="sm">
            <UserPlus className="mr-2 h-4 w-4" aria-hidden />
            Inviter un membre
          </Button>
        )}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-hidden />
        </div>
      ) : !members || members.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-8 text-center">
          <Mail className="mx-auto mb-3 h-8 w-8 text-slate-400" aria-hidden />
          <p className="text-sm text-slate-600 dark:text-slate-300">Aucun membre pour le moment.</p>
          {canInvite && (
            <p className="mt-1 text-xs text-slate-500">
              Cliquez sur &quot;Inviter un membre&quot; pour commencer.
            </p>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {/* Owner (implicite) */}
          {isOwner && (
            <li className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  Vous <span className="text-xs font-normal text-slate-500">· Propriétaire</span>
                </p>
                <p className="text-xs text-slate-500">Accès total au business</p>
              </div>
              <span className="rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-2 py-0.5 text-[10px] font-semibold">
                Owner
              </span>
            </li>
          )}
          {members.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              currentRole={currentRole}
              canManage={canManage}
              busy={busyId === m.id}
              onChangeRole={handleChangeRole}
              onRemove={handleRemove}
            />
          ))}
        </ul>
      )}

      {/* Modal invitation */}
      {inviteOpen && (
        <InviteModal
          currentRole={currentRole}
          onClose={() => setInviteOpen(false)}
          onSuccess={() => {
            setInviteOpen(false);
            loadMembers();
          }}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sous-composants
// -----------------------------------------------------------------------------

function MemberRow({
  member,
  currentRole,
  canManage,
  busy,
  onChangeRole,
  onRemove,
}: {
  member: Member;
  currentRole: TeamRole;
  canManage: boolean;
  busy: boolean;
  onChangeRole: (m: Member, r: TeamRole) => void;
  onRemove: (m: Member) => void;
}) {
  const currentMemberRole = (member.memberRole as TeamRole) || "employee";
  const canManageThis = canManage && canManageRole(currentRole, currentMemberRole);
  const isPending = !member.acceptedAt;

  return (
    <li className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              {member.firstName} {member.lastName ?? ""}
            </p>
            {isPending && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 px-2 py-0.5 text-[10px] font-semibold">
                <Clock className="h-3 w-3" aria-hidden /> Invitation envoyée
              </span>
            )}
            {!member.active && !isPending && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 px-2 py-0.5 text-[10px] font-semibold">
                Désactivé
              </span>
            )}
            {member.acceptedAt && member.active && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-semibold">
                <Check className="h-3 w-3" aria-hidden /> Actif
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">{member.email}</p>
        </div>
        <div className="flex items-center gap-2">
          {canManageThis ? (
            <select
              value={currentMemberRole}
              disabled={busy}
              onChange={(e) => onChangeRole(member, e.target.value as TeamRole)}
              className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-900 dark:text-slate-100"
            >
              <option value="admin">Administrateur</option>
              <option value="employee">Employé</option>
              <option value="viewer">Lecture seule</option>
            </select>
          ) : (
            <span className="rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 text-[10px] font-semibold">
              {ROLE_LABELS[currentMemberRole]?.label ?? currentMemberRole}
            </span>
          )}
          {canManageThis && (
            <button
              type="button"
              onClick={() => onRemove(member)}
              disabled={busy}
              className="rounded-md p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
              aria-label="Retirer"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="h-4 w-4" aria-hidden />
              )}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function InviteModal({
  currentRole,
  onClose,
  onSuccess,
}: {
  currentRole: TeamRole;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<TeamRole>("employee");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const toast = useToast();

  // Filtre les rôles que l'user courant peut assigner
  const assignableRoles: TeamRole[] = (["admin", "employee", "viewer"] as TeamRole[]).filter((r) =>
    canManageRole(currentRole, r)
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, firstName, lastName, memberRole: role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Erreur");
        return;
      }
      toast.success(`Invitation envoyée à ${email}`);
      onSuccess();
    } catch {
      setErrorMsg("Erreur réseau, veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="Inviter un membre">
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</span>
          <Input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value.toLowerCase())}
            placeholder="collegue@exemple.com"
            className="mt-1"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Prénom</span>
            <Input
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="mt-1"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Nom</span>
            <Input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="mt-1"
            />
          </label>
        </div>
        <label className="block">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Rôle</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as TeamRole)}
            className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
          >
            {assignableRoles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r].label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">{ROLE_LABELS[role]?.description}</p>
        </label>

        {errorMsg && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            Annuler
          </Button>
          <Button type="submit" loading={submitting} className="flex-1">
            Envoyer l&apos;invitation
          </Button>
        </div>
      </form>
    </Modal>
  );
}
