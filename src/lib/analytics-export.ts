/**
 * Lot 56 — Export CSV analytics.
 *
 * Génère un CSV multi-sections à partir de la réponse `/api/analytics`.
 *
 * Design :
 *  - Séparateur `;` (standard FR Excel — Excel FR ne détecte pas `,` auto)
 *  - BOM UTF-8 en tête (accents corrects dans Excel/LibreOffice)
 *  - Sections séparées par 2 lignes vides + un `# Titre section` (commentaire humain)
 *  - Escape défensif : guillemets, retours ligne, séparateur en valeur
 *
 * Pas d'utilisation du `serializeCsv` existant (Lot 24) car celui-ci force `,`
 * comme séparateur. Ici on veut la flexibilité `;` FR-friendly.
 */

const SEP = ";";
const BOM = "\uFEFF"; // UTF-8 BOM pour Excel

// -----------------------------------------------------------------------------
// Types miroir de /api/analytics response
// -----------------------------------------------------------------------------

export interface AnalyticsExportData {
  /** Période demandée : "7d" | "30d" | "90d" */
  period: string;
  businessName: string;
  businessSlug: string;
  /** Vue d'ensemble */
  summary: {
    totalVisits: number;
    uniqueVisitors: number;
    newAppointments: number;
    newQuotes: number;
    revenueEur: number;
  };
  /** Série temporelle jour par jour */
  daily: {
    date: string; // YYYY-MM-DD
    visits: number;
    uniqueVisitors: number;
  }[];
  /** Sources — visible seulement si plan Pro+ (advanced) */
  sources?: {
    source: string;
    count: number;
  }[];
  /** Devices — visible seulement si plan Pro+ */
  devices?: {
    device: string;
    count: number;
  }[];
  /** Top paths — visible seulement si plan Pro+ */
  topPaths?: {
    path: string;
    count: number;
  }[];
}

// -----------------------------------------------------------------------------
// Escape defensive
// -----------------------------------------------------------------------------

/**
 * Escape une valeur CSV selon RFC 4180 adapté au séparateur `;` FR.
 * Quotes le champ si contient `;`, `"`, `\n`, `\r`. Escape les `"` internes en `""`.
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[;"\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Sérialise une ligne (array de valeurs) → string CSV.
 */
export function csvRow(cells: unknown[]): string {
  return cells.map(escapeCsvCell).join(SEP);
}

// -----------------------------------------------------------------------------
// Construction du CSV multi-sections
// -----------------------------------------------------------------------------

/**
 * Génère le CSV complet.
 *
 * Structure :
 *   BOM
 *   # Vitrix — Analytics — <business> — <period>
 *   # Généré le <ISO date>
 *
 *   # Vue d'ensemble
 *   Métrique;Valeur
 *   Visites totales;123
 *   ...
 *
 *   # Visites par jour
 *   Date;Visites;Visiteurs uniques
 *   2026-07-01;42;12
 *   ...
 *
 *   # Sources (Pro+)
 *   Source;Nombre
 *   ...
 */
export function buildAnalyticsCsv(data: AnalyticsExportData): string {
  const lines: string[] = [];

  // Header commentaire (non-standard mais lisible humain, ignoré par Excel)
  lines.push(`# Vitrix — Analytics — ${data.businessName} — ${data.period}`);
  lines.push(`# Généré le ${new Date().toISOString()}`);
  lines.push(""); // séparateur visuel

  // === Section 1 : Vue d'ensemble ===
  lines.push("# Vue d'ensemble");
  lines.push(csvRow(["Métrique", "Valeur"]));
  lines.push(csvRow(["Visites totales", data.summary.totalVisits]));
  lines.push(csvRow(["Visiteurs uniques", data.summary.uniqueVisitors]));
  lines.push(csvRow(["Nouveaux rendez-vous", data.summary.newAppointments]));
  lines.push(csvRow(["Nouveaux devis", data.summary.newQuotes]));
  lines.push(csvRow(["Revenus (EUR)", data.summary.revenueEur.toFixed(2)]));
  lines.push("");

  // === Section 2 : Série journalière ===
  lines.push("# Visites par jour");
  lines.push(csvRow(["Date", "Visites", "Visiteurs uniques"]));
  for (const d of data.daily) {
    lines.push(csvRow([d.date, d.visits, d.uniqueVisitors]));
  }
  lines.push("");

  // === Section 3 : Sources (Pro+) ===
  if (data.sources && data.sources.length > 0) {
    lines.push("# Sources de trafic");
    lines.push(csvRow(["Source", "Nombre de visites"]));
    for (const s of data.sources) {
      lines.push(csvRow([s.source, s.count]));
    }
    lines.push("");
  }

  // === Section 4 : Devices (Pro+) ===
  if (data.devices && data.devices.length > 0) {
    lines.push("# Devices");
    lines.push(csvRow(["Type", "Nombre"]));
    for (const d of data.devices) {
      lines.push(csvRow([d.device, d.count]));
    }
    lines.push("");
  }

  // === Section 5 : Top pages (Pro+) ===
  if (data.topPaths && data.topPaths.length > 0) {
    lines.push("# Pages les plus visitées");
    lines.push(csvRow(["Chemin", "Vues"]));
    for (const p of data.topPaths) {
      lines.push(csvRow([p.path, p.count]));
    }
    lines.push("");
  }

  // \r\n pour compat Excel Windows
  return BOM + lines.join("\r\n");
}

/**
 * Nom de fichier suggéré pour Content-Disposition.
 * Ex : "vitrix-analytics-dupont-plomberie-30d-2026-07-19.csv"
 * Sanitize le slug (défensif — au cas où slug contient des caractères bizarres).
 */
export function buildFilename(slug: string, period: string, date: Date = new Date()): string {
  const safeSlug = slug.replace(/[^a-z0-9-]/gi, "-").toLowerCase().slice(0, 40);
  const dateStr = date.toISOString().slice(0, 10);
  return `vitrix-analytics-${safeSlug}-${period}-${dateStr}.csv`;
}
