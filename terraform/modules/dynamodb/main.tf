# 1. Sessions & Trajectories Table
resource "aws_dynamodb_table" "sessions" {
  name         = "${var.project_name}-${var.environment}-sessions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "session_id"
  range_key    = "created_at"

  attribute {
    name = "session_id"
    type = "S"
  }

  attribute {
    name = "created_at"
    type = "N"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-sessions"
  }
}

# 2. User Profiles Table (Preferences & Dietary Constraints)
resource "aws_dynamodb_table" "user_profiles" {
  name         = "${var.project_name}-${var.environment}-user-profiles"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "user_id"

  attribute {
    name = "user_id"
    type = "S"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-user-profiles"
  }
}

# 3. Route Corridor & POI Cache Table
resource "aws_dynamodb_table" "route_cache" {
  name         = "${var.project_name}-${var.environment}-route-cache"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "route_hash"
  range_key    = "transport_mode"

  attribute {
    name = "route_hash"
    type = "S"
  }

  attribute {
    name = "transport_mode"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-route-cache"
  }
}
