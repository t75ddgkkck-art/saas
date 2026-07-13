#!/usr/bin/env node
/**
 * Lot 39 — Script env-check pré-boot.
 *
 * Vérifie que les variables d'environnement REQUISES sont présentes AVANT
 * de démarrer l'app. Sortie exit code != 0 → Vercel/Docker abandonne le
 * deploy (fail-fast plutôt que découvrir en prod que RESEND_API_KEY manque).
 *
 * Usage local :
 *   node scripts/env-check.mjs                    # vérifie process.env
 *   node scripts/env-check.mjs .env.local         # vérifie un fichier
 *
 * Usage CI/Vercel (pré-build) :
 *   Ajouter à `package.json` "prebuild": "node scripts/env-check.mjs" si voulu.
 *
 * Design volontairement en .mjs pur (pas de TS/deps) → tourne SANS npm install,
 * utile en pre-hook Docker ou Vercel build phase 0.
 */

import fs from "node:fs";
import path from "node:path";

// -----------------------------------------------------------------------------
// Définition des vars requises / recommandées / optionnelles
// -----------------------------------------------------------------------------

const REQUIRED = [
  {
    key: "NEXT_PUBLIC_APP_URL",
    check: (v) => /^https?:\/\/[^\s/]+$/.test(v),
    hint: "URL publique SANS trailing slash, ex : https://www.vitrix.fr",
  },
  {
    key: "DATABASE_URL",
    check: (v) => v.startsWith("postgres"),
    hint: "Doit commencer par postgresql:// ou postgres://",
  },
  {
    key: "NEXTAUTH_SECRET",
    check: (v) => v.length >= 32,
    hint: "Minimum 32 chars — génère avec `openssl rand -base64 32`",
  },
  {
    key: "CRON_SECRET",
    check: (v) => v.length >= 16,
    hint: "Minimum 16 chars — génère avec `openssl rand -hex 32`",
  },
];

const RECOMMENDED = [
  {
    key: "STRIPE_SECRET_KEY",
    check: (v) => v.startsWith("sk_"),
    hint: "Clé secrète Stripe (sk_test_... ou sk_live_...) — sans ça les abonnements ne fonctionnent pas",
  },
  {
    key: "STRIPE_WEBHOOK_SECRET",
    check: (v) => v.startsWith("whsec_"),
    hint: "Whsec_... — sans ça les webhooks Stripe sont rejetés",
  },
  {
    key: "RESEND_API_KEY",
    check: (v) => v.startsWith("re_"),
    hint: "Clé API Resend (re_...) — sans ça AUCUN email transactionnel n'est envoyé",
  },
  {
    key: "RESEND_FROM_EMAIL",
    check: (v) => /.+@.+\..+/.test(v),
    hint: "Email expéditeur — DOIT être un domaine vérifié DKIM dans Resend",
  },
];

const OPTIONAL_FEATURES = [
  { key: "OPENAI_API_KEY", feature: "IA (assistant chat, devis IA, blog IA)" },
  { key: "VAPID_PUBLIC_KEY", feature: "Push notifications OS" },
  { key: "TURNSTILE_SECRET_KEY", feature: "Captcha (protection brute-force renforcée)" },
  { key: "GOOGLE_CLIENT_ID", feature: "Google Calendar sync + Google Business Profile" },
  { key: "SUPABASE_SERVICE_ROLE_KEY", feature: "Upload fichiers (photos vitrine, PJ devis)" },
  { key: "TWILIO_ACCOUNT_SID", feature: "SMS + WhatsApp (rappels RDV)" },
  { key: "SENTRY_DSN", feature: "Monitoring erreurs (Sentry)" },
  { key: "ALERT_WEBHOOK_URL", feature: "Alertes critiques (Slack/Discord/Teams)" },
  { key: "NEXT_PUBLIC_CRISP_ID", feature: "Widget support visiteur (Crisp)" },
];

// -----------------------------------------------------------------------------
// Chargement optionnel d'un .env file
// -----------------------------------------------------------------------------

function loadEnvFile(filepath) {
  if (!fs.existsSync(filepath)) return;
  const content = fs.readFileSync(filepath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    // Ne remplace pas si déjà défini dans process.env
    if (process.env[key] !== undefined) continue;
    // Enlève les quotes optionnels + trim
    const value = rawValue.replace(/^["']|["']$/g, "").trim();
    process.env[key] = value;
  }
}

const arg = process.argv[2];
if (arg) {
  const resolved = path.resolve(process.cwd(), arg);
  loadEnvFile(resolved);
} else {
  // Charge .env.local par défaut si présent (dev)
  loadEnvFile(path.resolve(process.cwd(), ".env.local"));
}

// -----------------------------------------------------------------------------
// Exécution
// -----------------------------------------------------------------------------

const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";

let hasError = false;
let hasWarning = false;

console.log(
  `\n${BOLD}${CYAN}=== Vitrix — Vérification des variables d'environnement ===${RESET}\n`
);

// 1. REQUIRED
console.log(`${BOLD}[1] Requises${RESET}`);
for (const item of REQUIRED) {
  const value = process.env[item.key];
  if (!value) {
    console.log(`  ${RED}✗ ${item.key}${RESET} — MANQUANTE`);
    console.log(`    ${item.hint}`);
    hasError = true;
  } else if (!item.check(value)) {
    console.log(`  ${RED}✗ ${item.key}${RESET} — INVALIDE`);
    console.log(`    ${item.hint}`);
    hasError = true;
  } else {
    console.log(`  ${GREEN}✓ ${item.key}${RESET}`);
  }
}

// 2. RECOMMENDED
console.log(`\n${BOLD}[2] Recommandées${RESET} (features majeures désactivées sinon)`);
for (const item of RECOMMENDED) {
  const value = process.env[item.key];
  if (!value) {
    console.log(`  ${YELLOW}⚠ ${item.key}${RESET} — manquante`);
    console.log(`    ${item.hint}`);
    hasWarning = true;
  } else if (!item.check(value)) {
    console.log(`  ${YELLOW}⚠ ${item.key}${RESET} — format inattendu`);
    console.log(`    ${item.hint}`);
    hasWarning = true;
  } else {
    console.log(`  ${GREEN}✓ ${item.key}${RESET}`);
  }
}

// 3. OPTIONAL FEATURES — juste informatif
console.log(`\n${BOLD}[3] Features optionnelles${RESET} (statut à titre indicatif)`);
for (const item of OPTIONAL_FEATURES) {
  const enabled = Boolean(process.env[item.key]);
  const icon = enabled ? `${GREEN}✓${RESET}` : `${CYAN}·${RESET}`;
  const label = enabled ? "activée" : "désactivée";
  console.log(`  ${icon} ${item.feature} → ${label}`);
}

// -----------------------------------------------------------------------------
// Verdict
// -----------------------------------------------------------------------------

console.log("");
if (hasError) {
  console.log(
    `${RED}${BOLD}✗ Configuration incomplète — corrigez les REQUISES avant de démarrer.${RESET}\n`
  );
  process.exit(1);
}
if (hasWarning) {
  console.log(
    `${YELLOW}${BOLD}⚠ Configuration minimale OK, mais des features majeures sont désactivées.${RESET}`
  );
  console.log(
    `${YELLOW}   L'app démarrera mais les paiements/emails ne fonctionneront pas.${RESET}\n`
  );
  // On ne fail PAS sur les warnings — l'app peut tourner en mode dégradé (dev)
  process.exit(0);
}
console.log(
  `${GREEN}${BOLD}✓ Toutes les variables requises et recommandées sont OK — vous pouvez déployer.${RESET}\n`
);
process.exit(0);
