# Secrets Manager entries (Values set manually or via AWS CLI, never in Terraform state)

resource "aws_secretsmanager_secret" "database_url" {
  name                    = "autonomous-agentic/${var.environment}/DATABASE_URL"
  description             = "PostgreSQL connection string with schema"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "database_url_init" {
  secret_id     = aws_secretsmanager_secret.database_url.id
  secret_string = "postgresql://user:password@localhost:5432/autonomous-agentic-support-service?schema=public"

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret" "jwt_access_secret" {
  name                    = "autonomous-agentic/${var.environment}/JWT_ACCESS_SECRET"
  description             = "Secret key for signing JWT access tokens (min 32 chars)"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "jwt_access_secret_init" {
  secret_id     = aws_secretsmanager_secret.jwt_access_secret.id
  secret_string = "change_me_to_a_secure_random_key_min_32_chars"

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret" "jwt_refresh_secret" {
  name                    = "autonomous-agentic/${var.environment}/JWT_REFRESH_SECRET"
  description             = "Secret key for signing JWT refresh tokens (min 32 chars)"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "jwt_refresh_secret_init" {
  secret_id     = aws_secretsmanager_secret.jwt_refresh_secret.id
  secret_string = "change_me_to_a_secure_random_key_min_32_chars"

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret" "google_api_key" {
  name                    = "autonomous-agentic/${var.environment}/GOOGLE_API_KEY"
  description             = "Gemini API key for autonomous support agent"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "google_api_key_init" {
  secret_id     = aws_secretsmanager_secret.google_api_key.id
  secret_string = "placeholder_fill_in_secrets_manager"

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret" "openai_api_key" {
  name                    = "autonomous-agentic/${var.environment}/OPENAI_API_KEY"
  description             = "OpenAI API key (optional fallback provider)"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "openai_api_key_init" {
  secret_id     = aws_secretsmanager_secret.openai_api_key.id
  secret_string = "placeholder_fill_in_secrets_manager"

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret" "redis_url" {
  name                    = "autonomous-agentic/${var.environment}/REDIS_URL"
  description             = "Redis connection URL"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "redis_url_init" {
  secret_id     = aws_secretsmanager_secret.redis_url.id
  secret_string = "redis://localhost:6379"

  lifecycle {
    ignore_changes = [secret_string]
  }
}
