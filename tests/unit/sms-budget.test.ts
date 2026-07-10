import { describe, it, expect, beforeEach } from "vitest";
import { checkAndRecordSmsSend, getSmsUsage } from "@/lib/sms-budget";

describe("sms-budget", () => {
  // Chaque test utilise un businessId unique pour éviter les collisions
  // entre les compteurs en mémoire.
  let bizId: string;
  beforeEach(() => {
    bizId = `test-${Math.random().toString(36).slice(2, 10)}`;
  });

  it("autorise le premier envoi et incrémente", () => {
    const r1 = checkAndRecordSmsSend(bizId, "sms", 5);
    expect(r1.allowed).toBe(true);
    expect(r1.used).toBe(1);
    expect(r1.limit).toBe(5);
    expect(r1.estimatedCostEur).toBeGreaterThan(0);
  });

  it("respecte la limite quotidienne", () => {
    // 3 envois autorisés
    checkAndRecordSmsSend(bizId, "sms", 3);
    checkAndRecordSmsSend(bizId, "sms", 3);
    checkAndRecordSmsSend(bizId, "sms", 3);
    // Le 4e est refusé
    const blocked = checkAndRecordSmsSend(bizId, "sms", 3);
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toContain("Limite quotidienne");
  });

  it("isole SMS et WhatsApp", () => {
    checkAndRecordSmsSend(bizId, "sms", 1);
    // La limite SMS est atteinte, mais WhatsApp reste ouvert
    const wa = checkAndRecordSmsSend(bizId, "whatsapp", 1);
    expect(wa.allowed).toBe(true);
  });

  it("isole les business entre eux", () => {
    const bizA = `test-a-${Math.random()}`;
    const bizB = `test-b-${Math.random()}`;
    checkAndRecordSmsSend(bizA, "sms", 1);
    // Ce n'est pas le compteur de bizA qui bloque bizB
    const rB = checkAndRecordSmsSend(bizB, "sms", 1);
    expect(rB.allowed).toBe(true);
  });

  it("getSmsUsage ne modifie pas le compteur", () => {
    checkAndRecordSmsSend(bizId, "sms", 100);
    const u1 = getSmsUsage(bizId, "sms");
    const u2 = getSmsUsage(bizId, "sms");
    expect(u1.used).toBe(u2.used);
  });

  it("le coût estimé est en euros et cohérent", () => {
    const r = checkAndRecordSmsSend(bizId, "sms", 100);
    // 1 SMS ≈ 0.075 €
    expect(r.estimatedCostEur).toBeCloseTo(0.075, 3);
  });
});
