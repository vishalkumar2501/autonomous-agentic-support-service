variable "vpc_cidr" {
  type        = string
  description = "VPC CIDR block"
}

variable "environment" {
  type        = string
  description = "Environment identifier"
}

variable "app_port" {
  type        = number
  description = "Application port"
  default     = 4000
}

variable "enable_nat_gateway" {
  type        = bool
  description = "Enable NAT Gateway"
  default     = true
}

variable "single_nat_gateway" {
  type        = bool
  description = "Use single NAT gateway"
  default     = true
}
