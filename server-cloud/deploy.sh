#!/bin/bash
set -e

VPS_HOST=wathmani_hetzner_vps_vpn
VPS_DIR=~/project/quick-order-hub-desktop/server-cloud

echo "→ Push local..."
git push

echo "→ Pull + rebuild VPS..."
ssh $VPS_HOST "cd $VPS_DIR && git pull && docker compose up -d --build"

echo "✓ Déployé"
