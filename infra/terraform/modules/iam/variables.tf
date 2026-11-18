variable "environment" {
  type        = string
  description = "Environment identifier"
}

variable "github_repository" {
  type        = string
  description = "GitHub repository (owner/repo)"
  default     = "vishalkumar2501/autonomous-agentic-support-service"
}

variable "github_branch" {
  type        = string
  description = "GitHub branch for OIDC condition"
  default     = "main"
}

variable "secret_arns" {
  type        = list(string)
  description = "List of Secrets Manager secret ARNs for execution role access"
  default     = []
}
