variable "environment" {
  type        = string
  description = "Environment identifier"
}

variable "repository_name" {
  type        = string
  description = "ECR repository name"
  default     = "autonomous-agentic-support-service"
}
