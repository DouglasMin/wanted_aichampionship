terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  # Production setup should use S3 backend with DynamoDB locking
  # backend "s3" {
  #   bucket         = "waybite-terraform-state"
  #   key            = "prod/terraform.tfstate"
  #   region         = "ap-northeast-2"
  #   dynamodb_table = "waybite-terraform-locks"
  #   encrypt        = true
  # }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  default_tags {
    tags = {
      Project     = "WayBite"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# 1. AWS Cognito Module (User Pools, App Client & Identity)
module "cognito" {
  source = "./modules/cognito"

  project_name = var.project_name
  environment  = var.environment
}

# 2. Amazon DynamoDB Module (Session, Trajectory Cache & User Profiles)
module "dynamodb" {
  source = "./modules/dynamodb"

  project_name = var.project_name
  environment  = var.environment
}

# 3. Amazon API Gateway Module (REST API with Cognito Authorizer)
module "api_gateway" {
  source = "./modules/api_gateway"

  project_name               = var.project_name
  environment                = var.environment
  cognito_user_pool_endpoint = module.cognito.user_pool_endpoint
}

# 4. Amazon S3 + CloudFront Module (Frontend Web Hosting)
module "s3_cloudfront" {
  source = "./modules/s3_cloudfront"

  project_name = var.project_name
  environment  = var.environment
}
