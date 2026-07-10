/**
 * Tests du helper captcha Turnstile (Lot 19).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { verifyCaptcha, isCaptchaEnabled } from "../../src/lib/captcha";

describe("captcha - Turnstile (Lot 19)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    delete process.env.TURNSTILE_SECRET_KEY;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("isCaptchaEnabled false si TURNSTILE_SECRET_KEY absent", () => {
    expect(isCaptchaEnabled()).toBe(false);
  });

  it("isCaptchaEnabled true si secret défini", () => {
    process.env.TURNSTILE_SECRET_KEY = "0xTEST";
    expect(isCaptchaEnabled()).toBe(true);
  });

  it("verifyCaptcha ok si secret non défini (mode dev safe)", async () => {
    const r = await verifyCaptcha("dummy");
    expect(r.ok).toBe(true);
    expect(r.reason).toBe("no_secret");
  });

  it("verifyCaptcha rejette si token absent avec secret défini", async () => {
    process.env.TURNSTILE_SECRET_KEY = "0xTEST";
    const r = await verifyCaptcha(null);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("no_token");
  });

  it("verifyCaptcha appelle Cloudflare et propage le success", async () => {
    process.env.TURNSTILE_SECRET_KEY = "0xTEST";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, hostname: "example.com" }), {
        status: 200,
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const r = await verifyCaptcha("valid-token", { ip: "1.2.3.4" });
    expect(r.ok).toBe(true);
    expect(r.hostname).toBe("example.com");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Vérifie que remoteip est bien passé
    const [, init] = fetchMock.mock.calls[0];
    const body = (init as RequestInit).body as URLSearchParams;
    expect(body.get("remoteip")).toBe("1.2.3.4");
  });

  it("verifyCaptcha rejette si Cloudflare renvoie success=false", async () => {
    process.env.TURNSTILE_SECRET_KEY = "0xTEST";
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ success: false, "error-codes": ["invalid-input-response"] }),
        { status: 200 }
      )
    ) as unknown as typeof fetch;

    const r = await verifyCaptcha("bad-token");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("invalid");
  });

  it("verifyCaptcha ne throw jamais sur erreur réseau", async () => {
    process.env.TURNSTILE_SECRET_KEY = "0xTEST";
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    const r = await verifyCaptcha("any");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("network_error");
  });

  it("verifyCaptcha gère les non-2xx", async () => {
    process.env.TURNSTILE_SECRET_KEY = "0xTEST";
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response("boom", { status: 503 })) as unknown as typeof fetch;
    const r = await verifyCaptcha("any");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("network_error");
  });
});
