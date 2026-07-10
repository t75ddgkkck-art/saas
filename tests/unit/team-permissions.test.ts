/**
 * F5 (Lot 32) — Tests matrice permissions rôle × capability.
 *
 * Snapshot : fige les capabilities de chaque rôle. Si un dev change par erreur
 * (ex : donne `payments.refund` à `employee`), le test casse.
 */

import { describe, expect, it } from "vitest";
import {
  ROLE_PERMISSIONS,
  roleHas,
  canManageRole,
  listCapabilities,
  ROLE_LABELS,
  type TeamRole,
  type TeamCapability,
} from "@/lib/team-permissions";

describe("ROLE_PERMISSIONS snapshot", () => {
  it("les 4 rôles existent exactement", () => {
    expect(Object.keys(ROLE_PERMISSIONS).sort()).toEqual(["admin", "employee", "owner", "viewer"]);
  });

  it("owner a TOUTES les capabilities (accès total)", () => {
    // Owner doit avoir toutes les caps existantes — sinon un dev a ajouté une
    // cap sans la donner au owner (bug).
    const allCaps = new Set<TeamCapability>();
    for (const caps of Object.values(ROLE_PERMISSIONS)) {
      for (const c of caps) allCaps.add(c);
    }
    for (const cap of allCaps) {
      expect(ROLE_PERMISSIONS.owner).toContain(cap);
    }
  });

  it("admin a business.edit mais PAS business.delete", () => {
    expect(ROLE_PERMISSIONS.admin).toContain("business.edit");
    expect(ROLE_PERMISSIONS.admin).not.toContain("business.delete");
  });

  it("admin a billing.view mais PAS billing.manage", () => {
    expect(ROLE_PERMISSIONS.admin).toContain("billing.view");
    expect(ROLE_PERMISSIONS.admin).not.toContain("billing.manage");
  });

  it("employee : peut créer mais pas edit_any (uniquement assigned)", () => {
    expect(ROLE_PERMISSIONS.employee).toContain("appointments.create");
    expect(ROLE_PERMISSIONS.employee).toContain("appointments.edit_assigned");
    expect(ROLE_PERMISSIONS.employee).not.toContain("appointments.edit_any");
    expect(ROLE_PERMISSIONS.employee).not.toContain("appointments.delete");
  });

  it("employee : PAS de payments.refund, PAS de clients.delete, PAS de clients.export", () => {
    expect(ROLE_PERMISSIONS.employee).not.toContain("payments.refund");
    expect(ROLE_PERMISSIONS.employee).not.toContain("clients.delete");
    expect(ROLE_PERMISSIONS.employee).not.toContain("clients.export");
  });

  it("viewer : uniquement des .view (lecture seule stricte)", () => {
    const nonViewCaps = ROLE_PERMISSIONS.viewer.filter((c) => !c.endsWith(".view"));
    expect(nonViewCaps).toEqual([]);
  });

  it("viewer : n'a pas team.invite ni team.remove", () => {
    expect(ROLE_PERMISSIONS.viewer).not.toContain("team.invite");
    expect(ROLE_PERMISSIONS.viewer).not.toContain("team.remove");
    expect(ROLE_PERMISSIONS.viewer).not.toContain("team.change_role");
  });

  it("chaque rôle a une entrée dans ROLE_LABELS", () => {
    for (const role of Object.keys(ROLE_PERMISSIONS) as TeamRole[]) {
      expect(ROLE_LABELS[role]).toBeDefined();
      expect(ROLE_LABELS[role].label.length).toBeGreaterThan(0);
      expect(ROLE_LABELS[role].description.length).toBeGreaterThan(0);
    }
  });
});

describe("roleHas()", () => {
  it("true si la cap est dans la liste du rôle", () => {
    expect(roleHas("owner", "business.delete")).toBe(true);
    expect(roleHas("admin", "team.invite")).toBe(true);
    expect(roleHas("employee", "appointments.create")).toBe(true);
    expect(roleHas("viewer", "clients.view")).toBe(true);
  });

  it("false si la cap n'est pas dans la liste du rôle", () => {
    expect(roleHas("admin", "business.delete")).toBe(false);
    expect(roleHas("employee", "payments.refund")).toBe(false);
    expect(roleHas("viewer", "appointments.create")).toBe(false);
  });
});

describe("canManageRole()", () => {
  it("owner peut gérer tout sauf owner", () => {
    expect(canManageRole("owner", "admin")).toBe(true);
    expect(canManageRole("owner", "employee")).toBe(true);
    expect(canManageRole("owner", "viewer")).toBe(true);
    expect(canManageRole("owner", "owner")).toBe(false); // pas transfert de propriété via ce mécanisme
  });

  it("admin peut gérer employee et viewer, PAS admin ni owner", () => {
    expect(canManageRole("admin", "employee")).toBe(true);
    expect(canManageRole("admin", "viewer")).toBe(true);
    expect(canManageRole("admin", "admin")).toBe(false);
    expect(canManageRole("admin", "owner")).toBe(false);
  });

  it("employee et viewer ne peuvent rien gérer", () => {
    for (const target of ["owner", "admin", "employee", "viewer"] as TeamRole[]) {
      expect(canManageRole("employee", target)).toBe(false);
      expect(canManageRole("viewer", target)).toBe(false);
    }
  });
});

describe("listCapabilities()", () => {
  it("renvoie une copie (pas de mutation possible)", () => {
    const caps = listCapabilities("admin");
    caps.push("business.delete"); // mutation locale
    // La matrice originale ne doit pas contenir business.delete pour admin
    expect(ROLE_PERMISSIONS.admin).not.toContain("business.delete");
  });
});
