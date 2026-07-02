variable "project" {
  description = "Prefixo dos recursos"
  type        = string
  default     = "painel"
}

variable "region" {
  type    = string
  default = "us-east-1"
}

variable "environment" {
  description = "staging | production"
  type        = string
  default     = "production"
}

variable "ec2_instance_type" {
  type    = string
  default = "t4g.small" # ARM, mais barato; use t3.small se preferir x86
}

variable "rds_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "rds_allocated_storage" {
  type    = number
  default = 20
}

variable "db_name" {
  type    = string
  default = "painel"
}

variable "db_username" {
  type    = string
  default = "painel_app"
}

variable "db_password" {
  description = "Senha do RDS — passar via TF_VAR_db_password, nunca commitar"
  type        = string
  sensitive   = true
}

variable "allowed_ssh_cidr" {
  description = "CIDR liberado pro SSH (vazio = só SSM, recomendado)"
  type        = string
  default     = ""
}
