variable "aws_region" {
  description = "Target AWS Region (Bedrock models available in us-east-1, us-west-2, ap-northeast-2)"
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "AWS CLI Profile to use"
  type        = string
  default     = "developer-dongik"
}

variable "project_name" {
  description = "Project name prefix for AWS resources"
  type        = string
  default     = "waybite"
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "kakao_rest_api_key" {
  description = "Kakao Developers REST API Key"
  type        = string
  default     = ""
  sensitive   = true
}

variable "odsay_api_key" {
  description = "ODsay Public Transit API Key"
  type        = string
  default     = ""
  sensitive   = true
}

variable "tmap_api_key" {
  description = "TMap Open API Key"
  type        = string
  default     = ""
  sensitive   = true
}

variable "google_places_api_key" {
  description = "Google Places API Key"
  type        = string
  default     = ""
  sensitive   = true
}

variable "pinecone_api_key" {
  description = "Pinecone API Key for Serverless Vector Search"
  type        = string
  default     = ""
  sensitive   = true
}

variable "pinecone_index_name" {
  description = "Pinecone Index Name for Restaurant Reviews"
  type        = string
  default     = "waybite-reviews"
}
