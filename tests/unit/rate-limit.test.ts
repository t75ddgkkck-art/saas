import { describe, it, expect } from "vitest";
import { checkRateLimit } from "@/lib/rate-limit";

function fakeReq(ip: string) {
  return {
    headers: new Map<string, string>([["x-forwarded-for", ip]]) as unknown as Headers,
  } as unknown as import("next/server").NextRequest;
}

// Wrapper compatible avec l'implémentation qui utilise .get()
function req(ip: string) {
  return {
    headers: {
      get: (k: string) => (k === "x-forwarded-for" ? ip : null),
    },
  } as unknown as import("next/server").NextRequest;
}

describe("rate limiter", () => {
  it("laisse passer sous la limite", () => {
    const r = req("10.0.0.1");
    for (let i = 0; i < 3; i++) {
      const res = checkRateLimit(r, { key: "unit-a", limit: 3, windowSec: 60 });
      expect(res.ok).toBe(true);
    }
  });

  it("bloque au-delà de la limite avec 429 + Retry-After", () => {
    const r = req("10.0.0.2");
    const opts = { key: "unit-b", limit: 2, windowSec: 60 };
    expect(checkRateLimit(r, opts).ok).toBe(true);
    expect(checkRateLimit(r, opts).ok).toBe(true);
    const blocked = checkRateLimit(r, opts);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.response.status).toBe(429);
      expect(blocked.response.headers.get("Retry-After")).toBeTruthy();
    }
  });

  it("isole les IPs et les clés", () => {
    const opts = { key: "unit-c", limit: 1, windowSec: 60 };
    expect(checkRateLimit(req("10.0.0.3"), opts).ok).toBe(true);
    // Autre IP → autorisé
    expect(checkRateLimit(req("10.0.0.4"), opts).ok).toBe(true);
    // Autre key → autorisé
    expect(checkRateLimit(req("10.0.0.3"), { ...opts, key: "unit-c2" }).ok).toBe(true);
    // Même IP + même key → bloqué
    expect(checkRateLimit(req("10.0.0.3"), opts).ok).toBe(false);
  });
});
