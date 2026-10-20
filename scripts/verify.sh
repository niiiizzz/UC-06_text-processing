#!/usr/bin/env bash
set -euo pipefail

# scripts/verify.sh — Verify deployment & run acceptance checks
ENV="dev"
FULL=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --env) ENV="$2"; shift 2 ;;
    --full) FULL=true; shift ;;
    *) echo "Unknown option $1"; exit 1 ;;
  esac
done

echo "[*] Verifying deployment for environment: $ENV"

# 1. Terraform state list contains only the two scored resources
echo "[*] Checking Terraform managed resources..."
cd infra
RESOURCES=$(terraform state list)
echo "$RESOURCES"
COUNT=$(echo "$RESOURCES" | grep -v '^$' | wc -l)
if [[ "$COUNT" -ne 2 ]]; then
  echo "[!] Error: Terraform manages $COUNT resources. Must be exactly 2."
  exit 1
fi

# 2. Terraform plan has no drift (detailed-exitcode == 0)
echo "[*] Checking Terraform plan drift..."
terraform plan -detailed-exitcode -var-file="env/${ENV}.tfvars" -var="image_tag=$(git rev-parse --short HEAD)"
cd ..

# 3. Health check
FQDN=$(cd infra && terraform output -raw fqdn)
BASE_URL="https://${FQDN}"
echo "[*] Checking health at ${BASE_URL}/health..."
HEALTH=$(curl -s "${BASE_URL}/health")
echo "Health response: $HEALTH"
STATUS=$(echo "$HEALTH" | grep -o '"status":"ok"' || true)
if [[ -z "$STATUS" ]]; then
  echo "[!] Health check failed!"
  exit 1
fi
echo "[+] Health check OK."

if [[ "$FULL" == true ]]; then
  echo "[*] Running full acceptance test suite A01-A11 against ${BASE_URL}..."
  BASE_URL="${BASE_URL}" python -m pytest tests/e2e -v
fi

echo "[+] Verification successful."
