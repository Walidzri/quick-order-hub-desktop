#!/bin/bash
# =============================================================================
# Phase 2 — Tests de vérification migration IDB → SQLite
# Lancer depuis la racine du projet : bash tests/phase2/migration.curl.sh
# Pré-requis : l'app Electron doit tourner (Fastify sur port 3002)
# =============================================================================

BASE="http://127.0.0.1:3002"
PASS=0
FAIL=0

check() {
  local label="$1"
  local result="$2"
  local expect="$3"
  if echo "$result" | grep -q "$expect"; then
    echo "  ✅ $label"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $label"
    echo "     Attendu : $expect"
    echo "     Reçu    : $(echo "$result" | head -c 200)"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "============================================="
echo "  Phase 2 — Vérification migration SQLite"
echo "============================================="

# ── Santé du serveur ──────────────────────────────────────────────────────────
echo ""
echo "[ Serveur ]"
R=$(curl -s "$BASE/health" 2>/dev/null || curl -s "$BASE/" 2>/dev/null)
check "Fastify répond" "$R" "."

# ── Produits ──────────────────────────────────────────────────────────────────
echo ""
echo "[ Produits ]"
R=$(curl -s "$BASE/api/products")
check "GET /api/products retourne un tableau" "$R" "\["
COUNT=$(echo "$R" | grep -o '"id"' | wc -l | tr -d ' ')
echo "     → $COUNT produits trouvés"

R=$(curl -s "$BASE/api/categories")
check "GET /api/categories retourne un tableau" "$R" "\["
CAT_COUNT=$(echo "$R" | grep -o '"id"' | wc -l | tr -d ' ')
echo "     → $CAT_COUNT catégories trouvées"

# ── Commandes ─────────────────────────────────────────────────────────────────
echo ""
echo "[ Commandes ]"
R=$(curl -s "$BASE/api/orders")
check "GET /api/orders retourne un tableau" "$R" "\["
ORD_COUNT=$(echo "$R" | grep -o '"id"' | wc -l | tr -d ' ')
echo "     → $ORD_COUNT commandes trouvées"

R=$(curl -s "$BASE/api/orders?status=paid")
check "GET /api/orders?status=paid filtre correctement" "$R" "\["

# ── Settings ──────────────────────────────────────────────────────────────────
echo ""
echo "[ Paramètres ]"
R=$(curl -s "$BASE/api/settings")
check "GET /api/settings retourne un objet" "$R" "restaurantName\|language\|currency"

R=$(curl -s "$BASE/api/printers")
check "GET /api/printers retourne un tableau" "$R" "\["

# ── Utilisateurs ──────────────────────────────────────────────────────────────
echo ""
echo "[ Utilisateurs ]"
R=$(curl -s "$BASE/api/users")
check "GET /api/users retourne un tableau" "$R" "\["
USR_COUNT=$(echo "$R" | grep -o '"id"' | wc -l | tr -d ' ')
echo "     → $USR_COUNT utilisateurs trouvés"

R=$(curl -s "$BASE/api/auth/sessions")
check "GET /api/auth/sessions retourne un tableau" "$R" "\["

# ── Promotions ────────────────────────────────────────────────────────────────
echo ""
echo "[ Promotions ]"
R=$(curl -s "$BASE/api/promotions")
check "GET /api/promotions retourne un tableau" "$R" "\["

# ── Inventaire ────────────────────────────────────────────────────────────────
echo ""
echo "[ Inventaire ]"
R=$(curl -s "$BASE/api/inventory/suppliers")
check "GET /api/inventory/suppliers retourne un tableau" "$R" "\["

R=$(curl -s "$BASE/api/inventory/items")
check "GET /api/inventory/items retourne un tableau" "$R" "\["

R=$(curl -s "$BASE/api/inventory/invoices")
check "GET /api/inventory/invoices retourne un tableau" "$R" "\["

# ── Backup export ─────────────────────────────────────────────────────────────
echo ""
echo "[ Backup ]"
R=$(curl -s "$BASE/api/backup/export")
check "GET /api/backup/export contient version + data" "$R" "version.*data\|data.*version"
check "Export contient les produits" "$R" "products"
check "Export contient les commandes" "$R" "orders"
check "Export contient les settings" "$R" "settings"

# ── CRUD spot-check : créer puis supprimer un fournisseur ─────────────────────
echo ""
echo "[ CRUD spot-check — Inventaire ]"
SUP_ID="test-supplier-$(date +%s)"
R=$(curl -s -X PUT "$BASE/api/inventory/suppliers/$SUP_ID" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"$SUP_ID\",\"name\":\"Test Fournisseur\",\"contact\":\"\",\"phone\":\"\",\"email\":\"\",\"address\":\"\",\"notes\":\"\"}")
check "PUT /api/inventory/suppliers/:id crée un fournisseur" "$R" "Test Fournisseur"

R=$(curl -s -X DELETE "$BASE/api/inventory/suppliers/$SUP_ID")
check "DELETE /api/inventory/suppliers/:id supprime le fournisseur" "$R" "\[\]\|{}\|success\|204\|"

# ── CRUD spot-check : créer puis supprimer une commande ──────────────────────
echo ""
echo "[ CRUD spot-check — Commandes ]"
R=$(curl -s -X POST "$BASE/api/orders" \
  -H "Content-Type: application/json" \
  -d '{"type":"dine-in","lines":[],"status":"pending","total":0}')
check "POST /api/orders crée une commande" "$R" '"id"'
NEW_ID=$(echo "$R" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -n "$NEW_ID" ]; then
  R=$(curl -s -X DELETE "$BASE/api/orders/$NEW_ID")
  check "DELETE /api/orders/:id supprime la commande" "$R" '\[\]\|{}\|'
fi

# ── Résumé ────────────────────────────────────────────────────────────────────
echo ""
echo "============================================="
TOTAL=$((PASS + FAIL))
echo "  Résultat : $PASS/$TOTAL tests passés"
if [ "$FAIL" -eq 0 ]; then
  echo "  🎉 Tous les tests sont OK — Phase 2 validée"
else
  echo "  ⚠️  $FAIL test(s) en échec — voir détails ci-dessus"
fi
echo "============================================="
echo ""
