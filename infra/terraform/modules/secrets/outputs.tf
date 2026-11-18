output "database_url_arn" {
  value       = aws_secretsmanager_secret.database_url.arn
  description = "ARN of DATABASE_URL secret"
}

output "jwt_access_secret_arn" {
  value       = aws_secretsmanager_secret.jwt_access_secret.arn
  description = "ARN of JWT_ACCESS_SECRET secret"
}

output "jwt_refresh_secret_arn" {
  value       = aws_secretsmanager_secret.jwt_refresh_secret.arn
  description = "ARN of JWT_REFRESH_SECRET secret"
}

output "google_api_key_arn" {
  value       = aws_secretsmanager_secret.google_api_key.arn
  description = "ARN of GOOGLE_API_KEY secret"
}

output "openai_api_key_arn" {
  value       = aws_secretsmanager_secret.openai_api_key.arn
  description = "ARN of OPENAI_API_KEY secret"
}

output "redis_url_arn" {
  value       = aws_secretsmanager_secret.redis_url.arn
  description = "ARN of REDIS_URL secret"
}
