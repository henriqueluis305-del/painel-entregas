# Repositórios das imagens Docker (web + worker; financeiro entra depois).
resource "aws_ecr_repository" "repos" {
  for_each = toset(["painel-monitoramento", "painel-worker"])

  name                 = each.value
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration { scan_on_push = true }
}

# guarda as últimas 10 imagens (rollback) e expira o resto
resource "aws_ecr_lifecycle_policy" "repos" {
  for_each   = aws_ecr_repository.repos
  repository = each.value.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "manter ultimas 10"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}
