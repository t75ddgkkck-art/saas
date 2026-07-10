/**
 * Détecteur de brute-force login (Lot 26).
 *
 * Le rate-limit standard (5 tentatives / minute) refuse déjà les attaques
 * banales. Mais un attaquant patient (2 requêtes/min sur 24h = 2880 tentatives)
 * passe sous le radar → on veut ALERTER l'équipe en temps réel dès qu'un
 * pattern suspect se dessine.
 *
 * DÉTECTION :
 *  - Compte les FAILURES login par IP dans une fenêtre 1h
 *  - Seuil configurable via `BRUTE_FORCE_THRESHOLD` (défaut 30)
 *  - À chaque dépassement → captureMessage severity=warning + sendAlert critique
 *  - Anti-spam alerte : max 1 alerte par IP par heure (même si 100 tentatives dedans)
 *
 * Stockage : in-memory par process (comme rate-limit). Suffit pour détecter
 * les vraies attaques — un attaquant distribuant sur 1000 IPs ≠ brute-force
 * (c'est du credential stuffing, autre défense = captcha + email verify).
 *
 * Aucun coût DB : la mémoire tolère facilement 10k IPs actives.
 */

import { logger } from "@/lib/logger";
import { captureMessage } from "@/lib/monitoring";
import { sendAlert } from "@/lib/alerts";

const WINDOW_MS = 60 * 60 * 1000; // 1 heure
const ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 1 alerte / IP / heure max
const DEFAULT_THRESHOLD = 30;

interface IpEntry {
  count: number;
  windowStart: number;
  lastAlertAt: number;
}

const store = new Map<string, IpEntry>();

function threshold(): number {
  const raw = Number(process.env.BRUTE_FORCE_THRESHOLD);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_THRESHOLD;
}

/**
 * Purge opportuniste des entrées expirées quand la map grossit.
 * Évite une fuite mémoire lente sur un long uptime.
 */
function maybeCleanup(now: number): void {
  if (store.size < 5000) return;
  for (const [ip, entry] of store) {
    if (now - entry.windowStart > WINDOW_MS * 2) store.delete(ip);
  }
}

/**
 * À appeler à CHAQUE échec login (avant de renvoyer 401).
 * Non-bloquant : ne throw jamais, ne fait pas attendre l'user.
 */
export function recordLoginFailure(ip: string | null, extra?: { email?: string }): void {
  if (!ip || ip === "unknown") return;
  const now = Date.now();
  const cur = store.get(ip);

  if (!cur || now - cur.windowStart > WINDOW_MS) {
    // Nouvelle fenêtre
    store.set(ip, { count: 1, windowStart: now, lastAlertAt: 0 });
    maybeCleanup(now);
    return;
  }

  cur.count++;

  if (cur.count >= threshold() && now - cur.lastAlertAt > ALERT_COOLDOWN_MS) {
    cur.lastAlertAt = now;
    const message = `Brute-force login suspecté depuis ${ip} : ${cur.count} tentatives en 1h`;
    logger.warn("[brute-force] alerte déclenchée", { ip, count: cur.count });
    // Sentry (breadcrumb + capture)
    captureMessage(message, {
      level: "warning",
      route: "POST /api/auth/login",
      extra: { ip, count: cur.count, lastEmail: extra?.email },
    });
    // Alerte webhook (Slack / Discord si ALERT_WEBHOOK_URL configuré)
    void sendAlert({
      title: "Brute-force login détecté",
      level: "critical",
      route: "POST /api/auth/login",
      message,
      extra: { ip, count: cur.count, lastEmail: extra?.email },
    });
  }
}

/**
 * À appeler à chaque login RÉUSSI depuis la même IP : reset le compteur.
 * Empêche un utilisateur légitime qui aurait tapé son mdp 5× d'être flag.
 */
export function recordLoginSuccess(ip: string | null): void {
  if (!ip || ip === "unknown") return;
  store.delete(ip);
}

/**
 * Getter pour tests + admin dashboard futur.
 */
export function getFailureCount(ip: string): number {
  return store.get(ip)?.count ?? 0;
}

/**
 * Reset — pour tests uniquement.
 */
export function __resetBruteForceStore(): void {
  store.clear();
}
