/**
 * Tests du helper de consentement cookies (Lot 15.2).
 * On simule un localStorage minimal (Node/JSDOM non requis).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  readConsent,
  writeConsent,
  resetConsent,
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
} from "../../src/lib/consent";

function mockLocalStorage() {
  const store: Record<string, string> = {};
  const ls = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
  vi.stubGlobal("window", { localStorage: ls });
  return ls;
}

describe("consent (Lot 15.2)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    mockLocalStorage();
  });

  it("readConsent retourne null si rien n'est stocké", () => {
    expect(readConsent()).toBeNull();
  });

  it("writeConsent puis readConsent retourne la valeur", () => {
    writeConsent("essential");
    expect(readConsent()).toBe("essential");
  });

  it("supporte les 2 valeurs valides", () => {
    writeConsent("all");
    expect(readConsent()).toBe("all");
    writeConsent("essential");
    expect(readConsent()).toBe("essential");
  });

  it("retourne null si la version stockée est obsolète (invalidation)", () => {
    const ls = mockLocalStorage();
    ls.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ v: CONSENT_VERSION + 99, value: "all", at: Date.now() })
    );
    expect(readConsent()).toBeNull();
  });

  it("retourne null si la valeur est corrompue", () => {
    const ls = mockLocalStorage();
    ls.setItem(CONSENT_STORAGE_KEY, "{{{not-json");
    expect(readConsent()).toBeNull();
    ls.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ v: CONSENT_VERSION, value: "hack" }));
    expect(readConsent()).toBeNull();
  });

  it("resetConsent efface la valeur", () => {
    writeConsent("all");
    resetConsent();
    expect(readConsent()).toBeNull();
  });

  it("retourne null si window est absent (SSR)", () => {
    vi.unstubAllGlobals();
    // Pas de window → helper doit être safe
    expect(readConsent()).toBeNull();
    expect(() => writeConsent("all")).not.toThrow();
    expect(() => resetConsent()).not.toThrow();
  });
});
