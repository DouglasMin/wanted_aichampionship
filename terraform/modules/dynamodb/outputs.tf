output "session_table_name" {
  value = aws_dynamodb_table.sessions.name
}

output "session_table_arn" {
  value = aws_dynamodb_table.sessions.arn
}

output "user_profiles_table_name" {
  value = aws_dynamodb_table.user_profiles.name
}

output "user_profiles_table_arn" {
  value = aws_dynamodb_table.user_profiles.arn
}

output "route_cache_table_name" {
  value = aws_dynamodb_table.route_cache.name
}

output "route_cache_table_arn" {
  value = aws_dynamodb_table.route_cache.arn
}
