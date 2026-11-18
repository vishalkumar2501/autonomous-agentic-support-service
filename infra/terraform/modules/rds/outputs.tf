output "rds_endpoint" {
  value       = var.create_rds ? aws_db_instance.postgres[0].endpoint : ""
  description = "RDS connection endpoint"
}

output "database_url" {
  value       = var.create_rds ? "postgresql://dbadmin:ChangeMeInProduction123!@${aws_db_instance.postgres[0].endpoint}/autonomous_agentic_support?schema=public" : ""
  description = "PostgreSQL connection string if RDS is provisioned"
}
