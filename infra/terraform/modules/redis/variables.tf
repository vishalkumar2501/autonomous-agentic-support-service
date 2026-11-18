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
  description = "Private subnet IDs for ElastiCache"
}

variable "ecs_tasks_security_group_id" {
  type        = string
  description = "Security group ID of ECS tasks allowed to connect"
}

variable "create_elasticache" {
  type        = bool
  description = "Whether to provision ElastiCache Redis"
  default     = true
}
