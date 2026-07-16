/**
 * F1 (Lot 29) — Tests entitlements.
 *
 * Deux objectifs :
 *  1. Snapshot de la matrice : figer les plans autorisés par feature.
 *     Si un dev change accidentellement `loyalty.enable → pro`, le test casse.
 *  2. Tests unitaires des helpers `canUse`, `canUseAny`, `canUseAll`,
 *     `getRequiredPlan`, `listEntitlements`, `checkQuota`.
 */

import { describe, expect, it } from "vitest";
import {
  canUse,
  canUseAny,
  canUseAll,
  getRequiredPlan,
  listEntitlements,
  listMissingEntitlements,
  buildEntitlementsSnapshot,
  checkQuota,
  getLimit,
  FEATURES,
  type FeatureKey,
} from "@/lib/entitlements";

// ---------------------------------------------------------------------------
// Snapshot matrice — la source de vérité EXPLICITE.
// Si une ligne change, le test casse : on doit consciemment update ce snapshot.
// ---------------------------------------------------------------------------
describe("FEATURES matrix — snapshot", () => {
  it("liste EXACTEMENT les features attendues (aucun ajout accidentel)", () => {
    const keys = Object.keys(FEATURES).sort();
    expect(keys).toEqual([
      "ai.auto_review_reply",
      "ai.blog",
      "ai.chat",
      "ai.monthly_report",
      "ai.social_post",
      "analytics.advanced",
      "business.multi",
      "crm.reactivation_ai",
      "invoices.auto_generation",
      "loyalty.enable",
      "payments.apple_pay",
      "payments.stripe",
      "pdf.multi_template",
      "quotes.ai_generation",
      "quotes.enable",
      "reminders.email",
      "reminders.sms",
      "reminders.whatsapp",
      "reviews.auto_request",
      "team.enable",
      "vitrine.custom_domain",
      "vitrine.custom_template",
      "vitrine.hide_branding",
    ]);
  });

  // Matrice figée : pour chaque feature, la liste des plans autorisés.
  // Modif consciente d'une ligne = update ici + update dans entitlements.ts.
  const EXPECTED_ACCESS: Record<FeatureKey, ("free" | "pro" | "premium")[]> = {
    "ai.chat": ["premium"],
    "ai.blog": ["pro", "premium"],
    "ai.social_post": ["premium"],
    "ai.monthly_report": ["premium"],
    "ai.auto_review_reply": ["premium"],
    "vitrine.custom_template": ["pro", "premium"],
    "vitrine.hide_branding": ["premium"],
    "vitrine.custom_domain": ["premium"],
    "loyalty.enable": ["premium"],
    "payments.stripe": ["pro", "premium"],
    "payments.apple_pay": ["pro", "premium"],
    "quotes.enable": ["pro", "premium"],
    "quotes.ai_generation": ["premium"],
    "invoices.auto_generation": ["pro", "premium"],
    "business.multi": ["premium"],
    "crm.reactivation_ai": ["premium"],
    "reminders.email": ["pro", "premium"],
    "reminders.sms": ["premium"],
    "reminders.whatsapp": ["premium"],
    "reviews.auto_request": ["pro", "premium"],
    "team.enable": ["pro", "premium"],
    "analytics.advanced": ["pro", "premium"],
    "pdf.multi_template": ["pro", "premium"],
  };

  for (const [feature, expectedPlans] of Object.entries(EXPECTED_ACCESS)) {
    it(`${feature} : accès = [${expectedPlans.join(", ")}]`, () => {
      expect([...FEATURES[feature as FeatureKey].plans].sort()).toEqual([...expectedPlans].sort());
    });
  }

  it("aucune feature n'est ouverte à Free (règle métier stricte)", () => {
    // Toutes les features sont des upsells — rien de premium n'est offert Free.
    // Si un jour on veut donner un teaser Free, changer intentionnellement ce test.
    for (const key of Object.keys(FEATURES) as FeatureKey[]) {
      expect(FEATURES[key].plans).not.toContain("free");
    }
  });

  it("chaque feature a un label et une description non vides", () => {
    for (const key of Object.keys(FEATURES) as FeatureKey[]) {
      expect(FEATURES[key].label.length).toBeGreaterThan(0);
      expect(FEATURES[key].description.length).toBeGreaterThan(0);
    }
  });

  it("minPlan est cohérent avec plans (le plus bas doit être minPlan)", () => {
    // Sanity : si `plans: ["pro","premium"]` alors `minPlan` DOIT être "pro"
    // (sinon le CTA "Passez Premium" pour une feature Pro serait faux).
    for (const key of Object.keys(FEATURES) as FeatureKey[]) {
      const f = FEATURES[key];
      const hasProAccess = f.plans.includes("pro");
      if (hasProAccess) {
        expect(f.minPlan).toBe("pro");
      } else {
        expect(f.minPlan).toBe("premium");
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Helpers unitaires
// ---------------------------------------------------------------------------
describe("canUse()", () => {
  it("Free n'a rien", () => {
    expect(canUse("free", "loyalty.enable")).toBe(false);
    expect(canUse("free", "ai.chat")).toBe(false);
    expect(canUse("free", "quotes.enable")).toBe(false);
  });

  it("Pro a Pro+, pas Premium-only", () => {
    expect(canUse("pro", "quotes.enable")).toBe(true);
    expect(canUse("pro", "ai.blog")).toBe(true);
    expect(canUse("pro", "loyalty.enable")).toBe(false);
    expect(canUse("pro", "ai.chat")).toBe(false);
  });

  it("Premium a tout", () => {
    for (const key of Object.keys(FEATURES) as FeatureKey[]) {
      expect(canUse("premium", key)).toBe(true);
    }
  });
});

describe("canUseAny / canUseAll", () => {
  it("canUseAny renvoie true si au moins une feature accessible", () => {
    expect(canUseAny("pro", ["ai.chat", "quotes.enable"])).toBe(true); // quotes OK
    expect(canUseAny("free", ["ai.chat", "loyalty.enable"])).toBe(false);
  });

  it("canUseAll exige toutes", () => {
    expect(canUseAll("premium", ["ai.chat", "loyalty.enable"])).toBe(true);
    expect(canUseAll("pro", ["ai.chat", "quotes.enable"])).toBe(false);
  });
});

describe("getRequiredPlan()", () => {
  it("renvoie pro pour une feature Pro+", () => {
    expect(getRequiredPlan("quotes.enable")).toBe("pro");
  });
  it("renvoie premium pour une feature Premium-only", () => {
    expect(getRequiredPlan("ai.chat")).toBe("premium");
    expect(getRequiredPlan("loyalty.enable")).toBe("premium");
  });
});

describe("listEntitlements / listMissingEntitlements", () => {
  it("Free : 0 accès, TOUT en missing", () => {
    expect(listEntitlements("free")).toEqual([]);
    expect(listMissingEntitlements("free")).toHaveLength(Object.keys(FEATURES).length);
  });

  it("Premium : tout accessible, 0 missing", () => {
    expect(listEntitlements("premium")).toHaveLength(Object.keys(FEATURES).length);
    expect(listMissingEntitlements("premium")).toEqual([]);
  });

  it("Pro : partition cohérente", () => {
    const has = listEntitlements("pro");
    const missing = listMissingEntitlements("pro");
    expect(has.length + missing.length).toBe(Object.keys(FEATURES).length);
    expect(has).toContain("quotes.enable");
    expect(missing).toContain("ai.chat");
  });
});

describe("buildEntitlementsSnapshot()", () => {
  it("renvoie plan + tous les flags features", () => {
    const snap = buildEntitlementsSnapshot("pro");
    expect(snap.plan).toBe("pro");
    expect(Object.keys(snap.features).sort()).toEqual(Object.keys(FEATURES).sort());
    expect(snap.features["quotes.enable"]).toBe(true);
    expect(snap.features["ai.chat"]).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Quotas numériques (pont vers permissions.ts)
// ---------------------------------------------------------------------------
describe("getLimit() / checkQuota()", () => {
  it("Free a maxClients = 50", () => {
    expect(getLimit("free", "maxClients")).toBe(50);
  });
  it("Premium a maxClients illimité (-1)", () => {
    expect(getLimit("premium", "maxClients")).toBe(-1);
  });

  it("checkQuota Free < limite : allowed", () => {
    const r = checkQuota("free", "maxClients", 10);
    expect(r.allowed).toBe(true);
    expect(r.limit).toBe(50);
    expect(r.remaining).toBe(40);
  });

  it("checkQuota Free à la limite : refusé", () => {
    const r = checkQuota("free", "maxClients", 50);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it("checkQuota illimité : toujours allowed, remaining = Infinity", () => {
    const r = checkQuota("premium", "maxClients", 999999);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(Number.POSITIVE_INFINITY);
  });
});
