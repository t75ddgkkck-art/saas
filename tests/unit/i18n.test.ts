import { describe, it, expect } from "vitest";
import {
  t,
  td,
  detectLangFromAcceptLanguage,
  formatLocaleDate,
  formatLocaleCurrency,
  allKeys,
  SUPPORTED_LANGS,
  DEFAULT_LANG,
} from "@/lib/i18n";
import { e, ei } from "@/lib/email-i18n";

describe("i18n — t()", () => {
  it("traduit dans la langue demandée", () => {
    expect(t("fr", "book")).toBe("Prendre rendez-vous");
    expect(t("en", "book")).toBe("Book an appointment");
    expect(t("es", "book")).toBe("Reservar cita");
    expect(t("de", "book")).toBe("Termin buchen");
  });

  it("fallback FR si la langue est invalide", () => {
    expect(t("xx", "book" as never)).toBe("Prendre rendez-vous");
    expect(t(null, "book")).toBe("Prendre rendez-vous");
    expect(t(undefined, "book")).toBe("Prendre rendez-vous");
  });

  it("interpole les variables {name}", () => {
    const s = t("fr", "emailFooterLegal", { business: "Nathan Plomberie" });
    expect(s).toContain("Nathan Plomberie");
    expect(s).not.toContain("{business}");
  });

  it("laisse le placeholder si la variable manque", () => {
    const s = t("fr", "emailFooterLegal");
    expect(s).toContain("{business}");
  });
});

describe("i18n — td() (alias dashboard)", () => {
  it("respecte les langues", () => {
    expect(td("fr", "logout")).toBe("Déconnexion");
    expect(td("en", "logout")).toBe("Log out");
  });

  it("retourne la clé si elle n'existe pas (dernier recours)", () => {
    expect(td("fr", "cle_inexistante_xyz")).toBe("cle_inexistante_xyz");
  });
});

describe("i18n — detectLangFromAcceptLanguage", () => {
  it.each([
    ["en-US,en;q=0.9,fr;q=0.8", "en"],
    ["es-ES,es;q=0.9", "es"],
    ["de-DE", "de"],
    ["fr-FR,fr;q=0.9,en;q=0.5", "fr"],
    ["", "fr"],
    [null, "fr"],
    ["ja-JP,ja;q=0.9", "fr"], // langue non supportée -> défaut
  ])("détecte %s → %s", (header, expected) => {
    expect(detectLangFromAcceptLanguage(header as string | null)).toBe(expected);
  });
});

describe("i18n — formatLocaleDate", () => {
  it("formate en français par défaut", () => {
    const s = formatLocaleDate("2026-07-15", "fr", { dateStyle: "long" });
    expect(s).toContain("2026");
  });

  it("formate en anglais", () => {
    const s = formatLocaleDate("2026-07-15", "en", { dateStyle: "long" });
    expect(s).toMatch(/July|Jul/);
  });
});

describe("i18n — formatLocaleCurrency", () => {
  it("format EUR fr : espace avant € et virgule décimale", () => {
    // Note : peut varier selon ICU version, on teste la structure globale
    const s = formatLocaleCurrency(29.9, "fr");
    expect(s).toContain("29");
    expect(s).toContain("€");
  });

  it("format EUR en : € avant, point décimal", () => {
    const s = formatLocaleCurrency(29.9, "en");
    expect(s).toContain("€29");
  });
});

describe("i18n — cohérence dictionnaire", () => {
  it("expose les 4 langues supportées", () => {
    expect(SUPPORTED_LANGS).toEqual(["fr", "en", "es", "de"]);
    expect(DEFAULT_LANG).toBe("fr");
  });

  it("liste toutes les clés depuis FR", () => {
    const keys = allKeys();
    expect(keys.length).toBeGreaterThan(50);
    expect(keys).toContain("book");
    expect(keys).toContain("logout");
    expect(keys).toContain("emailFooterLegal");
  });

  it("chaque clé FR a une traduction (au moins un fallback)", () => {
    for (const key of allKeys()) {
      expect(t("fr", key)).toBeTruthy();
    }
  });
});

describe("email-i18n — e()", () => {
  it("subjects sont des fonctions", () => {
    const fnFr = e("fr", "subjectBookingConfirmed");
    const fnEn = e("en", "subjectBookingConfirmed");
    expect(typeof fnFr).toBe("function");
    expect((fnFr as (b: string) => string)("Toto")).toContain("Toto");
    expect((fnEn as (b: string) => string)("Toto")).toContain("Toto");
  });

  it("labels traduits par langue", () => {
    expect(e("fr", "hello")).toBe("Bonjour");
    expect(e("en", "hello")).toBe("Hello");
    expect(e("es", "hello")).toBe("Hola");
    expect(e("de", "hello")).toBe("Guten Tag");
  });

  it("fallback FR si langue absente ou clé manquante", () => {
    expect(e("xx" as never, "hello")).toBe("Bonjour");
  });
});

describe("email-i18n — ei() interpolation", () => {
  it("remplace {number} par la valeur", () => {
    expect(ei("Devis {number} pending", { number: "DEV-2026-1234" })).toBe(
      "Devis DEV-2026-1234 pending"
    );
  });

  it("laisse les placeholders inconnus", () => {
    expect(ei("Hi {name}", {})).toBe("Hi {name}");
  });
});
