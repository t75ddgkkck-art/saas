/**
 * Lot 58 — Rendu markdown-like pour les articles de blog.
 *
 * ⚠️ SÉCURITÉ : cette fonction est appelée avec du contenu ÉCRIT PAR LE PRO
 * (côté back-office) puis rendu via `dangerouslySetInnerHTML` sur la vitrine
 * publique. Sans sanitization, un pro compromis (ou un compte équipe malveillant
 * avec rôle admin/employee) peut injecter un `<script>` qui s'exécute chez
 * TOUS les visiteurs de la vitrine → XSS stored critique.
 *
 * Approche : au lieu de sanitizer du HTML libre (fragile), on garde le format
 * markdown-like existant (# / ## / - / 1. / **) et on ÉCHAPPE tout le texte
 * utilisateur avant injection. Tags HTML dans le contenu = affichés en texte brut.
 *
 * Pas de dépendance externe : sanitize-html = 200KB, DOMPurify côté server = jsdom.
 * Un renderer whitelist est plus sûr qu'un sanitizer permissif.
 */

/**
 * Échappe les caractères HTML dangereux dans un texte utilisateur.
 * Sortie safe à injecter dans du HTML server-side.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;") // DOIT être le premier (sinon on double-échappe les autres)
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Rendu markdown ultra-simple (h1, h2, li, p, strong) → HTML avec classes Tailwind.
 * TOUT le contenu utilisateur est échappé AVANT interpolation → 0 vecteur XSS possible.
 *
 * Formats supportés (identiques au comportement pré-Lot 58) :
 *  - `# Titre` → <h1>
 *  - `## Sous-titre` → <h2>
 *  - `- item` → <li> (list-disc)
 *  - `1. item` → <li> (list-decimal)
 *  - `**gras**` → <p> en font-bold
 *  - `` (ligne vide) → espacement
 *  - autre → <p>
 *
 * Volontairement pas de support inline (**gras** en milieu de phrase, [lien](url)) :
 * l'ancien renderer ne le supportait pas non plus, on garde iso-fonctionnel.
 */
export function renderBlogContent(content: string): string {
  return content
    .split("\n")
    .map((line) => {
      // On échappe D'ABORD, on décide du wrapping ENSUITE. Le texte échappé
      // ne peut contenir de tag actif → l'HTML final est sûr.
      if (line.startsWith("# ")) {
        const safe = escapeHtml(line.slice(2));
        return `<h1 class="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-8 mb-4">${safe}</h1>`;
      }
      if (line.startsWith("## ")) {
        const safe = escapeHtml(line.slice(3));
        return `<h2 class="text-2xl font-semibold text-slate-900 dark:text-slate-100 mt-6 mb-3">${safe}</h2>`;
      }
      if (line.startsWith("- ")) {
        const safe = escapeHtml(line.slice(2));
        return `<li class="ml-4 list-disc text-slate-700 dark:text-slate-300">${safe}</li>`;
      }
      if (line.match(/^\d+\.\s/)) {
        const safe = escapeHtml(line.replace(/^\d+\.\s/, ""));
        return `<li class="ml-4 list-decimal text-slate-700 dark:text-slate-300">${safe}</li>`;
      }
      if (line.trim() === "") {
        return `<div class="h-4"></div>`;
      }
      if (line.startsWith("**") && line.endsWith("**") && line.length >= 4) {
        const safe = escapeHtml(line.slice(2, -2));
        return `<p class="font-bold text-slate-900 dark:text-slate-100">${safe}</p>`;
      }
      const safe = escapeHtml(line);
      return `<p class="text-slate-700 dark:text-slate-300 leading-relaxed">${safe}</p>`;
    })
    .join("");
}
