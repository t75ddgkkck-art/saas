/**
 * CSV helpers minimalistes (Lot 24).
 *
 * Zero dépendance NPM (Papa Parse = 45 KB) — on gère un CSV standard :
 *  - Séparateur virgule
 *  - Guillemets doubles pour champs contenant `,`, `"`, newline
 *  - Escape des `"` internes par `""`
 *  - Header en 1ère ligne
 *  - Encoding UTF-8 (avec BOM optionnel pour Excel)
 *
 * Ne gère PAS : séparateur configurable, streaming multi-MB, dialect Excel FR
 * avec point-virgule. Suffit pour < 10k lignes clients standard.
 */

/**
 * Sérialise une ligne CSV.
 * Un champ est quoté SI il contient `,` ou `"` ou `\n` ou `\r`.
 */
function serializeField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Sérialise un array de records en CSV string.
 * Le header est la liste des `headers`. Les valeurs sont pickées via ces clés.
 *
 * @param records Array d'objets à sérialiser
 * @param headers Liste ordonnée des clés à extraire → devient l'en-tête CSV
 * @param opts.bom Ajoute un BOM UTF-8 (Excel ouvre alors correctement les accents)
 */
export function serializeCsv<T extends Record<string, unknown>>(
  records: T[],
  headers: (keyof T)[],
  opts: { bom?: boolean } = {}
): string {
  const lines = [
    headers.map((h) => serializeField(String(h))).join(","),
    ...records.map((r) => headers.map((h) => serializeField(r[h])).join(",")),
  ];
  const csv = lines.join("\r\n") + "\r\n";
  return opts.bom ? "\uFEFF" + csv : csv;
}

/**
 * Parse un CSV en records (Array<Record<string, string>>).
 * Utilise la 1ère ligne comme headers. Retourne toutes les valeurs en string.
 * Gère les guillemets et escape `""`. Ne gère pas les séparateurs custom.
 *
 * Design : parse manuel (pas de regex globale) pour être safe sur les
 * champs contenant newline/virgule quotés. ~30 lignes, testable.
 */
export function parseCsv(text: string): Record<string, string>[] {
  // Retire BOM éventuel
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        // "" → un seul " dans le champ
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (c === "\r") continue; // ignore CR, on gère par \n
    if (c === "\n") {
      row.push(field);
      // Ignore lignes complètement vides (fréquent en fin de fichier)
      if (!(row.length === 1 && row[0] === "")) rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += c;
  }
  // Dernière ligne sans newline final
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (!(row.length === 1 && row[0] === "")) rows.push(row);
  }

  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = r[i] ?? "";
    });
    return obj;
  });
}
