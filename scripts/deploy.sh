#!/usr/bin/env bash
set -euo pipefail

# scripts/deploy.sh — Deploy Lathe to Azure sandbox
ENV="dev"
while [[ $# -gt 0 ]]; do
  case $1 in
    --env) ENV="$2"; shift 2 ;;
    *) echo "Unknown option $1"; exit 1 ;;
  esac
done

if [[ "$ENV" != "dev" ]]; then
  echo "[!] Only dev environment is permitted for deployment."
  exit 1
fi

echo "[*] Starting deployment for environment: $ENV"

# 1. Image tag from git
IMAGE_TAG=$(git rev-parse --short HEAD)
echo "[*] Image tag: $IMAGE_TAG"

# 2. Build and push image via az acr build
ACR_NAME=$(grep 'acr_name' "infra/env/${ENV}.tfvars" | cut -d'=' -f2 | tr -d ' "')
echo "[*] Building container image in ACR: $ACR_NAME..."
az acr build --registry "$ACR_NAME" --image "lathe:${IMAGE_TAG}" .

# 3. Apply migrations
echo "[*] Applying database migrations..."
python scripts/migrate.py

# 4. Terraform apply (managing only the two scored resources)
echo "[*] Initializing and applying Terraform..."
cd infra
terraform init -upgrade
terraform validate
terraform apply -auto-approve -var-file="env/${ENV}.tfvars" -var="image_tag=${IMAGE_TAG}"

FQDN=$(terraform output -raw fqdn)
echo "=========================================================="
echo "Deployment Succeeded!"
echo "FQDN: https://${FQDN}"
echo "Image Tag: ${IMAGE_TAG}"
echo "=========================================================="
