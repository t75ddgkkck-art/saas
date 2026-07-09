/**
 * Logger structuré minimaliste, sans dépendance externe.
 * En prod on émet du JSON pour être ingéré par n'importe quel collecteur (Vercel, Datadog, Loki, ...).
 * En dev on garde une sortie lisible.
 */
type Level = "debug" | "info" | "warn" | "error";

const IS_PROD = process.env.NODE_ENV === "production";
const MIN_LEVEL: Level = (process.env.LOG_LEVEL as Level) || (IS_PROD ? "info" : "debug");

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function emit(level: Level, msg: string, meta?: Record<string, unknown>) {
  if (ORDER[level] < ORDER[MIN_LEVEL]) return;

  if (IS_PROD) {
    // JSON structuré, une ligne
    const line = JSON.stringify({
      t: new Date().toISOString(),
      level,
      msg,
      ...meta,
    });
    // eslint-disable-next-line no-console
    (level === "error" ? console.error : console.log)(line);
    return;
  }

  const prefix = `[${level.toUpperCase()}]`;
  // eslint-disable-next-line no-console
  (level === "error" ? console.error : console.log)(prefix, msg, meta ?? "");
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => emit("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => emit("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit("error", msg, meta),
};
