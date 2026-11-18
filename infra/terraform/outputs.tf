output "alb_dns_name" {
  value       = module.alb.alb_dns_name
  description = "Public DNS name of the Application Load Balancer"
}

output "app_url" {
  value       = var.acm_certificate_arn != "" ? "https://${module.alb.alb_dns_name}" : "http://${module.alb.alb_dns_name}"
  description = "Base application URL for smoke tests and client requests"
}

output "ecr_repository_url" {
  value       = module.ecr.repository_url
  description = "URL of Amazon ECR repository"
}

output "ecs_cluster_name" {
  value       = module.ecs.cluster_name
  description = "Amazon ECS Cluster name"
}

output "ecs_api_service_name" {
  value       = module.ecs.api_service_name
  description = "ECS API service name"
}

output "ecs_worker_service_name" {
  value       = module.ecs.worker_service_name
  description = "ECS Worker service name"
}

output "github_deploy_role_arn" {
  value       = module.iam.github_deploy_role_arn
  description = "IAM Role ARN to configure in GitHub repo variable AWS_ROLE_ARN"
}

output "private_subnet_ids" {
  value       = module.network.private_subnet_ids
  description = "Private subnets for one-off ECS migration tasks"
}

output "ecs_tasks_security_group_id" {
  value       = module.network.ecs_tasks_security_group_id
  description = "Security group for ECS tasks"
}
