# Parâmetros NÃO-secretos criados pelo Terraform (endpoints/ids derivados da
# própria infra). Os SECRETOS (DATABASE_URL com senha, etc.) são criados à MÃO:
#
#   aws ssm put-parameter --name /painel/monitoramento/DATABASE_URL \
#     --type SecureString --value "postgres://painel_app:SENHA@ENDPOINT:5432/painel"
#
# fetch-env.sh na EC2 materializa tudo de /painel/monitoramento/* no .env.
resource "aws_ssm_parameter" "config" {
  for_each = {
    AWS_REGION           = var.region
    S3_BUCKET            = aws_s3_bucket.files.bucket
    COGNITO_USER_POOL_ID = aws_cognito_user_pool.main.id
    COGNITO_CLIENT_ID    = aws_cognito_user_pool_client.web.id
    AUTH_MODE            = "cognito"
    PG_POOL_MAX          = "8"
    NODE_ENV             = "production"
  }

  name  = "/painel/monitoramento/${each.key}"
  type  = "String"
  value = each.value
}
