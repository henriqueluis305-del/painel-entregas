#!/usr/bin/env bash
# Deploy na EC2: login no ECR → pull das imagens → migrations → sobe containers.
# Roda NA INSTÂNCIA (via SSM Run Command ou SSH). Pré-requisitos: docker,
# docker compose, AWS CLI com IAM Role da instância.
#
# Uso: ./deploy.sh <tag>        (ex.: ./deploy.sh v2026.07.01 | latest)
set -euo pipefail

TAG="${1:?informe a tag da imagem (ex.: latest)}"
REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export ECR_REGISTRY="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
export TAG

cd "$(dirname "$0")/.."   # infra/

echo "== login ECR =="
aws ecr get-login-password --region "$REGION" \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"

echo "== pull imagens ($TAG) =="
docker compose pull

echo "== migrations (antes de subir a versão nova) =="
docker compose run --rm worker node scripts/migrate.mjs

echo "== subindo containers =="
docker compose up -d

echo "== limpando imagens antigas =="
docker image prune -f

echo "Deploy $TAG concluído."
