#!/usr/bin/env bash
set -euo pipefail

# scripts/cleanup.sh — Cleanup team-managed resources
# NON-NEGOTIABLE: Requires explicit confirmation before destruction

echo "=========================================================="
echo "WARNING: This script will destroy Container App and Storage Container"
echo "=========================================================="
read -p "Type 'DESTROY' to proceed: " CONFIRM

if [[ "$CONFIRM" != "DESTROY" ]]; then
  echo "Aborted."
  exit 0
fi

cd infra
terraform destroy -auto-approve -var-file="env/dev.tfvars" -var="image_tag=cleanup"
echo "[+] Cleanup complete."
