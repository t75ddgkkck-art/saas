import { describe, it, expect } from "vitest";
import { AI_TOKEN_LIMITS, estimateCostUsd } from "@/lib/ai/usage";

describe("ai/usage — quotas & cost", () => {
  it("plan free = 0 tokens (pas d'IA)", () => {
    expect(AI_TOKEN_LIMITS.free).toBe(0);
  });

  it("plan pro > 0 et < premium", () => {
    expect(AI_TOKEN_LIMITS.pro).toBeGreaterThan(0);
    expect(AI_TOKEN_LIMITS.pro).toBeLessThan(AI_TOKEN_LIMITS.premium);
  });

  it("estimation coût gpt-4o-mini réaliste", () => {
    // 1M input + 1M output = 0.15 + 0.60 = 0.75 $
    const c = estimateCostUsd(1_000_000, 1_000_000);
    expect(c).toBeCloseTo(0.75, 3);
  });

  it("100k input + 50k output ≈ 0.045 $", () => {
    const c = estimateCostUsd(100_000, 50_000);
    // 100k input = 0.015, 50k output = 0.03 → 0.045
    expect(c).toBeCloseTo(0.045, 4);
  });

  it("0 tokens = 0 $", () => {
    expect(estimateCostUsd(0, 0)).toBe(0);
  });
});
