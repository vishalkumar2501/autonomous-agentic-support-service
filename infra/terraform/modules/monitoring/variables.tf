variable "environment" {
  type        = string
  description = "Environment identifier"
}

variable "alb_arn_suffix" {
  type        = string
  description = "ALB ARN suffix for CloudWatch metrics"
}

variable "target_group_arn_suffix" {
  type        = string
  description = "Target group ARN suffix for CloudWatch metrics"
}

variable "cluster_name" {
  type        = string
  description = "ECS cluster name"
}

variable "api_service_name" {
  type        = string
  description = "ECS API service name"
}

variable "alert_email" {
  type        = string
  description = "Optional alert email address"
  default     = ""
}
