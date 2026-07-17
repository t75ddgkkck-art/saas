/**
 * Tests Lot 58 MAJ1 — le renderer blog doit être 100% résistant au XSS.
 *
 * Un pro compromis (ou un compte équipe malveillant) peut coller du contenu
 * arbitraire dans un article. Le renderer doit garantir qu'AUCUN tag actif
 * (script, iframe, event handler, data URI, javascript:) ne peut être injecté.
 */
import { describe, it, expect } from "vitest";
import { escapeHtml, renderBlogContent } from "@/lib/blog-renderer";

describe("escapeHtml", () => {
  it("échappe les 5 caractères dangereux", () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"
    );
  });

  it("échappe & en premier (pas de double-échappement)", () => {
    // Si on échappe & après <, on aurait "&amp;amp;lt;"
    expect(escapeHtml("<>&")).toBe("&lt;&gt;&amp;");
  });

  it("échappe l'apostrophe (attribute breakout)", () => {
    expect(escapeHtml("a'b")).toBe("a&#39;b");
  });

  it("laisse le texte normal intact", () => {
    expect(escapeHtml("Bonjour comment ça va ?")).toBe("Bonjour comment ça va ?");
  });

  it("gère les chaînes vides", () => {
    expect(escapeHtml("")).toBe("");
  });
});

describe("renderBlogContent — XSS resistance", () => {
  it("neutralise un <script> stored", () => {
    const html = renderBlogContent('<script>alert("XSS")</script>');
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain("&lt;script&gt;");
  });

  it("neutralise une <img onerror>", () => {
    const html = renderBlogContent('<img src=x onerror="alert(1)">');
    // Le tag lui-même doit être neutralisé (échappé en &lt;img)
    expect(html).not.toMatch(/<img/i);
    expect(html).toContain("&lt;img");
    // La chaîne "onerror=" peut subsister DANS le texte échappé (inoffensif),
    // ce qui compte c'est qu'elle ne soit pas dans un tag actif :
    // "<foo onerror=" serait dangereux, "&lt;foo onerror=" ne l'est pas.
    expect(html).not.toMatch(/<\w+\s[^>]*onerror=/i);
  });

  it("neutralise une <iframe>", () => {
    const html = renderBlogContent('<iframe src="https://attacker.com"></iframe>');
    expect(html).not.toMatch(/<iframe/i);
    expect(html).toContain("&lt;iframe");
  });

  it("neutralise un data:text/html", () => {
    const html = renderBlogContent('<a href="data:text/html,<script>alert(1)</script>">x</a>');
    expect(html).not.toMatch(/<a href="data:/i);
    expect(html).toContain("&lt;a href=");
  });

  it("neutralise un javascript: dans un href injecté", () => {
    const html = renderBlogContent('<a href="javascript:alert(1)">click</a>');
    expect(html).not.toMatch(/href="javascript:/i);
  });

  it("neutralise un SVG onload", () => {
    const html = renderBlogContent('<svg onload="alert(1)"></svg>');
    expect(html).not.toMatch(/<svg/i);
    // Pas de tag actif avec onload= (la chaîne peut rester dans le texte échappé)
    expect(html).not.toMatch(/<\w+\s[^>]*onload=/i);
  });

  it("neutralise un attribut breakout via apostrophe", () => {
    // Cas où un attaquant essaie de casser un attribut si on l'interpole
    // dans un tag. Ici il n'y a pas de tag actif dans notre rendering (que
    // des <p> avec class fixe), mais on vérifie que les apostrophes sont
    // bien échappées → aucune chance de breakout.
    const html = renderBlogContent("test' onerror='alert(1)");
    expect(html).toContain("&#39;");
    // La string reste visible dans le texte (échappée) mais pas dans un tag actif
    expect(html).not.toMatch(/<\w+\s[^>]*onerror=/i);
  });

  it("neutralise un <style> avec expression()", () => {
    const html = renderBlogContent("<style>body{background:url(javascript:alert(1))}</style>");
    expect(html).not.toMatch(/<style/i);
  });
});

describe("renderBlogContent — formats markdown préservés", () => {
  it("rend un H1", () => {
    const html = renderBlogContent("# Mon titre");
    expect(html).toContain("<h1");
    expect(html).toContain("Mon titre</h1>");
  });

  it("rend un H2", () => {
    const html = renderBlogContent("## Sous-titre");
    expect(html).toContain("<h2");
    expect(html).toContain("Sous-titre</h2>");
  });

  it("rend une liste à puces", () => {
    const html = renderBlogContent("- item 1\n- item 2");
    expect(html.match(/<li class="ml-4 list-disc/g)?.length).toBe(2);
    expect(html).toContain("item 1");
    expect(html).toContain("item 2");
  });

  it("rend une liste numérotée", () => {
    const html = renderBlogContent("1. premier\n2. second");
    expect(html.match(/<li class="ml-4 list-decimal/g)?.length).toBe(2);
  });

  it("rend un paragraphe en gras (ligne entière **...**)", () => {
    const html = renderBlogContent("**important**");
    expect(html).toContain('<p class="font-bold');
    expect(html).toContain("important</p>");
  });

  it("rend une ligne vide comme spacer", () => {
    const html = renderBlogContent("");
    expect(html).toContain('<div class="h-4"></div>');
  });

  it("rend une ligne normale comme paragraphe", () => {
    const html = renderBlogContent("Bonjour tout le monde");
    expect(html).toContain('<p class="text-slate-700');
    expect(html).toContain("Bonjour tout le monde</p>");
  });

  it("gère un article complet multi-lignes", () => {
    const html = renderBlogContent(
      "# Titre\n\n## Intro\nUn paragraphe.\n\n- point 1\n- point 2\n\n**Conclusion**"
    );
    expect(html).toContain("<h1");
    expect(html).toContain("<h2");
    expect(html.match(/<li/g)?.length).toBe(2);
    expect(html).toContain("Conclusion</p>");
  });

  it("préserve les caractères accentués français", () => {
    const html = renderBlogContent("# Éà çù règles");
    expect(html).toContain("Éà çù règles");
  });

  it("ne casse pas les ** de longueur < 4 (edge)", () => {
    // "**" (2 chars) matche startsWith && endsWith mais slice(2,-2)="" → check length >= 4
    const html = renderBlogContent("**");
    // Doit être rendu comme paragraphe normal, pas comme gras vide
    expect(html).toContain('<p class="text-slate-700');
  });
});
