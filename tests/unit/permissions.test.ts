import { describe, it, expect } from "vitest";
import { PLAN_PERMISSIONS, checkPermission, getPlanLimits } from "@/lib/permissions";

describe("permissions par plan", () => {
  it("free n'a pas accès à l'IA ni aux devis", () => {
    expect(checkPermission("free", "canEnableAi")).toBe(false);
    expect(checkPermission("free", "canEnableQuotes")).toBe(false);
    expect(checkPermission("free", "canEnableStripe")).toBe(false);
  });

  it("pro a droit aux devis, Stripe, rappels email, mais pas au SMS ni IA chat", () => {
    expect(checkPermission("pro", "canEnableQuotes")).toBe(true);
    expect(checkPermission("pro", "canEnableStripe")).toBe(true);
    expect(checkPermission("pro", "canEnableReminders")).toBe(true);
    expect(checkPermission("pro", "canSmsReminders")).toBe(false);
    expect(checkPermission("pro", "canAiChatbot")).toBe(false);
  });

  it("premium a accès à tout", () => {
    expect(checkPermission("premium", "canEnableAi")).toBe(true);
    expect(checkPermission("premium", "canAiChatbot")).toBe(true);
    expect(checkPermission("premium", "canSmsReminders")).toBe(true);
    expect(checkPermission("premium", "canEnableLoyalty")).toBe(true);
    expect(checkPermission("premium", "canCustomDomain")).toBe(true);
  });

  it("les limites -1 signifient illimité pour premium", () => {
    expect(getPlanLimits("premium", "maxServices")).toBe(-1);
    expect(getPlanLimits("premium", "maxClients")).toBe(-1);
    expect(getPlanLimits("premium", "maxBlogPosts")).toBe(-1);
  });

  it("les limites free sont strictes", () => {
    expect(getPlanLimits("free", "maxClients")).toBe(50);
    expect(getPlanLimits("free", "maxServices")).toBe(10);
    expect(getPlanLimits("free", "maxBlogPosts")).toBe(3);
  });

  it("tous les plans exposent toutes les clés (cohérence de forme)", () => {
    const freeKeys = Object.keys(PLAN_PERMISSIONS.free).sort();
    const proKeys = Object.keys(PLAN_PERMISSIONS.pro).sort();
    const premKeys = Object.keys(PLAN_PERMISSIONS.premium).sort();
    expect(proKeys).toEqual(freeKeys);
    expect(premKeys).toEqual(freeKeys);
  });
});
