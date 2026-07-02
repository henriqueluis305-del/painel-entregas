# Cognito User Pool — identidade (login/senha). Perfis/permissões ficam na
# app_user do Postgres; grupos aqui são a camada grossa (admin/financeiro/etc.).
resource "aws_cognito_user_pool" "main" {
  name = "${var.project}-users"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = false
    require_numbers   = false
    require_symbols   = false
    require_uppercase = false
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # cadastro é feito pelo app (server action) — não pelo Hosted UI
  admin_create_user_config {
    allow_admin_create_user_only = true
  }
}

resource "aws_cognito_user_pool_client" "web" {
  name         = "${var.project}-web"
  user_pool_id = aws_cognito_user_pool.main.id

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH", # login e-mail/senha via server action
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  generate_secret               = false
  prevent_user_existence_errors = "ENABLED"

  access_token_validity  = 1  # horas
  id_token_validity      = 1  # horas
  refresh_token_validity = 30 # dias
}

resource "aws_cognito_user_group" "groups" {
  for_each = toset([
    "admin",
    "gestor_monitoramento",
    "operador_monitoramento",
    "financeiro",
    "leitura_auditoria",
  ])
  name         = each.value
  user_pool_id = aws_cognito_user_pool.main.id
}
