output "ec2_public_ip" {
  value       = aws_eip.app.public_ip
  description = "IP fixo da EC2 — aponte o DNS (Route 53/registrador) pra cá"
}

output "rds_endpoint" {
  value       = aws_db_instance.main.address
  description = "Host do Postgres (privado — só acessível da EC2)"
}

output "s3_bucket" {
  value = aws_s3_bucket.files.bucket
}

output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.main.id
}

output "cognito_client_id" {
  value = aws_cognito_user_pool_client.web.id
}

output "ecr_repository_urls" {
  value = { for k, r in aws_ecr_repository.repos : k => r.repository_url }
}
