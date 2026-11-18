output "task_execution_role_arn" {
  value       = aws_iam_role.ecs_execution_role.arn
  description = "ARN of ECS Task Execution Role"
}

output "task_role_arn" {
  value       = aws_iam_role.ecs_task_role.arn
  description = "ARN of ECS Task Role"
}

output "github_deploy_role_arn" {
  value       = aws_iam_role.github_deploy_role.arn
  description = "ARN of GitHub Actions OIDC Deploy Role"
}
