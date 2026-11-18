output "redis_endpoint" {
  value       = var.create_elasticache ? aws_elasticache_cluster.redis[0].cache_nodes[0].address : "localhost"
  description = "Redis host endpoint"
}

output "redis_port" {
  value       = 6379
  description = "Redis port"
}

output "redis_url" {
  value       = var.create_elasticache ? "redis://${aws_elasticache_cluster.redis[0].cache_nodes[0].address}:6379" : "redis://localhost:6379"
  description = "Full Redis connection URL"
}
