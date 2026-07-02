# RDS PostgreSQL privado. ATENÇÃO (AD-05): criptografia KMS LIGADA NA CRIAÇÃO —
# ativar depois exige snapshot → cópia criptografada → restore.
resource "aws_db_subnet_group" "main" {
  name       = "${var.project}-db"
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_b.id]
}

resource "aws_kms_key" "rds" {
  description         = "${var.project} RDS at-rest"
  enable_key_rotation = true
}

resource "aws_db_instance" "main" {
  identifier     = "${var.project}-db"
  engine         = "postgres"
  engine_version = "17"
  instance_class = var.rds_instance_class

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  allocated_storage     = var.rds_allocated_storage
  max_allocated_storage = var.rds_allocated_storage * 5 # autoscaling de storage
  storage_type          = "gp3"

  storage_encrypted = true # ← obrigatório desde a criação
  kms_key_id        = aws_kms_key.rds.arn

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false

  backup_retention_period = 7
  backup_window           = "06:00-07:00" # UTC ≈ 03:00 BRT (fora do expediente)
  maintenance_window      = "sun:07:00-sun:08:00"

  deletion_protection       = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.project}-db-final"

  performance_insights_enabled = false # ligar se precisar diagnosticar queries
}
