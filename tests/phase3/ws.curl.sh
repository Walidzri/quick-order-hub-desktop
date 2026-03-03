#!/bin/bash
# =============================================================================
# Phase 3 — Tests WebSocket + tablette cuisine + télé salle
# Lancer depuis la racine du projet : bash tests/phase3/ws.curl.sh
# Pré-requis : l'app Electron doit tourner (Fastify sur port 3002)
# Pré-requis : wscat installé pour les tests WebSocket (npm i -g wscat)
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
echo "  Phase 3 — Tests WebSocket + Pages salle"
echo "============================================="

# ── Pages HTML servies ────────────────────────────────────────────────────────
echo ""
echo "[ Pages HTML ]"

R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/cuisine")
if [ "$R" = "200" ]; then
  echo "  ✅ GET /cuisine → 200"
  PASS=$((PASS + 1))
else
  echo "  ❌ GET /cuisine → $R (attendu 200)"
  FAIL=$((FAIL + 1))
fi

R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/display")
if [ "$R" = "200" ]; then
  echo "  ✅ GET /display → 200"
  PASS=$((PASS + 1))
else
  echo "  ❌ GET /display → $R (attendu 200)"
  FAIL=$((FAIL + 1))
fi

R=$(curl -s "$BASE/cuisine")
check "Page /cuisine contient 'ws/events'" "$R" "ws/events"
check "Page /cuisine contient 'sentToKitchen'" "$R" "sentToKitchen"
check "Page /cuisine contient 'markReady'" "$R" "markReady"

R=$(curl -s "$BASE/display")
check "Page /display contient 'ws/events'" "$R" "ws/events"
check "Page /display contient statut 'ready'" "$R" "ready"

# ── Endpoint statut WebSocket ─────────────────────────────────────────────────
echo ""
echo "[ WebSocket status ]"
R=$(curl -s "$BASE/api/ws/status")
check "GET /api/ws/status retourne clients" "$R" "clients"

# ── Statut ready dans les ordres ──────────────────────────────────────────────
echo ""
echo "[ Statut 'ready' ]"

# Créer une commande de test
R=$(curl -s -X POST "$BASE/api/orders" \
  -H "Content-Type: application/json" \
  -d '{"type":"dine-in","lines":[],"status":"draft","total":0}')
check "POST /api/orders crée une commande" "$R" '"id"'
ORDER_ID=$(echo "$R" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$ORDER_ID" ]; then
  echo "     → Commande créée : $ORDER_ID"

  # Envoyer en cuisine
  R=$(curl -s -X POST "$BASE/api/orders/$ORDER_ID/send-to-kitchen")
  check "POST /send-to-kitchen → statut sentToKitchen" "$R" "sentToKitchen"

  # Marquer comme prête
  R=$(curl -s -X PATCH "$BASE/api/orders/$ORDER_ID/status" \
    -H "Content-Type: application/json" \
    -d '{"status":"ready"}')
  check "PATCH status → ready accepté" "$R" '"ready"'

  # Vérifier que la commande est bien en statut ready
  R=$(curl -s "$BASE/api/orders/$ORDER_ID")
  check "GET /api/orders/:id → statut ready persisté" "$R" '"ready"'

  # Cleanup — supprimer la commande de test
  curl -s -X DELETE "$BASE/api/orders/$ORDER_ID" > /dev/null
  echo "     → Commande de test supprimée"
else
  echo "  ⚠️  Impossible de créer la commande de test — skip tests statut ready"
  FAIL=$((FAIL + 3))
fi

# ── Test WebSocket (nécessite wscat) ──────────────────────────────────────────
echo ""
echo "[ WebSocket — connexion ]"

if command -v wscat &> /dev/null; then
  # Connexion + attente du message "connected" pendant 2s
  WS_MSG=$(echo "" | timeout 2 wscat -c "ws://127.0.0.1:3002/ws/events" 2>/dev/null | head -1)
  check "WebSocket /ws/events répond avec 'connected'" "$WS_MSG" "connected"
else
  echo "  ⚠️  wscat non installé — test WebSocket skippé"
  echo "     Installer avec : npm install -g wscat"
  echo "     Puis relancer ce script"
fi

# ── Test flux complet : create → sentToKitchen → ready ───────────────────────
echo ""
echo "[ Flux complet cuisine ]"

# Créer commande + envoyer en cuisine + marquer prête
R=$(curl -s -X POST "$BASE/api/orders" \
  -H "Content-Type: application/json" \
  -d '{"type":"takeaway","lines":[{"id":"l1","productName":"Test Burger","quantity":2,"unitPrice":500,"modifiers":[],"isManual":false}],"status":"draft","total":1000}')
ORDER_ID2=$(echo "$R" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$ORDER_ID2" ]; then
  curl -s -X POST "$BASE/api/orders/$ORDER_ID2/send-to-kitchen" > /dev/null
  R=$(curl -s -X PATCH "$BASE/api/orders/$ORDER_ID2/status" \
    -H "Content-Type: application/json" \
    -d '{"status":"ready"}')
  check "Flux complet draft→sentToKitchen→ready" "$R" '"ready"'

  # Simuler récupération (marquer payé)
  R=$(curl -s -X POST "$BASE/api/orders/$ORDER_ID2/mark-paid" \
    -H "Content-Type: application/json" \
    -d '{"paymentMethod":"cash"}')
  check "Marquer payé depuis état ready" "$R" '"paid"'

  curl -s -X DELETE "$BASE/api/orders/$ORDER_ID2" > /dev/null
fi

# ── Résumé ────────────────────────────────────────────────────────────────────
echo ""
echo "============================================="
TOTAL=$((PASS + FAIL))
echo "  Résultat : $PASS/$TOTAL tests passés"
if [ "$FAIL" -eq 0 ]; then
  echo "  🎉 Tous les tests sont OK — Phase 3 validée (curl)"
else
  echo "  ⚠️  $FAIL test(s) en échec — voir détails ci-dessus"
fi
echo "============================================="
echo ""
echo "  Étape suivante : valider manuellement tests/phase3/checklist.md"
echo "  sur une vraie tablette / Smart TV sur le réseau local."
echo ""
