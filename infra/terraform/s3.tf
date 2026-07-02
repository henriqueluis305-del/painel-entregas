# Bucket privado de arquivos (planilhas/exports). Sem "bucket de frontend" —
# o app é dinâmico e roda na EC2 (AD-03).
resource "aws_s3_bucket" "files" {
  bucket = "${var.project}-arquivos-${var.environment}"
}

resource "aws_s3_bucket_public_access_block" "files" {
  bucket                  = aws_s3_bucket.files.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "files" {
  bucket = aws_s3_bucket.files.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "files" {
  bucket = aws_s3_bucket.files.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "aws:kms" }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "files" {
  bucket = aws_s3_bucket.files.id
  rule {
    id     = "uploads-antigos-pra-classe-fria"
    status = "Enabled"
    filter { prefix = "uploads/" }
    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }
  }
}

# CORS pro upload direto do browser via presigned URL
resource "aws_s3_bucket_cors_configuration" "files" {
  bucket = aws_s3_bucket.files.id
  cors_rule {
    allowed_methods = ["PUT", "GET"]
    allowed_origins = ["https://*.SEUDOMINIO.com.br"] # trocar pelo domínio real
    allowed_headers = ["*"]
    max_age_seconds = 3600
  }
}
