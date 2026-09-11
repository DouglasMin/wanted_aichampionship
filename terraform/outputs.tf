output "cognito_user_pool_id" {
  description = "AWS Cognito User Pool ID"
  value       = module.cognito.user_pool_id
}

output "cognito_user_pool_client_id" {
  description = "AWS Cognito User Pool App Client ID"
  value       = module.cognito.user_pool_client_id
}

output "api_gateway_endpoint" {
  description = "Base API Gateway URL for frontend requests"
  value       = module.api_gateway.api_endpoint
}

output "dynamodb_session_table" {
  description = "DynamoDB Session & Trajectory Cache Table Name"
  value       = module.dynamodb.session_table_name
}

output "s3_frontend_bucket_name" {
  description = "S3 Bucket Name hosting the React frontend"
  value       = module.s3_cloudfront.bucket_name
}

output "cloudfront_distribution_domain" {
  description = "CloudFront Distribution Domain URL (Production Website)"
  value       = module.s3_cloudfront.cloudfront_domain_name
}
