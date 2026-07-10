/**
 * Tests validation magic bytes + SVG XSS (Lot 26).
 */

import { describe, it, expect } from "vitest";
import {
  detectMimeType,
  looksLikeSvg,
  svgHasXssPayload,
  validateUploadBytes,
} from "../../src/lib/file-security";

/** Helper : bytes littéraux → Uint8Array */
const bytes = (...arr: number[]) => new Uint8Array(arr);

describe("detectMimeType (Lot 26)", () => {
  it("détecte JPEG (FF D8 FF)", () => {
    expect(detectMimeType(bytes(0xff, 0xd8, 0xff, 0xe0, 0x00))).toBe("image/jpeg");
  });

  it("détecte PNG (89 50 4E 47 0D 0A 1A 0A)", () => {
    expect(
      detectMimeType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00))
    ).toBe("image/png");
  });

  it("détecte GIF89a", () => {
    expect(detectMimeType(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe("image/gif");
  });

  it("détecte GIF87a", () => {
    expect(detectMimeType(bytes(0x47, 0x49, 0x46, 0x38, 0x37, 0x61))).toBe("image/gif");
  });

  it("détecte WebP (RIFF ???? WEBP)", () => {
    const buf = new Uint8Array(16);
    buf[0] = 0x52; buf[1] = 0x49; buf[2] = 0x46; buf[3] = 0x46;
    // 4-7 = taille variable → wildcard
    buf[8] = 0x57; buf[9] = 0x45; buf[10] = 0x42; buf[11] = 0x50;
    expect(detectMimeType(buf)).toBe("image/webp");
  });

  it("détecte PDF (%PDF-)", () => {
    expect(detectMimeType(bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31))).toBe("application/pdf");
  });

  it("retourne null pour bytes inconnus (exe, txt…)", () => {
    // MZ (exe Windows)
    expect(detectMimeType(bytes(0x4d, 0x5a, 0x90, 0x00))).toBeNull();
    // ASCII "Hello"
    expect(detectMimeType(bytes(0x48, 0x65, 0x6c, 0x6c, 0x6f))).toBeNull();
    // Vide
    expect(detectMimeType(new Uint8Array())).toBeNull();
  });

  it("ne match pas si le buffer est trop court", () => {
    expect(detectMimeType(bytes(0x89, 0x50))).toBeNull();
  });
});

describe("looksLikeSvg (Lot 26)", () => {
  it("reconnaît un SVG standard", () => {
    expect(looksLikeSvg('<svg xmlns="...">')).toBe(true);
    expect(looksLikeSvg('  <svg>')).toBe(true); // avec whitespace
  });

  it("reconnaît un SVG avec déclaration XML", () => {
    expect(looksLikeSvg('<?xml version="1.0"?><svg>...</svg>')).toBe(true);
  });

  it("rejette un HTML classique", () => {
    expect(looksLikeSvg('<html><body>...</body></html>')).toBe(false);
  });

  it("rejette du texte quelconque", () => {
    expect(looksLikeSvg("hello world")).toBe(false);
    expect(looksLikeSvg("")).toBe(false);
  });
});

describe("svgHasXssPayload (Lot 26)", () => {
  it("détecte <script>", () => {
    expect(svgHasXssPayload('<svg><script>alert(1)</script></svg>')).toBe(true);
    expect(svgHasXssPayload('<svg><SCRIPT>alert(1)</SCRIPT></svg>')).toBe(true); // insensible casse
  });

  it("détecte les event handlers on*=", () => {
    expect(svgHasXssPayload('<svg onload="alert(1)"></svg>')).toBe(true);
    expect(svgHasXssPayload('<svg onclick="doIt()"></svg>')).toBe(true);
    expect(svgHasXssPayload('<svg onmouseover="x=1"></svg>')).toBe(true);
  });

  it("détecte javascript: URI", () => {
    expect(svgHasXssPayload('<svg><a href="javascript:alert(1)">x</a></svg>')).toBe(true);
    expect(svgHasXssPayload('<svg><a href="JavaScript: void(0)">x</a></svg>')).toBe(true);
  });

  it("détecte <foreignObject> (HTML injection)", () => {
    expect(svgHasXssPayload('<svg><foreignObject><body>x</body></foreignObject></svg>')).toBe(true);
  });

  it("détecte xlink:href='data:' (SVG polyglot)", () => {
    expect(svgHasXssPayload('<svg><use xlink:href="data:image/svg+xml,x"/></svg>')).toBe(true);
  });

  it("laisse passer un SVG propre", () => {
    expect(svgHasXssPayload('<svg><circle cx="50" cy="50" r="40"/></svg>')).toBe(false);
    expect(svgHasXssPayload('<svg xmlns="http://www.w3.org/2000/svg"><path d="M10 10"/></svg>')).toBe(false);
  });
});

describe("validateUploadBytes (Lot 26)", () => {
  const ALLOWED = ["image/", "application/pdf"];

  it("accepte un PNG légitime", () => {
    const png = new ArrayBuffer(16);
    const view = new Uint8Array(png);
    view.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const r = validateUploadBytes(png, "image/png", ALLOWED);
    expect(r.ok).toBe(true);
    expect(r.mime).toBe("image/png");
  });

  it("refuse un exe déguisé en PNG", () => {
    const fake = new ArrayBuffer(8);
    const view = new Uint8Array(fake);
    view.set([0x4d, 0x5a, 0x90, 0x00]); // MZ (Windows PE)
    const r = validateUploadBytes(fake, "image/png", ALLOWED);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("unknown_type");
  });

  it("refuse un fichier vide", () => {
    const r = validateUploadBytes(new ArrayBuffer(0), "image/png", ALLOWED);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("empty");
  });

  it("refuse un SVG avec <script>", () => {
    const svg = '<svg><script>alert(1)</script></svg>';
    const buf = new TextEncoder().encode(svg).buffer;
    const r = validateUploadBytes(buf, "image/svg+xml", ["image/"]);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("svg_xss_payload");
  });

  it("accepte un SVG propre si dans allowedPrefixes", () => {
    const svg = '<svg><circle r="10"/></svg>';
    const buf = new TextEncoder().encode(svg).buffer;
    const r = validateUploadBytes(buf, "image/svg+xml", ["image/"]);
    expect(r.ok).toBe(true);
    expect(r.mime).toBe("image/svg+xml");
  });

  it("refuse un SVG même propre si SVG non autorisé", () => {
    const svg = '<svg><circle r="10"/></svg>';
    const buf = new TextEncoder().encode(svg).buffer;
    // Seul image/png autorisé
    const r = validateUploadBytes(buf, "image/svg+xml", ["image/png"]);
    expect(r.ok).toBe(false);
  });

  it("refuse un PDF si non autorisé", () => {
    const pdf = new ArrayBuffer(8);
    const view = new Uint8Array(pdf);
    view.set([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
    const r = validateUploadBytes(pdf, "application/pdf", ["image/"]);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("type_not_allowed");
  });
});
