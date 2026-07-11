#!/usr/bin/env bash
#
# Lot 39 — Wrapper d'application des migrations SQL Vitrix.
#
# Usage :
#   ./sql/apply.sh                          # utilise $DATABASE_URL de l'env
#   ./sql/apply.sh <connection-string>      # override explicite
#   DRY_RUN=1 ./sql/apply.sh                # dry-run (pas d'écriture DB)
#
# Ce script :
#  1. Vérifie que psql est installé
#  2. Ping la DB pour valider la connexion (SELECT 1)
#  3. Affiche le nombre d'INSTRUCTIONS SQL du fichier
#  4. Demande confirmation interactive (sauf si --yes ou CI)
#  5. Applique 00_apply_safe.sql (100% idempotent, safe à rejouer)
#  6. Vérifie post-migration : compte les tables Vitrix (~35 attendues)
#
# Le fichier .sql est idempotent : chaque bloc est wrappé DO $$ BEGIN … END $$
# avec IF NOT EXISTS + helper __vx_table_exists. Aucun risque de perte de données.

set -euo pipefail

# -----------------------------------------------------------------------------
# Config
# -----------------------------------------------------------------------------

SQL_FILE="$(dirname "$0")/00_apply_safe.sql"
DB_URL="${1:-${DATABASE_URL:-}}"
DRY_RUN="${DRY_RUN:-0}"
AUTO_YES="${AUTO_YES:-${CI:-0}}"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# -----------------------------------------------------------------------------
# Checks pré-vol
# -----------------------------------------------------------------------------

echo -e "${BOLD}${CYAN}=== Vitrix — Application des migrations SQL ===${NC}"
echo ""

if ! command -v psql >/dev/null 2>&1; then
  echo -e "${RED}✗ psql non installé${NC}"
  echo "  Installer : brew install postgresql-client (macOS)"
  echo "              apt-get install postgresql-client (Debian/Ubuntu)"
  exit 1
fi

if [ -z "$DB_URL" ]; then
  echo -e "${RED}✗ DATABASE_URL non défini${NC}"
  echo "  Usage : $0 <connection-string>"
  echo "  Ou    : export DATABASE_URL=... && $0"
  exit 1
fi

if [ ! -f "$SQL_FILE" ]; then
  echo -e "${RED}✗ Fichier introuvable : $SQL_FILE${NC}"
  exit 1
fi

# Ping DB
echo -n "→ Test connexion DB... "
if psql "$DB_URL" -c "SELECT 1" >/dev/null 2>&1; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${RED}FAIL${NC}"
  echo "  Vérifiez la connection string et que la DB accepte les connexions."
  exit 1
fi

# Stats
SQL_LINES=$(wc -l < "$SQL_FILE" | tr -d ' ')
DO_BLOCKS=$(grep -c "^DO \$\$" "$SQL_FILE" || true)
CREATE_TABLES=$(grep -c "CREATE TABLE IF NOT EXISTS" "$SQL_FILE" || true)
CREATE_INDEXES=$(grep -c "CREATE.*INDEX IF NOT EXISTS" "$SQL_FILE" || true)
ALTER_TABLES=$(grep -c "ALTER TABLE" "$SQL_FILE" || true)

echo ""
echo -e "${BOLD}→ Fichier${NC} : $SQL_FILE"
echo "  Lignes           : $SQL_LINES"
echo "  Blocs DO"' $$'"       : $DO_BLOCKS"
echo "  CREATE TABLE IF  : $CREATE_TABLES"
echo "  CREATE INDEX IF  : $CREATE_INDEXES"
echo "  ALTER TABLE      : $ALTER_TABLES"
echo ""
echo -e "${YELLOW}⚠${NC}  Le script est ${BOLD}IDEMPOTENT${NC} — safe à rejouer sur une DB déjà partielle."
echo -e "${YELLOW}⚠${NC}  Aucune destruction de données (uniquement ADD COLUMN IF NOT EXISTS,"
echo "    CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS)."
echo ""

# -----------------------------------------------------------------------------
# Confirmation
# -----------------------------------------------------------------------------

if [ "$DRY_RUN" = "1" ]; then
  echo -e "${CYAN}[DRY RUN]${NC} Rien ne sera appliqué. Sortie."
  exit 0
fi

if [ "$AUTO_YES" != "1" ] && [ -t 0 ]; then
  read -r -p "Appliquer ces migrations sur la DB ? [o/N] " response
  if [[ ! "$response" =~ ^([oO][uU][iI]|[oO]|[yY][eE][sS]|[yY])$ ]]; then
    echo "Annulé."
    exit 0
  fi
fi

# -----------------------------------------------------------------------------
# Application
# -----------------------------------------------------------------------------

echo ""
echo -e "${BOLD}→ Application en cours...${NC}"
echo ""

START_TIME=$(date +%s)

if psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$SQL_FILE"; then
  END_TIME=$(date +%s)
  DURATION=$((END_TIME - START_TIME))
  echo ""
  echo -e "${GREEN}${BOLD}✓ Migrations appliquées en ${DURATION}s${NC}"
else
  echo ""
  echo -e "${RED}${BOLD}✗ Erreur pendant l'application${NC}"
  echo "  Consulter les messages ci-dessus. Le script s'arrête à la 1re erreur (ON_ERROR_STOP)."
  exit 1
fi

# -----------------------------------------------------------------------------
# Vérification post-migration
# -----------------------------------------------------------------------------

echo ""
echo -e "${BOLD}→ Vérification post-migration${NC}"
TABLE_COUNT=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public'" | tr -d ' ')
echo "  Tables publiques : $TABLE_COUNT (attendu ~35)"

# Liste les tables critiques Vitrix
echo ""
echo "  Tables critiques présentes :"
for tbl in users businesses appointments quotes payments clients \
           team_members team_invitations calendar_tokens \
           client_sessions notification_preferences \
           stripe_webhook_events unavailabilities; do
  if psql "$DB_URL" -t -c "SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='$tbl'" | grep -q 1; then
    echo -e "    ${GREEN}✓${NC} $tbl"
  else
    echo -e "    ${RED}✗${NC} $tbl (MANQUANTE)"
  fi
done

echo ""
echo -e "${GREEN}${BOLD}✓ Terminé${NC}"
echo ""
echo "  Prochaines étapes :"
echo "  1. Redémarrer votre app (Vercel redeploy ou npm run dev)"
echo "  2. Vérifier /api/health → tous les checks critical à ok:true"
echo "  3. Créer un compte de test sur /register"
