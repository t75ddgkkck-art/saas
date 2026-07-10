/**
 * Tests des helpers CSV (Lot 24).
 */

import { describe, it, expect } from "vitest";
import { serializeCsv, parseCsv } from "../../src/lib/csv";

describe("serializeCsv (Lot 24)", () => {
  it("sérialise une ligne simple", () => {
    const csv = serializeCsv([{ name: "Alice", age: 30 }], ["name", "age"] as const);
    expect(csv).toContain("name,age");
    expect(csv).toContain("Alice,30");
  });

  it("quote les valeurs contenant une virgule", () => {
    const csv = serializeCsv([{ name: "Dupont, Jean" }], ["name"] as const);
    expect(csv).toContain('"Dupont, Jean"');
  });

  it("escape les guillemets internes en doublant", () => {
    const csv = serializeCsv([{ note: 'Il a dit "bonjour"' }], ["note"] as const);
    expect(csv).toContain('"Il a dit ""bonjour"""');
  });

  it("gère les newlines dans les cellules", () => {
    const csv = serializeCsv([{ note: "ligne1\nligne2" }], ["note"] as const);
    expect(csv).toContain('"ligne1\nligne2"');
  });

  it("retourne vide/null comme chaîne vide (pas 'null')", () => {
    const csv = serializeCsv([{ v: null }, { v: undefined }], ["v"] as const);
    // Header "v" + 2 lignes vides (juste des \r\n). On garde les fins vides
    // via un split explicite (pas de trim qui les mange).
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("v"); // header
    expect(lines[1]).toBe(""); // ligne null
    expect(lines[2]).toBe(""); // ligne undefined
    // Ne DOIT jamais contenir la string "null" ou "undefined"
    expect(csv).not.toMatch(/null|undefined/);
  });

  it("ajoute un BOM UTF-8 si opts.bom", () => {
    const csv = serializeCsv([{ a: "é" }], ["a"] as const, { bom: true });
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });
});

describe("parseCsv (Lot 24)", () => {
  it("parse un CSV standard", () => {
    const rows = parseCsv("name,age\nAlice,30\nBob,25");
    expect(rows).toEqual([
      { name: "Alice", age: "30" },
      { name: "Bob", age: "25" },
    ]);
  });

  it("gère les champs quotés avec virgules", () => {
    const rows = parseCsv('name,city\n"Dupont, Jean","Paris"');
    expect(rows[0].name).toBe("Dupont, Jean");
    expect(rows[0].city).toBe("Paris");
  });

  it("dé-escape les guillemets doubles", () => {
    const rows = parseCsv('note\n"Il a dit ""bonjour"""');
    expect(rows[0].note).toBe('Il a dit "bonjour"');
  });

  it("gère les newlines dans les champs quotés", () => {
    const rows = parseCsv('note\n"ligne1\nligne2"');
    expect(rows[0].note).toBe("ligne1\nligne2");
  });

  it("ignore le BOM UTF-8 en tête", () => {
    const rows = parseCsv("\uFEFFname\nAlice");
    expect(rows).toEqual([{ name: "Alice" }]);
  });

  it("gère les CRLF Windows", () => {
    const rows = parseCsv("name,age\r\nAlice,30\r\nBob,25");
    expect(rows).toHaveLength(2);
  });

  it("retourne un array vide si input vide", () => {
    expect(parseCsv("")).toEqual([]);
  });

  it("ignore les lignes vides finales", () => {
    const rows = parseCsv("name\nAlice\n\n\n");
    expect(rows).toEqual([{ name: "Alice" }]);
  });

  it("roundtrip : serialize puis parse redonne les mêmes valeurs", () => {
    const original = [
      { name: "Alice", note: 'A dit "OK", puis parti' },
      { name: "Bob", note: "ligne1\nligne2" },
    ];
    const csv = serializeCsv(original, ["name", "note"] as const);
    const parsed = parseCsv(csv);
    expect(parsed).toEqual(original.map((r) => ({ name: r.name, note: r.note })));
  });
});
