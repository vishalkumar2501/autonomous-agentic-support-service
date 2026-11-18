variable "environment" {
  type        = string
  description = "Environment identifier"
}

variable "aws_region" {
  type        = string
  description = "AWS region"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "Private subnets for ECS tasks"
}

variable "ecs_tasks_security_group_id" {
  type        = string
  description = "Security group ID for ECS tasks"
}

variable "target_group_arn" {
  type        = string
  description = "ALB Target Group ARN for API service"
}

variable "ecr_repository_url" {
  type        = string
  description = "ECR Repository URL"
}

variable "task_execution_role_arn" {
  type        = string
  description = "Execution role ARN for pulling images and secrets"
}

variable "task_role_arn" {
  type        = string
  description = "Task role ARN for runtime permissions"
}

variable "secret_arns" {
  type = object({
    database_url      = string
    jwt_access_secret = string
    jwt_refresh_secret = string
    google_api_key    = string
    openai_api_key    = string
    redis_url         = string
  })
  description = "Secrets Manager ARNs map"
}

variable "app_port" {
  type        = number
  description = "Application port"
  default     = 4000
}

variable "api_cpu" {
  type        = number
  default     = 256
}

variable "api_memory" {
  type        = number
  default     = 512
}

variable "worker_cpu" {
  type        = number
  default     = 256
}

variable "worker_memory" {
  type        = number
  default     = 512
}

variable "api_min_capacity" {
  type        = number
  default     = 1
}

variable "api_max_capacity" {
  type        = number
  default     = 4
}

variable "worker_min_capacity" {
  type        = number
  default     = 1
}

variable "worker_max_capacity" {
  type        = number
  default     = 3
}
