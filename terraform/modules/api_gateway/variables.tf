variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "cognito_user_pool_endpoint" {
  type        = string
  description = "Cognito User Pool Issuer Endpoint"
  default     = ""
}
