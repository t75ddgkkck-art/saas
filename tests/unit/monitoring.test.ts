import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  captureException,
  captureMessage,
  isMonitoringEnabled,
  __resetMonitoringCache,
} from "../../src/lib/monitoring";

describe("monitoring - Sentry optionnel", () => {
  beforeEach(() => {
    __resetMonitoringCache();
    delete process.env.SENTRY_DSN;
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    delete process.env.ALERT_WEBHOOK_URL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    __resetMonitoringCache();
  });

  it("isMonitoringEnabled retourne false sans DSN", () => {
    expect(isMonitoringEnabled()).toBe(false);
  });

  it("captureException ne throw jamais, même avec un input null", () => {
    expect(() => captureException(null)).not.toThrow();
    expect(() => captureException(undefined)).not.toThrow();
    expect(() => captureException("string error")).not.toThrow();
    expect(() => captureException(new Error("test"))).not.toThrow();
  });

  it("captureException accepte du contexte structuré", () => {
    expect(() =>
      captureException(new Error("boom"), {
        route: "GET /api/test",
        userId: "user-123",
        severity: "error",
        extra: { foo: "bar" },
      })
    ).not.toThrow();
  });

  it("captureMessage ne throw jamais", () => {
    expect(() => captureMessage("hello")).not.toThrow();
    expect(() => captureMessage("warn", { level: "warning", route: "test" })).not.toThrow();
  });

  it("isMonitoringEnabled retourne false si le package @sentry/nextjs est absent (même avec DSN)", () => {
    // Avec DSN défini mais package non installé → doit rester false sans crash
    process.env.SENTRY_DSN = "https://fake@sentry.io/1";
    __resetMonitoringCache();
    // Le require dynamique va échouer proprement
    expect(isMonitoringEnabled()).toBe(false);
  });
});
