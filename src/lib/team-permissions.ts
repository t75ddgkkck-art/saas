/**
 * F5 (Lot 32) — Permissions par rôle d'équipe.
 *
 * Séparé de `entitlements.ts` (qui gate par PLAN) et `permissions.ts` (legacy)
 * car ce module gate par RÔLE au sein d'un business (owner/admin/employee/viewer).
 *
 * Combinaison finale = plan (entitlements.ts) ET rôle (ce fichier).
 * Ex : `payments.stripe` est débloqué en Pro (entitlement) mais un `viewer`
 * ne peut pas éditer les paiements (permission rôle).
 *
 * Rôles :
 *  - owner    : le propriétaire (users.id === businesses.ownerId) — tout permis
 *  - admin    : bras droit — tout sauf supprimer le business / changer d'owner
 *  - employee : opérationnel — voit tout, édite ce qu'il crée + ce qui lui est assigné
 *  - viewer   : lecture seule (comptable, stagiaire)
 */

export type TeamRole = "owner" | "admin" | "employee" | "viewer";

// Liste EXHAUSTIVE des capabilities de l'app. Ajouter ici pour créer un
// nouveau garde. TS force à mettre à jour ROLE_PERMISSIONS.
export type TeamCapability =
  // --- Business ---
  | "business.edit" // modifier la vitrine, paramètres
  | "business.delete" // supprimer le business (owner uniquement)
  // --- Équipe ---
  | "team.view"
  | "team.invite"
  | "team.remove"
  | "team.change_role"
  // --- Rendez-vous ---
  | "appointments.view"
  | "appointments.create"
  | "appointments.edit_any" // éditer n'importe quel RDV
  | "appointments.edit_assigned" // éditer uniquement les RDV assignés à soi
  | "appointments.delete"
  | "appointments.assign" // assigner à un autre membre
  // --- Devis ---
  | "quotes.view"
  | "quotes.create"
  | "quotes.edit_any"
  | "quotes.edit_assigned"
  | "quotes.delete"
  | "quotes.assign"
  // --- CRM Clients ---
  | "clients.view"
  | "clients.create"
  | "clients.edit"
  | "clients.delete"
  | "clients.export" // export CSV / RGPD
  // --- Paiements ---
  | "payments.view"
  | "payments.create"
  | "payments.refund"
  // --- Facturation & abonnement ---
  | "billing.view"
  | "billing.manage" // changer plan, Stripe portal
  // --- IA / analytics ---
  | "analytics.view"
  | "ai.use";

// Matrice canonique — modifier ici pour changer les droits.
// Tests snapshot (tests/unit/team-permissions.test.ts) figent cette matrice.
export const ROLE_PERMISSIONS: Readonly<Record<TeamRole, readonly TeamCapability[]>> = {
  owner: [
    "business.edit",
    "business.delete",
    "team.view",
    "team.invite",
    "team.remove",
    "team.change_role",
    "appointments.view",
    "appointments.create",
    "appointments.edit_any",
    "appointments.edit_assigned",
    "appointments.delete",
    "appointments.assign",
    "quotes.view",
    "quotes.create",
    "quotes.edit_any",
    "quotes.edit_assigned",
    "quotes.delete",
    "quotes.assign",
    "clients.view",
    "clients.create",
    "clients.edit",
    "clients.delete",
    "clients.export",
    "payments.view",
    "payments.create",
    "payments.refund",
    "billing.view",
    "billing.manage",
    "analytics.view",
    "ai.use",
  ],
  admin: [
    "business.edit",
    // pas business.delete (owner only)
    "team.view",
    "team.invite",
    "team.remove",
    "team.change_role",
    "appointments.view",
    "appointments.create",
    "appointments.edit_any",
    "appointments.edit_assigned",
    "appointments.delete",
    "appointments.assign",
    "quotes.view",
    "quotes.create",
    "quotes.edit_any",
    "quotes.edit_assigned",
    "quotes.delete",
    "quotes.assign",
    "clients.view",
    "clients.create",
    "clients.edit",
    "clients.delete",
    "clients.export",
    "payments.view",
    "payments.create",
    "payments.refund",
    "billing.view",
    // pas billing.manage (owner only)
    "analytics.view",
    "ai.use",
  ],
  employee: [
    // pas business.edit (owner/admin)
    "team.view",
    // pas team.invite/remove/change_role
    "appointments.view",
    "appointments.create",
    // pas edit_any → edit_assigned uniquement
    "appointments.edit_assigned",
    "quotes.view",
    "quotes.create",
    "quotes.edit_assigned",
    "clients.view",
    "clients.create",
    "clients.edit",
    // pas clients.delete/export (RGPD sensitive)
    "payments.view",
    "payments.create",
    // pas payments.refund
    "analytics.view",
    "ai.use",
  ],
  viewer: [
    "team.view",
    "appointments.view",
    "quotes.view",
    "clients.view",
    "payments.view",
    "analytics.view",
    // Lecture seule totale : aucune capability d'écriture
  ],
};

// -----------------------------------------------------------------------------
// API programmatique
// -----------------------------------------------------------------------------

/**
 * Vérifie qu'un rôle possède une capability.
 * Utilisé par les gates UI + API.
 */
export function roleHas(role: TeamRole, capability: TeamCapability): boolean {
  return ROLE_PERMISSIONS[role].includes(capability);
}

/**
 * Vérifie si un rôle peut être assigné/modifié par un autre.
 * Règles :
 *  - owner peut tout faire
 *  - admin peut gérer employee/viewer mais pas admin/owner
 *  - employee/viewer ne peuvent rien gérer
 */
export function canManageRole(actor: TeamRole, target: TeamRole): boolean {
  if (actor === "owner") return target !== "owner";
  if (actor === "admin") return target === "employee" || target === "viewer";
  return false;
}

/**
 * Liste EXHAUSTIVE des capabilities d'un rôle (utile pour UI).
 */
export function listCapabilities(role: TeamRole): TeamCapability[] {
  return [...ROLE_PERMISSIONS[role]];
}

// Libellé humain pour l'UI (settings > équipe)
export const ROLE_LABELS: Record<TeamRole, { label: string; description: string }> = {
  owner: {
    label: "Propriétaire",
    description: "Vous. Accès total, seul à pouvoir supprimer le business ou gérer l'abonnement.",
  },
  admin: {
    label: "Administrateur",
    description:
      "Bras droit. Peut inviter/révoquer des membres, éditer tous les RDV/devis/clients. Ne peut pas changer d'abonnement.",
  },
  employee: {
    label: "Employé",
    description:
      "Opérationnel. Voit tout, crée RDV/devis/clients, édite ce qui lui est assigné. Pas d'export RGPD ni de remboursement.",
  },
  viewer: {
    label: "Lecture seule",
    description: "Comptable, stagiaire. Voit tout mais ne peut rien modifier.",
  },
};
