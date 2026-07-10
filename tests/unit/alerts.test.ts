import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { sendAlert, __resetAlertsThrottle } from "../../src/lib/alerts";

describe("alerts - webhook", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    __resetAlertsThrottle();
    delete process.env.ALERT_WEBHOOK_URL;
    delete process.env.ALERT_WEBHOOK_TYPE;
    delete process.env.ALERT_MIN_LEVEL;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    __resetAlertsThrottle();
  });

  it("retourne false si aucune URL de webhook n'est configurée", async () => {
    const ok = await sendAlert({ title: "test", level: "critical" });
    expect(ok).toBe(false);
  });

  it("retourne false si le niveau est en-dessous du seuil", async () => {
    process.env.ALERT_WEBHOOK_URL = "https://example.com/hook";
    process.env.ALERT_MIN_LEVEL = "critical";
    const ok = await sendAlert({ title: "test", level: "warning" });
    expect(ok).toBe(false);
  });

  it("envoie le webhook au format Slack par défaut", async () => {
    process.env.ALERT_WEBHOOK_URL = "https://slack.example/hook";
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const ok = await sendAlert({ title: "DB down", level: "critical", route: "GET /api/x" });
    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://slack.example/hook");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.text).toContain("DB down");
    expect(body.blocks).toBeDefined();
  });

  it("envoie le webhook au format Discord si type=discord", async () => {
    process.env.ALERT_WEBHOOK_URL = "https://discord.example/hook";
    process.env.ALERT_WEBHOOK_TYPE = "discord";
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await sendAlert({ title: "Boom", level: "error" });
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.embeds).toBeDefined();
    expect(body.embeds[0].title).toContain("Boom");
  });

  it("throttle : 2ème alerte identique dans 5min → pas d'envoi", async () => {
    process.env.ALERT_WEBHOOK_URL = "https://example.com/hook";
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const first = await sendAlert({ title: "same", level: "error", route: "r" });
    const second = await sendAlert({ title: "same", level: "error", route: "r" });
    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ne throw jamais si fetch échoue", async () => {
    process.env.ALERT_WEBHOOK_URL = "https://example.com/hook";
    global.fetch = vi.fn().mockRejectedValue(new Error("network")) as unknown as typeof fetch;
    await expect(
      sendAlert({ title: "x", level: "error" })
    ).resolves.toBeDefined();
  });
});
