/**
 * Sécurité des uploads (Lot 26).
 *
 * PROBLÈME : le `Content-Type` déclaré par le client (browser ou attaquant) n'est
 * PAS fiable. Un `.exe` renommé en `.png` passe si on se contente de checker
 * `file.type.startsWith("image/")`.
 *
 * SOLUTION : lire les premiers bytes ("magic bytes") et matcher contre la liste
 * connue. Bonus : scan des SVG pour rejeter les scripts injectés (XSS classique
 * via <svg><script>alert(1)</script></svg>).
 *
 * Fonctions pures, testables sans DB.
 */

/**
 * Signature magic bytes → type MIME réel.
 * Source : https://en.wikipedia.org/wiki/List_of_file_signatures
 * On ne liste que ce qu'on autorise (Lot 26 défense en profondeur : allow-list).
 */
interface MagicSignature {
  mime: string;
  bytes: (number | null)[]; // null = wildcard (bytes variables comme dans WebP)
  offset?: number;
}

const SIGNATURES: MagicSignature[] = [
  // JPEG : FF D8 FF
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  // PNG : 89 50 4E 47 0D 0A 1A 0A
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  // GIF87a / GIF89a : 47 49 46 38 3(7|9) 61
  { mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38, null, 0x61] },
  // WebP : RIFF ???? WEBP (4 bytes RIFF, 4 bytes size, 4 bytes WEBP)
  {
    mime: "image/webp",
    bytes: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50],
  },
  // AVIF : ftypavif à l'offset 4 (souvent ftypavis, ftypavif, ftypheic…)
  {
    mime: "image/avif",
    offset: 4,
    bytes: [0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66],
  },
  // PDF : %PDF-
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  // MP4 : ftyp à l'offset 4
  {
    mime: "video/mp4",
    offset: 4,
    bytes: [0x66, 0x74, 0x79, 0x70],
  },
  // WebM : 1A 45 DF A3 (EBML)
  { mime: "video/webm", bytes: [0x1a, 0x45, 0xdf, 0xa3] },
];

/**
 * Détecte le type MIME réel depuis les premiers bytes.
 * Retourne null si aucune signature reconnue → fichier refusé.
 */
export function detectMimeType(bytes: Uint8Array): string | null {
  for (const sig of SIGNATURES) {
    const offset = sig.offset ?? 0;
    if (bytes.length < offset + sig.bytes.length) continue;
    let match = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      const expected = sig.bytes[i];
      if (expected === null) continue; // wildcard
      if (bytes[offset + i] !== expected) {
        match = false;
        break;
      }
    }
    if (match) return sig.mime;
  }
  return null;
}

/**
 * Détecte si le contenu ressemble à un SVG XML (pas de magic bytes fixes).
 * On check le début (skip BOM + whitespace) : commence par `<?xml` ou `<svg`.
 */
export function looksLikeSvg(text: string): boolean {
  const trimmed = text.trimStart().slice(0, 200).toLowerCase();
  return trimmed.startsWith("<?xml") || trimmed.startsWith("<svg");
}

/**
 * Détecte les payloads XSS dans un SVG.
 * Rejette :
 *  - `<script>` (inline JS)
 *  - `on*=` (event handlers : onclick, onload, onmouseover…)
 *  - `javascript:` URI dans href/xlink:href
 *  - `<foreignObject>` (peut embarquer du HTML avec des scripts)
 *  - `<use xlink:href="data:...">` (SVG polyglot XSS)
 *
 * Faux positifs acceptables : on refuse plutôt qu'on filtre (les user
 * peuvent utiliser un vrai `.png` s'ils veulent un logo).
 */
export function svgHasXssPayload(text: string): boolean {
  const lower = text.toLowerCase();
  if (/<script[\s>]/.test(lower)) return true;
  if (/\son\w+\s*=/.test(lower)) return true; // onload= onclick= etc.
  if (/javascript\s*:/.test(lower)) return true;
  if (/<foreignobject/.test(lower)) return true;
  // xlink:href="data:" est un vecteur XSS via SVG polyglots
  if (/xlink:href\s*=\s*["']?data:/.test(lower)) return true;
  return false;
}

/**
 * Vérifie un upload de façon sûre.
 *
 * @param buffer Bytes lus du fichier (à obtenir via file.arrayBuffer())
 * @param declaredType MIME déclaré par le client (Content-Type)
 * @param allowedPrefixes Préfixes autorisés (["image/", "application/pdf"])
 * @returns { ok, mime, reason } — mime = vrai type détecté
 */
export function validateUploadBytes(
  buffer: ArrayBuffer,
  declaredType: string,
  allowedPrefixes: string[]
): { ok: boolean; mime: string | null; reason?: string } {
  const bytes = new Uint8Array(buffer);
  if (bytes.length === 0) return { ok: false, mime: null, reason: "empty" };

  // Cas spécial SVG : pas de magic bytes fixes, on scan le texte
  const isDeclaredSvg = declaredType === "image/svg+xml";
  if (isDeclaredSvg) {
    // On accepte SVG que si "image/svg+xml" est dans allowed
    if (!allowedPrefixes.some((p) => "image/svg+xml".startsWith(p))) {
      return { ok: false, mime: "image/svg+xml", reason: "type_not_allowed" };
    }
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 65536));
    if (!looksLikeSvg(text)) {
      return { ok: false, mime: null, reason: "svg_content_mismatch" };
    }
    if (svgHasXssPayload(text)) {
      return { ok: false, mime: "image/svg+xml", reason: "svg_xss_payload" };
    }
    return { ok: true, mime: "image/svg+xml" };
  }

  // Cas binaire : match magic bytes
  const detected = detectMimeType(bytes);
  if (!detected) {
    return { ok: false, mime: null, reason: "unknown_type" };
  }
  if (!allowedPrefixes.some((p) => detected.startsWith(p))) {
    return { ok: false, mime: detected, reason: "type_not_allowed" };
  }
  // Warning si le type déclaré ne matche pas (attaque probable) mais on ne
  // rejette pas → certains browsers renvoient un Content-Type générique
  // (application/octet-stream) mais le fichier est safe.
  // Le vrai type retourné (`mime` détecté) est celui à faire foi.
  return { ok: true, mime: detected };
}
