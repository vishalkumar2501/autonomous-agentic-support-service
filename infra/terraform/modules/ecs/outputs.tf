output "cluster_name" {
  value       = aws_ecs_cluster.main.name
  description = "ECS cluster name"
}

output "cluster_id" {
  value       = aws_ecs_cluster.main.id
  description = "ECS cluster ID"
}

output "api_service_name" {
  value       = aws_ecs_service.api.name
  description = "ECS API service name"
}

output "worker_service_name" {
  value       = aws_ecs_service.worker.name
  description = "ECS Worker service name"
}

output "api_task_definition_family" {
  value       = aws_ecs_task_definition.api.family
  description = "Task definition family for API"
}

output "worker_task_definition_family" {
  value       = aws_ecs_task_definition.worker.family
  description = "Task definition family for Worker"
}
