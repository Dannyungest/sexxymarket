terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

resource "aws_s3_bucket" "backup_bucket" {
  bucket = var.backup_bucket_name
}

resource "aws_db_instance" "postgres" {
  identifier             = "sexxymarket-postgres"
  engine                 = "postgres"
  engine_version         = "16"
  instance_class         = "db.t4g.micro"
  allocated_storage      = 50
  db_name                = "sexxymarket"
  username               = var.db_username
  password               = var.db_password
  skip_final_snapshot    = true
  backup_retention_period = 7
}
