/**
 * Lot 36 — Tests visitor-hash (RGPD-friendly).
 */

import { describe, expect, it, beforeAll } from "vitest";

beforeAll(() => {
  process.env.NEXTAUTH_SECRET = "testsecrettestsecrettestsecret1234";
});

import { computeVisitorHash, detectDevice, detectSource } from "@/lib/visitor-hash";

describe("computeVisitorHash", () => {
  const date = new Date("2026-08-15T10:00:00Z");

  it("hash de 32 chars hex", () => {
    const h = computeVisitorHash("1.2.3.4", "Mozilla/5.0", date);
    expect(h).toMatch(/^[0-9a-f]{32}$/);
  });

  it("déterministe (mêmes inputs même jour = même hash)", () => {
    const h1 = computeVisitorHash("1.2.3.4", "Mozilla/5.0", date);
    const h2 = computeVisitorHash("1.2.3.4", "Mozilla/5.0", date);
    expect(h1).toBe(h2);
  });

  it("change entre 2 jours différents (cross-day tracking bloqué)", () => {
    const d1 = new Date("2026-08-15T23:00:00Z");
    const d2 = new Date("2026-08-16T01:00:00Z");
    expect(computeVisitorHash("1.2.3.4", "M", d1)).not.toBe(computeVisitorHash("1.2.3.4", "M", d2));
  });

  it("change entre 2 IPs", () => {
    expect(computeVisitorHash("1.1.1.1", "M", date)).not.toBe(
      computeVisitorHash("2.2.2.2", "M", date)
    );
  });

  it("change entre 2 user-agents", () => {
    expect(computeVisitorHash("1.1.1.1", "Chrome", date)).not.toBe(
      computeVisitorHash("1.1.1.1", "Firefox", date)
    );
  });

  it("null values acceptés", () => {
    const h = computeVisitorHash(null, null, date);
    expect(h).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("detectDevice", () => {
  it("desktop par défaut", () => {
    expect(detectDevice(null)).toBe("desktop");
    expect(detectDevice("Mozilla/5.0 (Windows NT 10.0)")).toBe("desktop");
    expect(detectDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X)")).toBe("desktop");
  });

  it("mobile détecté", () => {
    expect(detectDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 15_0)")).toBe("mobile");
    expect(detectDevice("Mozilla/5.0 (Linux; Android 12)")).toBe("mobile");
  });

  it("tablet détecté", () => {
    expect(detectDevice("Mozilla/5.0 (iPad; CPU OS 15_0)")).toBe("tablet");
    expect(detectDevice("Mozilla/5.0 (Linux; Android 12; Tablet)")).toBe("tablet");
  });
});

describe("detectSource", () => {
  it("direct si pas de referer ni src", () => {
    expect(detectSource(null, null)).toBe("direct");
    expect(detectSource("", null)).toBe("direct");
  });

  it("src query prioritaire", () => {
    expect(detectSource("https://google.com", "qr")).toBe("qr");
    expect(detectSource(null, "email")).toBe("email");
  });

  it("sanitize src (alphanum + tirets uniquement)", () => {
    expect(detectSource(null, "qr-code")).toBe("qr-code");
    // Chars illégaux → strippés
    expect(detectSource(null, "email!@#$%")).toBe("email");
    // Vide après sanitize → direct
    expect(detectSource(null, "!@#$")).toBe("direct");
  });

  it("détecte les moteurs de recherche", () => {
    expect(detectSource("https://www.google.fr/search", null)).toBe("google");
    expect(detectSource("https://www.bing.com", null)).toBe("bing");
    expect(detectSource("https://duckduckgo.com", null)).toBe("duckduckgo");
  });

  it("détecte les réseaux sociaux", () => {
    expect(detectSource("https://www.facebook.com/", null)).toBe("facebook");
    expect(detectSource("https://www.instagram.com/profile", null)).toBe("instagram");
    expect(detectSource("https://www.linkedin.com/in/xxx", null)).toBe("linkedin");
    expect(detectSource("https://twitter.com/xxx", null)).toBe("twitter");
    expect(detectSource("https://x.com/xxx", null)).toBe("twitter");
    expect(detectSource("https://wa.me/33612345678", null)).toBe("whatsapp");
    expect(detectSource("https://youtu.be/xyz", null)).toBe("youtube");
    expect(detectSource("https://www.tiktok.com/@x", null)).toBe("tiktok");
  });

  it("autre domain : renvoie le host sans www", () => {
    expect(detectSource("https://www.example.com/page", null)).toBe("example.com");
    expect(detectSource("https://blog.medium.com/article", null)).toBe("blog.medium.com");
  });

  it("URL malformée → direct (safe fallback)", () => {
    expect(detectSource("not-a-url", null)).toBe("direct");
  });
});
