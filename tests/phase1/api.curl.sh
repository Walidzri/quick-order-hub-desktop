#!/usr/bin/env bash
# =============================================================================
# tests/phase1/api.curl.sh
# Tests curl — Toutes les routes Fastify (Phase 1)
#
# Usage :
#   bash tests/phase1/api.curl.sh
#
# Prérequis :
#   - L'app Electron est lancée (le serveur Fastify tourne sur http://10.8.0.2:3001)
#   - curl et jq sont installés
#     Windows : scoop install curl jq  |  choco install curl jq
#
# En Phase 1, les routes renvoient des stubs (tableaux vides / erreurs 501).
# Le test vérifie que la route répond correctement (pas de 404/500 inattendu).
# =============================================================================

BASE="http://10.8.0.2:3001"
PASS=0
FAIL=0
SKIP=0

# Couleurs (désactivées si pas de terminal)
if [ -t 1 ]; then
  GREEN="\033[0;32m"
  RED="\033[0;31m"
  YELLOW="\033[0;33m"
  CYAN="\033[0;36m"
  RESET="\033[0m"
else
  GREEN="" RED="" YELLOW="" CYAN="" RESET=""
fi

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

check() {
  local label="$1"
  local expected_status="$2"
  local actual_status="$3"
  local body="$4"

  if [ "$actual_status" = "$expected_status" ]; then
    echo -e "${GREEN}✅ PASS${RESET} [$actual_status] $label"
    PASS=$((PASS + 1))
  else
    echo -e "${RED}❌ FAIL${RESET} [$actual_status, expected $expected_status] $label"
    echo "   Body: $(echo "$body" | head -c 200)"
    FAIL=$((FAIL + 1))
  fi
}

req() {
  # req METHOD PATH [BODY]
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local response
  if [ -n "$body" ]; then
    response=$(curl -s -w "\n%{http_code}" -X "$method" \
      -H "Content-Type: application/json" \
      -d "$body" \
      "${BASE}${path}" 2>/dev/null)
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" \
      -H "Content-Type: application/json" \
      "${BASE}${path}" 2>/dev/null)
  fi
  # Dernière ligne = code HTTP, le reste = body
  echo "$response"
}

parse_status() { echo "$1" | tail -1; }
parse_body()   { echo "$1" | head -n -1; }

# ---------------------------------------------------------------------------
# Vérifier que le serveur est joignable
# ---------------------------------------------------------------------------

echo ""
echo -e "${CYAN}============================================================${RESET}"
echo -e "${CYAN}  Tests API Phase 1 — Fastify http://10.8.0.2:3001         ${RESET}"
echo -e "${CYAN}============================================================${RESET}"
echo ""

HEALTH=$(req GET /api/health)
HEALTH_STATUS=$(parse_status "$HEALTH")
if [ "$HEALTH_STATUS" != "200" ]; then
  echo -e "${RED}⛔ Serveur injoignable (GET /api/health → $HEALTH_STATUS)${RESET}"
  echo "   Lancez l'app Electron puis relancez ce script."
  exit 1
fi
echo -e "${GREEN}✅ Serveur joignable${RESET} — GET /api/health → 200"
echo ""

# ---------------------------------------------------------------------------
# /api/health
# ---------------------------------------------------------------------------
echo -e "${CYAN}--- HEALTH ---${RESET}"
R=$(req GET /api/health); check "GET /api/health" "200" "$(parse_status "$R")" "$(parse_body "$R")"

# ---------------------------------------------------------------------------
# /api/orders
# ---------------------------------------------------------------------------
echo ""
echo -e "${CYAN}--- ORDERS ---${RESET}"

R=$(req GET /api/orders)
check "GET /api/orders (tableau ou 501)" "200" "$(parse_status "$R")" "$(parse_body "$R")" || \
check "GET /api/orders (stub 501 ok)" "501" "$(parse_status "$R")" "$(parse_body "$R")"

R=$(req GET /api/orders?status=paid)
S=$(parse_status "$R")
[ "$S" = "200" ] || [ "$S" = "501" ] && { echo -e "${GREEN}✅ PASS${RESET} [$S] GET /api/orders?status=paid"; PASS=$((PASS+1)); } || \
  { echo -e "${RED}❌ FAIL${RESET} [$S] GET /api/orders?status=paid"; FAIL=$((FAIL+1)); }

R=$(req GET /api/orders/nonexistent-id)
S=$(parse_status "$R")
[ "$S" = "404" ] || [ "$S" = "501" ] && { echo -e "${GREEN}✅ PASS${RESET} [$S] GET /api/orders/:id (id inexistant → 404 ou stub 501)"; PASS=$((PASS+1)); } || \
  { echo -e "${RED}❌ FAIL${RESET} [$S] GET /api/orders/:id"; FAIL=$((FAIL+1)); }

R=$(req POST /api/orders '{"type":"dine-in","lines":[]}')
S=$(parse_status "$R")
[ "$S" = "201" ] || [ "$S" = "200" ] || [ "$S" = "501" ] && { echo -e "${GREEN}✅ PASS${RESET} [$S] POST /api/orders"; PASS=$((PASS+1)); } || \
  { echo -e "${RED}❌ FAIL${RESET} [$S] POST /api/orders"; FAIL=$((FAIL+1)); }

R=$(req PATCH /api/orders/test-id '{"status":"paid"}')
S=$(parse_status "$R")
[ "$S" = "200" ] || [ "$S" = "404" ] || [ "$S" = "501" ] && { echo -e "${GREEN}✅ PASS${RESET} [$S] PATCH /api/orders/:id"; PASS=$((PASS+1)); } || \
  { echo -e "${RED}❌ FAIL${RESET} [$S] PATCH /api/orders/:id"; FAIL=$((FAIL+1)); }

R=$(req PATCH /api/orders/test-id/status '{"status":"sentToKitchen"}')
S=$(parse_status "$R")
[ "$S" = "200" ] || [ "$S" = "404" ] || [ "$S" = "501" ] && { echo -e "${GREEN}✅ PASS${RESET} [$S] PATCH /api/orders/:id/status"; PASS=$((PASS+1)); } || \
  { echo -e "${RED}❌ FAIL${RESET} [$S] PATCH /api/orders/:id/status"; FAIL=$((FAIL+1)); }

R=$(req DELETE /api/orders/test-id)
S=$(parse_status "$R")
[ "$S" = "204" ] || [ "$S" = "200" ] || [ "$S" = "404" ] || [ "$S" = "501" ] && { echo -e "${GREEN}✅ PASS${RESET} [$S] DELETE /api/orders/:id"; PASS=$((PASS+1)); } || \
  { echo -e "${RED}❌ FAIL${RESET} [$S] DELETE /api/orders/:id"; FAIL=$((FAIL+1)); }

# ---------------------------------------------------------------------------
# /api/products
# ---------------------------------------------------------------------------
echo ""
echo -e "${CYAN}--- PRODUCTS ---${RESET}"

R=$(req GET /api/products); S=$(parse_status "$R")
[ "$S" = "200" ] || [ "$S" = "501" ] && { echo -e "${GREEN}✅ PASS${RESET} [$S] GET /api/products"; PASS=$((PASS+1)); } || \
  { echo -e "${RED}❌ FAIL${RESET} [$S] GET /api/products"; FAIL=$((FAIL+1)); }

R=$(req GET /api/products/nonexistent); S=$(parse_status "$R")
[ "$S" = "404" ] || [ "$S" = "501" ] && { echo -e "${GREEN}✅ PASS${RESET} [$S] GET /api/products/:id"; PASS=$((PASS+1)); } || \
  { echo -e "${RED}❌ FAIL${RESET} [$S] GET /api/products/:id"; FAIL=$((FAIL+1)); }

R=$(req POST /api/products '{"name":"Test Burger","price":850,"categoryId":"cat-1"}'); S=$(parse_status "$R")
[ "$S" = "201" ] || [ "$S" = "200" ] || [ "$S" = "501" ] && { echo -e "${GREEN}✅ PASS${RESET} [$S] POST /api/products"; PASS=$((PASS+1)); } || \
  { echo -e "${RED}❌ FAIL${RESET} [$S] POST /api/products"; FAIL=$((FAIL+1)); }

R=$(req PATCH /api/products/test-id '{"price":900}'); S=$(parse_status "$R")
[ "$S" = "200" ] || [ "$S" = "404" ] || [ "$S" = "501" ] && { echo -e "${GREEN}✅ PASS${RESET} [$S] PATCH /api/products/:id"; PASS=$((PASS+1)); } || \
  { echo -e "${RED}❌ FAIL${RESET} [$S] PATCH /api/products/:id"; FAIL=$((FAIL+1)); }

R=$(req DELETE /api/products/test-id); S=$(parse_status "$R")
[ "$S" = "204" ] || [ "$S" = "200" ] || [ "$S" = "404" ] || [ "$S" = "501" ] && { echo -e "${GREEN}✅ PASS${RESET} [$S] DELETE /api/products/:id"; PASS=$((PASS+1)); } || \
  { echo -e "${RED}❌ FAIL${RESET} [$S] DELETE /api/products/:id"; FAIL=$((FAIL+1)); }

R=$(req GET /api/products/test-id/variants); S=$(parse_status "$R")
[ "$S" = "200" ] || [ "$S" = "501" ] && { echo -e "${GREEN}✅ PASS${RESET} [$S] GET /api/products/:id/variants"; PASS=$((PASS+1)); } || \
  { echo -e "${RED}❌ FAIL${RESET} [$S] GET /api/products/:id/variants"; FAIL=$((FAIL+1)); }

R=$(req GET /api/modifier-groups); S=$(parse_status "$R")
[ "$S" = "200" ] || [ "$S" = "501" ] && { echo -e "${GREEN}✅ PASS${RESET} [$S] GET /api/modifier-groups"; PASS=$((PASS+1)); } || \
  { echo -e "${RED}❌ FAIL${RESET} [$S] GET /api/modifier-groups"; FAIL=$((FAIL+1)); }

R=$(req GET /api/modifier-options); S=$(parse_status "$R")
[ "$S" = "200" ] || [ "$S" = "501" ] && { echo -e "${GREEN}✅ PASS${RESET} [$S] GET /api/modifier-options"; PASS=$((PASS+1)); } || \
  { echo -e "${RED}❌ FAIL${RESET} [$S] GET /api/modifier-options"; FAIL=$((FAIL+1)); }

# ---------------------------------------------------------------------------
# /api/categories
# ---------------------------------------------------------------------------
echo ""
echo -e "${CYAN}--- CATEGORIES ---${RESET}"

R=$(req GET /api/categories); S=$(parse_status "$R")
[ "$S" = "200" ] || [ "$S" = "501" ] && { echo -e "${GREEN}✅ PASS${RESET} [$S] GET /api/categories"; PASS=$((PASS+1)); } || \
  { echo -e "${RED}❌ FAIL${RESET} [$S] GET /api/categories"; FAIL=$((FAIL+1)); }

R=$(req GET /api/categories/nonexistent); S=$(parse_status "$R")
[ "$S" = "404" ] || [ "$S" = "501" ] && { echo -e "${GREEN}✅ PASS${RESET} [$S] GET /api/categories/:id"; PASS=$((PASS+1)); } || \
  { echo -e "${RED}❌ FAIL${RESET} [$S] GET /api/categories/:id"; FAIL=$((FAIL+1)); }

R=$(req POST /api/categories '{"name":"Burgers","sortOrder":1}'); S=$(parse_status "$R")
[ "$S" = "201" ] || [ "$S" = "200" ] || [ "$S" = "501" ] && { echo -e "${GREEN}✅ PASS${RESET} [$S] POST /api/categories"; PASS=$((PASS+1)); } || \
  { echo -e "${RED}❌ FAIL${RESET} [$S] POST /api/categories"; FAIL=$((FAIL+1)); }

R=$(req PATCH /api/categories/test-id '{"name":"Burgers XL"}'); S=$(parse_status "$R")
[ "$S" = "200" ] || [ "$S" = "404" ] || [ "$S" = "501" ] && { echo -e "${GREEN}✅ PASS${RESET} [$S] PATCH /api/categories/:id"; PASS=$((PASS+1)); } || \
  { echo -e "${RED}❌ FAIL${RESET} [$S] PATCH /api/categories/:id"; FAIL=$((FAIL+1)); }

R=$(req DELETE /api/categories/test-id); S=$(parse_status "$R")
[ "$S" = "204" ] || [ "$S" = "200" ] || [ "$S" = "404" ] || [ "$S" = "501" ] && { echo -e "${GREEN}✅ PASS${RESET} [$S] DELETE /api/categories/:id"; PASS=$((PASS+1)); } || \
  { echo -e "${RED}❌ FAIL${RESET} [$S] DELETE /api/categories/:id"; FAIL=$((FAIL+1)); }

# ---------------------------------------------------------------------------
# /api/settings + /api/printers
# ---------------------------------------------------------------------------
echo ""
echo -e "${CYAN}--- SETTINGS & PRINTERS ---${RESET}"

R=$(req GET /api/settings); S=$(parse_status "$R")
[ "$S" = "200" ] || [ "$S" = "501" ] && { echo -e "${GREEN}✅ PASS${RESET} [$S] GET /api/settings"; PASS=$((PASS+1)); } || \
  { echo -e "${RED}❌ FAIL${RESET} [$S] GET /api/settings"; FAIL=$((FAIL+1)); }

R=$(req PATCH /api/settings '{"language":"fr-FR"}'); S=$(parse_status "$R")
[ "$S" = "200" ] || [ "$S" = "501" ] && { echo -e "${GREEN}✅ PASS${RESET} [$S] PATCH /api/settings"; PASS=$((PASS+1)); } || \
  { echo -e "${RED}❌ FAIL${RESET} [$S] PATCH /api/settings"; FAIL=$((FAIL+1)); }

R=$(req GET /api/printers); S=$(parse_status "$R")
[ "$S" = "200" ] || [ "$S" = "501" ] && { echo -e "${GREEN}✅ PASS${RESET} [$S] GET /api/printers"; PASS=$((PASS+1)); } || \
  { echo -e "${RED}❌ FAIL${RESET} [$S] GET /api/printers"; FAIL=$((FAIL+1)); }

R=$(req PUT /api/printers/test-printer '{"id":"test-printer","name":"Caisse","host":"192.168.1.100","port":9100,"role":"cashier","connectionType":"network","enabled":true}'); S=$(parse_status "$R")
[ "$S" = "200" ] || [ "$S" = "201" ] || [ "$S" = "501" ] && { echo -e "${GREEN}✅ PASS${RESET} [$S] PUT /api/printers/:id"; PASS=$((PASS+1)); } || \
  { echo -e "${RED}❌ FAIL${RESET} [$S] PUT /api/printers/:id"; FAIL=$((FAIL+1)); }

R=$(req DELETE /api/printers/test-printer); S=$(parse_status "$R")
[ "$S" = "204" ] || [ "$S" = "200" ] || [ "$S" = "404" ] || [ "$S" = "501" ] && { echo -e "${GREEN}✅ PASS${RESET} [$S] DELETE /api/printers/:id"; PASS=$((PASS+1)); } || \
  { echo -e "${RED}❌ FAIL${RESET} [$S] DELETE /api/printers/:id"; FAIL=$((FAIL+1)); }

# ---------------------------------------------------------------------------
# /api/print
# ---------------------------------------------------------------------------
echo ""
echo -e "${CYAN}--- PRINT ---${RESET}"

ORDER_STUB='{"id":"test-order","orderNumber":"#001","status":"paid","type":"dine-in","lines":[],"subtotal":0,"discount":0,"total":0,"createdAt":"2024-01-01T00:00:00Z","updatedAt":"2024-01-01T00:00:00Z"}'
PRINTER_STUB='{"id":"test-printer","name":"Caisse","host":"10.8.0.2","port":9100,"role":"cashier","connectionType":"network","enabled":true}'

R=$(req POST /api/print/receipt "{\"order\":$ORDER_STUB,\"printer\":$PRINTER_STUB}"); S=$(parse_status "$R")
[ "$S" = "200" ] || [ "$S" = "501" ] || [ "$S" = "503" ] && { echo -e "${GREEN}✅ PASS${RESET} [$S] POST /api/print/receipt"; PASS=$((PASS+1)); } || \
  { echo -e "${RED}❌ FAIL${RESET} [$S] POST /api/print/receipt"; FAIL=$((FAIL+1)); }

R=$(req POST /api/print/kitchen "{\"order\":$ORDER_STUB,\"printer\":$PRINTER_STUB}"); S=$(parse_status "$R")
[ "$S" = "200" ] || [ "$S" = "501" ] || [ "$S" = "503" ] && { echo -e "${GREEN}✅ PASS${RESET} [$S] POST /api/print/kitchen"; PASS=$((PASS+1)); } || \
  { echo -e "${RED}❌ FAIL${RESET} [$S] POST /api/print/kitchen"; FAIL=$((FAIL+1)); }

R=$(req POST /api/print/drawer "{\"printer\":$PRINTER_STUB}"); S=$(parse_status "$R")
[ "$S" = "200" ] || [ "$S" = "501" ] || [ "$S" = "503" ] && { echo -e "${GREEN}✅ PASS${RESET} [$S] POST /api/print/drawer"; PASS=$((PASS+1)); } || \
  { echo -e "${RED}❌ FAIL${RESET} [$S] POST /api/print/drawer"; FAIL=$((FAIL+1)); }

R=$(req GET "/api/print/test?host=10.8.0.2&port=9100"); S=$(parse_status "$R")
[ "$S" = "200" ] || [ "$S" = "501" ] && { echo -e "${GREEN}✅ PASS${RESET} [$S] GET /api/print/test"; PASS=$((PASS+1)); } || \
  { echo -e "${RED}❌ FAIL${RESET} [$S] GET /api/print/test"; FAIL=$((FAIL+1)); }

# ---------------------------------------------------------------------------
# Résumé
# ---------------------------------------------------------------------------
TOTAL=$((PASS + FAIL + SKIP))
echo ""
echo -e "${CYAN}============================================================${RESET}"
echo -e "  Résultats : ${GREEN}$PASS PASS${RESET} / ${RED}$FAIL FAIL${RESET} / ${YELLOW}$SKIP SKIP${RESET} (total: $TOTAL)"
echo -e "${CYAN}============================================================${RESET}"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "${YELLOW}Note Phase 1 :${RESET} Les routes en stub renvoient 501 — c'est attendu."
  echo "  Un FAIL réel = route absente (404) ou crash serveur (500)."
  echo ""
  exit 1
fi

exit 0
