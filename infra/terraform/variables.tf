variable "aws_region" {
  type    = string
  default = "eu-west-1"
}

variable "backup_bucket_name" {
  type = string
}

variable "db_username" {
  type = string
}

variable "db_password" {
  type      = string
  sensitive = true
}
