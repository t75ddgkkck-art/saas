/**
 * Lot 62 — Tests structure des templates vitrine.
 *
 * Ces tests VERROUILLENT la structure attendue par PublicPage.tsx :
 *  - buttonRadius doit être UN radius pur (rounded-*) sans bg/border/text
 *  - Ces classes visuelles vont dans buttonExtras (optionnel)
 *
 * Avant Lot 62 : premium-dark avait `rounded-full bg-indigo-600 hover:bg-indigo-500`
 * dans buttonRadius → conflit avec `style={{ backgroundColor: primaryColor }}`
 * dans PublicPage → couleur choisie par le pro ignorée.
 */
import { describe, it, expect } from "vitest";
import {
  vitrineTemplates,
  getTemplate,
  templatesForPlan,
  canUseTemplate,
} from "@/lib/vitrine-templates";

describe("vitrineTemplates — structure verrouillée (Lot 62)", () => {
  it("buttonRadius contient UNIQUEMENT un rounded-* (pas de bg/border/text)", () => {
    // Regex stricte : que "rounded-XXX" (rounded-none/sm/md/lg/xl/2xl/3xl/full).
    const radiusOnly = /^rounded-(none|sm|md|lg|xl|2xl|3xl|full)$/;
    for (const tpl of vitrineTemplates) {
      expect(
        radiusOnly.test(tpl.style.buttonRadius),
        `Template "${tpl.id}" buttonRadius="${tpl.style.buttonRadius}" contient autre chose qu'un radius pur. Les styles visuels doivent aller dans buttonExtras.`
      ).toBe(true);
    }
  });

  it("buttonExtras (si présent) ne contient PAS de radius", () => {
    // Empêche la duplication accidentelle. Si radius spécifié en extras aussi
    // → conflit potentiel de spécificité Tailwind.
    for (const tpl of vitrineTemplates) {
      if (tpl.style.buttonExtras) {
        expect(
          /\brounded-/.test(tpl.style.buttonExtras),
          `Template "${tpl.id}" buttonExtras contient un radius, doit aller dans buttonRadius`
        ).toBe(false);
      }
    }
  });

  it("chaque template a les 8 propriétés de style obligatoires", () => {
    for (const tpl of vitrineTemplates) {
      const s = tpl.style;
      expect(s.coverGradient, `${tpl.id}.coverGradient`).toBeTruthy();
      expect(s.pageBg, `${tpl.id}.pageBg`).toBeTruthy();
      expect(s.cardBg, `${tpl.id}.cardBg`).toBeTruthy();
      expect(s.cardBorder, `${tpl.id}.cardBorder`).toBeTruthy();
      expect(s.buttonRadius, `${tpl.id}.buttonRadius`).toBeTruthy();
      expect(s.avatarRadius, `${tpl.id}.avatarRadius`).toBeTruthy();
      expect(s.fontFamily, `${tpl.id}.fontFamily`).toBeTruthy();
      expect(s.headerHeight, `${tpl.id}.headerHeight`).toBeTruthy();
      expect(["center", "left"]).toContain(s.layout);
    }
  });

  it("pageBg utilise une classe Tailwind (préfixe bg-*)", () => {
    // Sinon la détection dark côté preview + application côté PublicPage échouent.
    for (const tpl of vitrineTemplates) {
      expect(tpl.style.pageBg).toMatch(/(^|\s)bg-/);
    }
  });

  it("headerHeight est une classe Tailwind h-*", () => {
    for (const tpl of vitrineTemplates) {
      expect(tpl.style.headerHeight).toMatch(/^h-\d+$/);
    }
  });

  it("les IDs de template sont uniques (pas de collision)", () => {
    const ids = vitrineTemplates.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("getTemplate — sélecteur", () => {
  it("retourne le template demandé si l'id existe", () => {
    expect(getTemplate("premium-dark").id).toBe("premium-dark");
  });

  it("fallback sur classique si id inconnu", () => {
    expect(getTemplate("template-qui-nexiste-pas").id).toBe("classique");
  });

  it("fallback sur classique si id null/undefined", () => {
    expect(getTemplate(null).id).toBe("classique");
    expect(getTemplate(undefined).id).toBe("classique");
  });
});

describe("templatesForPlan — gate par plan", () => {
  it("free : seul le template gratuit classique", () => {
    const list = templatesForPlan("free");
    expect(list.length).toBe(1);
    expect(list[0].id).toBe("classique");
  });

  it("pro : classique + templates pro (pas premium)", () => {
    const list = templatesForPlan("pro");
    expect(list.some((t) => t.id === "classique")).toBe(true);
    expect(list.some((t) => t.plan === "pro")).toBe(true);
    expect(list.some((t) => t.plan === "premium")).toBe(false);
  });

  it("premium : tous les templates", () => {
    const list = templatesForPlan("premium");
    expect(list.length).toBe(vitrineTemplates.length);
  });
});

describe("canUseTemplate — check permission", () => {
  it("free ne peut PAS utiliser premium-dark", () => {
    expect(canUseTemplate("free", "premium-dark")).toBe(false);
  });

  it("pro ne peut PAS utiliser premium-gold", () => {
    expect(canUseTemplate("pro", "premium-gold")).toBe(false);
  });

  it("premium peut utiliser tout", () => {
    for (const tpl of vitrineTemplates) {
      expect(canUseTemplate("premium", tpl.id)).toBe(true);
    }
  });
});
