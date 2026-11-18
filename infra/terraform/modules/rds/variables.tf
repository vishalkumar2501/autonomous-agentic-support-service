variable "environment" {
  type        = string
  description = "Environment identifier"
}

variable "vpc_id" {
  type        = string
  description = "VPC ID"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "Private subnet IDs"
}

variable "ecs_tasks_security_group_id" {
  type        = string
  description = "Security group ID of ECS tasks"
}

variable "create_rds" {
  type        = bool
  description = "Provision AWS RDS PostgreSQL instance"
  default     = false
}
