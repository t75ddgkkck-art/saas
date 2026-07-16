/**
 * Lot 52 (F14) — Tests helpers partage parrainage.
 *
 * Pure fonctions, aucun mock nécessaire.
 */

import { describe, expect, it } from "vitest";
import {
  buildShareUrl,
  buildShareTemplates,
  buildEmailShareLink,
  buildWhatsappShareLink,
  buildSmsShareLink,
} from "@/lib/referral-share";

// ---------------------------------------------------------------------------
// buildShareUrl
// ---------------------------------------------------------------------------

describe("buildShareUrl", () => {
  it("format standard baseUrl + code", () => {
    expect(buildShareUrl("https://vitrix.fr", "VX-A3F7K2")).toBe(
      "https://vitrix.fr/register?ref=VX-A3F7K2"
    );
  });

  it("supprime le trailing slash du baseUrl", () => {
    expect(buildShareUrl("https://vitrix.fr/", "VX-A3F7K2")).toBe(
      "https://vitrix.fr/register?ref=VX-A3F7K2"
    );
    expect(buildShareUrl("https://vitrix.fr///", "VX-A3F7K2")).toBe(
      "https://vitrix.fr/register?ref=VX-A3F7K2"
    );
  });

  it("URL-encode le code (défense — même si notre format VX-XXXXXX est safe)", () => {
    const url = buildShareUrl("https://vitrix.fr", "VX-A3&F7#K2");
    expect(url).toContain("VX-A3%26F7%23K2");
  });

  it("fonctionne aussi avec des baseUrl locaux (dev)", () => {
    expect(buildShareUrl("http://localhost:3000", "VX-TEST00")).toBe(
      "http://localhost:3000/register?ref=VX-TEST00"
    );
  });
});

// ---------------------------------------------------------------------------
// buildShareTemplates
// ---------------------------------------------------------------------------

describe("buildShareTemplates", () => {
  const url = "https://vitrix.fr/register?ref=VX-TEST00";

  it("contient l'URL dans les 3 templates", () => {
    const t = buildShareTemplates(url);
    expect(t.emailBody).toContain(url);
    expect(t.shortMessage).toContain(url);
  });

  it("emailSubject court (< 60 chars pour éviter la coupure Gmail)", () => {
    const t = buildShareTemplates(url);
    expect(t.emailSubject.length).toBeLessThan(60);
  });

  it("shortMessage tient dans un SMS (< 160 chars)", () => {
    const t = buildShareTemplates(url);
    expect(t.shortMessage.length).toBeLessThan(160);
  });

  it("ajoute la signature avec firstName si fourni", () => {
    const t = buildShareTemplates(url, "Marc");
    expect(t.emailBody).toContain("\n\nMarc");
  });

  it("pas de signature si firstName absent ou vide", () => {
    const t = buildShareTemplates(url);
    // Pas de double saut de ligne final avec nom
    expect(t.emailBody).not.toContain("\n\nundefined");
    expect(t.emailBody).not.toMatch(/\n\n\s*$/);
  });

  it("firstName null/undefined → pas de signature", () => {
    const t1 = buildShareTemplates(url, null);
    const t2 = buildShareTemplates(url, undefined);
    // Aucun des deux ne doit contenir "null" ou "undefined" literal
    expect(t1.emailBody).not.toContain("null");
    expect(t2.emailBody).not.toContain("undefined");
  });
});

// ---------------------------------------------------------------------------
// Deep links
// ---------------------------------------------------------------------------

describe("buildEmailShareLink", () => {
  it("format mailto: avec subject + body URL-encodés", () => {
    const t = buildShareTemplates("https://vitrix.fr/register?ref=VX-TEST");
    const link = buildEmailShareLink(t);
    expect(link).toMatch(/^mailto:\?subject=.+&body=.+$/);
    // Le "?" du ref doit être encodé en %3F
    expect(link).toContain("%3F");
  });

  it("accepte un destinataire optionnel", () => {
    const t = buildShareTemplates("https://vitrix.fr/register?ref=VX-TEST");
    const link = buildEmailShareLink(t, "ami@example.com");
    expect(link).toContain("mailto:ami@example.com?");
  });
});

describe("buildWhatsappShareLink", () => {
  it("format wa.me/?text= avec message encodé", () => {
    const t = buildShareTemplates("https://vitrix.fr/register?ref=VX-TEST");
    const link = buildWhatsappShareLink(t);
    expect(link).toMatch(/^https:\/\/wa\.me\/\?text=/);
    // Pas d'espaces (URL-encoded)
    expect(link).not.toContain(" ");
  });
});

describe("buildSmsShareLink", () => {
  it("format sms: universel iOS/Android", () => {
    const t = buildShareTemplates("https://vitrix.fr/register?ref=VX-TEST");
    const link = buildSmsShareLink(t);
    expect(link).toMatch(/^sms:\?&body=/);
  });
});
