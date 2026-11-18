variable "aws_region" {
  type        = string
  description = "AWS deployment region"
  default     = "ap-south-1"
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev | prod)"
  default     = "dev"
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR block for the Virtual Private Cloud (VPC)"
  default     = "10.0.0.0/16"
}

variable "enable_nat_gateway" {
  type        = bool
  description = "Whether to provision a NAT Gateway for outbound ECS task internet access"
  default     = true
}

variable "single_nat_gateway" {
  type        = bool
  description = "Use a single NAT Gateway across all AZs to optimize cloud costs"
  default     = true
}

variable "acm_certificate_arn" {
  type        = string
  description = "ACM Certificate ARN for HTTPS listener. If empty, ALB operates on HTTP."
  default     = ""
}

variable "create_elasticache" {
  type        = bool
  description = "Provision AWS ElastiCache Redis 7 cluster. If false, external REDIS_URL is used."
  default     = true
}

variable "create_rds" {
  type        = bool
  description = "Provision AWS RDS PostgreSQL instance. Default false (user provides external DATABASE_URL)."
  default     = false
}

variable "alert_email" {
  type        = string
  description = "Email address for CloudWatch alarm notifications via Amazon SNS"
  default     = ""
}

variable "github_repository" {
  type        = string
  description = "GitHub repository for OIDC trust policy (owner/repo)"
  default     = "vishalkumar2501/autonomous-agentic-support-service"
}

variable "github_branch" {
  type        = string
  description = "GitHub branch allowed to deploy via OIDC"
  default     = "main"
}

variable "app_port" {
  type        = number
  description = "Port exposed by the Express API application"
  default     = 4000
}

variable "api_cpu" {
  type        = number
  description = "Fargate CPU units for API tasks (256 = 0.25 vCPU)"
  default     = 256
}

variable "api_memory" {
  type        = number
  description = "Fargate Memory (MB) for API tasks"
  default     = 512
}

variable "worker_cpu" {
  type        = number
  description = "Fargate CPU units for Worker tasks"
  default     = 256
}

variable "worker_memory" {
  type        = number
  description = "Fargate Memory (MB) for Worker tasks"
  default     = 512
}

variable "api_min_capacity" {
  type        = number
  description = "Minimum number of API tasks in ECS autoscaling group"
  default     = 1
}

variable "api_max_capacity" {
  type        = number
  description = "Maximum number of API tasks in ECS autoscaling group"
  default     = 4
}

variable "worker_min_capacity" {
  type        = number
  description = "Minimum number of Worker tasks in ECS autoscaling group"
  default     = 1
}

variable "worker_max_capacity" {
  type        = number
  description = "Maximum number of Worker tasks in ECS autoscaling group"
  default     = 3
}
