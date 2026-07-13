/**
 * Storage helper — abstraction pour les uploads (pièces jointes devis, images, etc.)
 *
 * Backend supportés (dans l'ordre de préférence si configurés) :
 *  1. Supabase Storage        → nécessite SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + SUPABASE_STORAGE_BUCKET
 *  2. Fallback base64 in DB   → aucune conf requise (⚠ non recommandé en prod : fait grossir la DB)
 *
 * Les URLs retournées sont directement stockables dans la colonne `url` de la table
 * `quote_attachments` — publiques (bucket public Supabase) ou signées si vous préférez.
 */
import { logger } from "@/lib/logger";
import { validateUploadBytes } from "@/lib/file-security";

export interface UploadedFile {
  /** URL absolue exploitable côté client. En mode base64 : data-URI. */
  url: string;
  /** Backend utilisé : "supabase" | "base64". */
  backend: "supabase" | "base64";
  /** Nom original conservé pour l'affichage. */
  name: string;
  /** Taille en bytes. */
  size: number;
  /** MIME type. */
  contentType: string;
}

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 Mo
const ALLOWED_PREFIXES = ["image/", "video/", "application/pdf"];

export function isSupabaseStorageConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.SUPABASE_STORAGE_BUCKET
  );
}

function safeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]/g, "-")
    .slice(0, 100);
}

/**
 * Upload d'un File (Web API) vers le backend configuré.
 * Renvoie null si le fichier est refusé (taille, type).
 */
export async function uploadFile(
  file: File,
  opts: { folder?: string } = {}
): Promise<UploadedFile | null> {
  if (!file || file.size === 0) return null;
  if (file.size > MAX_SIZE_BYTES) {
    logger.warn("storage.upload.rejected", { reason: "size", size: file.size, name: file.name });
    return null;
  }
  if (!ALLOWED_PREFIXES.some((p) => file.type.startsWith(p))) {
    logger.warn("storage.upload.rejected", { reason: "type", type: file.type, name: file.name });
    return null;
  }

  // Lot 26 : validation magic bytes + SVG XSS scan.
  // Le Content-Type client n'est pas fiable — un `.exe` renommé en `.png` a
  // `file.type === "image/png"` mais des bytes qui ne sont pas ceux d'un PNG.
  // On lit les premiers 64 KB pour cover magic bytes + XML SVG scan.
  const headBytes = await file.slice(0, 64 * 1024).arrayBuffer();
  const check = validateUploadBytes(headBytes, file.type, [
    ...ALLOWED_PREFIXES,
    "image/svg+xml", // autorisé si le XSS check passe
  ]);
  if (!check.ok) {
    logger.warn("storage.upload.rejected", {
      reason: check.reason,
      declaredType: file.type,
      detectedMime: check.mime,
      name: file.name,
    });
    return null;
  }
  // Si le vrai type diffère de ce que le client déclare, on utilise le vrai
  // (défense en profondeur : Content-Type stocké = celui détecté, pas celui déclaré).
  const trueMime = check.mime ?? file.type;

  const folder = opts.folder ?? "quotes";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName(file.name)}`;
  const path = `${folder}/${filename}`;

  if (isSupabaseStorageConfigured()) {
    try {
      return await uploadToSupabase(file, path, trueMime);
    } catch (err) {
      logger.error("storage.supabase.failed", {
        message: err instanceof Error ? err.message : String(err),
        path,
      });
      // On tombe en fallback base64 pour ne pas perdre l'upload
    }
  }

  return uploadAsBase64(file, trueMime);
}

async function uploadToSupabase(file: File, path: string, trueMime: string): Promise<UploadedFile> {
  const url = process.env.SUPABASE_URL!.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET!;

  const buffer = Buffer.from(await file.arrayBuffer());

  const res = await fetch(`${url}/storage/v1/object/${encodeURIComponent(bucket)}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      // Lot 26 : on utilise le MIME DÉTECTÉ (pas déclaré) → un exe caché
      // en .png sera stocké avec son vrai type et rendu inoffensif au download
      "Content-Type": trueMime || "application/octet-stream",
      "x-upsert": "true",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
    body: buffer,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase upload ${res.status}: ${text}`);
  }

  // URL publique (nécessite un bucket public)
  const publicUrl = `${url}/storage/v1/object/public/${bucket}/${path}`;

  return {
    url: publicUrl,
    backend: "supabase",
    name: file.name,
    size: file.size,
    contentType: trueMime,
  };
}

/**
 * Lot 42 : upload d'un Buffer généré côté serveur (PDF facture typiquement).
 *
 * Différence avec `uploadFile` :
 *  - Pas de validation magic bytes (on connaît le contenu, on l'a généré)
 *  - Pas de limite 10 Mo pour les PDFs multi-pages
 *  - Path déterministe fourni par l'appelant (facilite les rechargements idempotents)
 *
 * Renvoie `null` si aucun backend n'est configuré ET si `allowBase64=false` :
 * pour un PDF facture on refuse le base64 par défaut (fait exploser la DB).
 */
export async function uploadBuffer(
  buffer: Buffer,
  opts: {
    /** Sous-dossier (ex: "invoices"). Sera préfixé au filename. */
    folder: string;
    /** Nom de fichier final (SANS le dossier). Doit être unique. */
    filename: string;
    /** MIME (défaut application/pdf). */
    contentType?: string;
    /** Autoriser le fallback base64 si Supabase non configuré (défaut : false pour PDF). */
    allowBase64?: boolean;
  }
): Promise<UploadedFile | null> {
  const contentType = opts.contentType ?? "application/pdf";
  const path = `${opts.folder}/${opts.filename}`;

  if (isSupabaseStorageConfigured()) {
    try {
      const url = process.env.SUPABASE_URL!.replace(/\/+$/, "");
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      const bucket = process.env.SUPABASE_STORAGE_BUCKET!;

      const res = await fetch(`${url}/storage/v1/object/${encodeURIComponent(bucket)}/${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          apikey: key,
          "Content-Type": contentType,
          "x-upsert": "true",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
        // Buffer est bien accepté par undici/Node fetch runtime mais TS strict
        // ne le reconnaît pas comme BodyInit (Buffer<ArrayBufferLike> ≠ ArrayBuffer).
        // Cast explicite — safe car identique au `body: buffer` déjà utilisé
        // dans uploadToSupabase() plus haut dans ce fichier.
        body: buffer as unknown as BodyInit,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Supabase upload buffer ${res.status}: ${text}`);
      }

      return {
        url: `${url}/storage/v1/object/public/${bucket}/${path}`,
        backend: "supabase",
        name: opts.filename,
        size: buffer.byteLength,
        contentType,
      };
    } catch (err) {
      logger.error("storage.buffer.supabase.failed", {
        message: err instanceof Error ? err.message : String(err),
        path,
      });
      // Fall through au base64 si autorisé
    }
  }

  if (!opts.allowBase64) {
    logger.warn("storage.buffer.no_backend", { path, reason: "supabase_missing_and_base64_disabled" });
    return null;
  }

  return {
    url: `data:${contentType};base64,${buffer.toString("base64")}`,
    backend: "base64",
    name: opts.filename,
    size: buffer.byteLength,
    contentType,
  };
}

async function uploadAsBase64(file: File, trueMime: string): Promise<UploadedFile> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");
  return {
    // Lot 26 : data-URI avec le MIME détecté (pas déclaré)
    url: `data:${trueMime};base64,${base64}`,
    backend: "base64",
    name: file.name,
    size: file.size,
    contentType: trueMime,
  };
}
