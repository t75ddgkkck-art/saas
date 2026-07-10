import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import {
  signWebhookBody,
  generateWebhookSecret,
  ALL_WEBHOOK_EVENTS,
} from "../../src/lib/webhooks-out";

describe("webhooks-out (Lot 16.4)", () => {
  it("signWebhookBody produit un format t=<ts>,v1=<hex>", () => {
    const sig = signWebhookBody(`{"a":1}`, "secret", 1700000000);
    expect(sig).toBe(`t=1700000000,v1=${createHmac("sha256", "secret").update("1700000000.{\"a\":1}").digest("hex")}`);
  });

  it("signWebhookBody utilise le timestamp actuel par défaut", () => {
    const before = Math.floor(Date.now() / 1000);
    const sig = signWebhookBody(`{}`, "s");
    const after = Math.floor(Date.now() / 1000);
    const match = sig.match(/^t=(\d+),v1=/);
    expect(match).not.toBeNull();
    const ts = Number(match![1]);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it("signature reproductible côté receveur", () => {
    const body = `{"event":"appointment.created"}`;
    const secret = "test-secret-abcd";
    const ts = 1700000000;
    const sig = signWebhookBody(body, secret, ts);
    // Simule un receveur qui refait le calcul
    const expected = createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
    expect(sig).toBe(`t=${ts},v1=${expected}`);
  });

  it("generateWebhookSecret produit 64 chars hex", () => {
    const s = generateWebhookSecret();
    expect(s).toMatch(/^[0-9a-f]{64}$/);
  });

  it("ALL_WEBHOOK_EVENTS contient les 7 events attendus", () => {
    expect(ALL_WEBHOOK_EVENTS).toContain("appointment.created");
    expect(ALL_WEBHOOK_EVENTS).toContain("appointment.updated");
    expect(ALL_WEBHOOK_EVENTS).toContain("appointment.cancelled");
    expect(ALL_WEBHOOK_EVENTS).toContain("payment.received");
    expect(ALL_WEBHOOK_EVENTS).toContain("quote.sent");
    expect(ALL_WEBHOOK_EVENTS).toContain("quote.signed");
    expect(ALL_WEBHOOK_EVENTS).toContain("review.received");
    expect(ALL_WEBHOOK_EVENTS).toHaveLength(7);
  });
});
