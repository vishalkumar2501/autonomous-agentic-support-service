variable "environment" {
  type        = string
  description = "Environment identifier"
}

variable "vpc_id" {
  type        = string
  description = "VPC ID"
}

variable "public_subnet_ids" {
  type        = list(string)
  description = "List of public subnets for ALB"
}

variable "security_group_id" {
  type        = string
  description = "Security group ID for ALB"
}

variable "app_port" {
  type        = number
  description = "Backend container application port"
  default     = 4000
}

variable "acm_certificate_arn" {
  type        = string
  description = "ACM Certificate ARN for HTTPS listener. If empty, runs in HTTP mode."
  default     = ""
}
