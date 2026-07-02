#!/usr/bin/env bash
# Materializa o .env.monitoramento a partir do SSM Parameter Store (AD-09:
# segredo nunca no Git nem na AMI — só na instância, na hora do deploy).
#
# Convenção de caminho: /painel/monitoramento/<NOME_DA_VARIAVEL>
# Uso: ./fetch-env.sh   (na EC2, com IAM Role com ssm:GetParametersByPath)
set -euo pipefail

PREFIX="/painel/monitoramento"
OUT="$(dirname "$0")/../.env.monitoramento"

aws ssm get-parameters-by-path \
  --path "$PREFIX" \
  --with-decryption \
  --query "Parameters[*].[Name,Value]" \
  --output text \
| while IFS=$'\t' read -r name value; do
    echo "${name##*/}=${value}"
  done > "$OUT"

chmod 600 "$OUT"
echo "Gerado $OUT ($(wc -l < "$OUT") variáveis)."
