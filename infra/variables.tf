/**
 * Terraform Variables
 */

variable "supabase_access_token" {
  description = "Supabase access token for API operations"
  type        = string
  sensitive   = true
}

variable "organization_id" {
  description = "Supabase organization ID"
  type        = string
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "hangboard"
}

variable "region" {
  description = "Supabase region"
  type        = string
  default     = "us-east-1"
}

variable "db_password" {
  description = "PostgreSQL database password"
  type        = string
  sensitive   = true
  validation {
    condition     = length(var.db_password) >= 16
    error_message = "Database password must be at least 16 characters long."
  }
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "enable_replication" {
  description = "Enable database replication for backups"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Common tags applied to all resources"
  type        = map(string)
  default = {
    Project     = "Hangboard"
    Managed_by  = "Terraform"
    Environment = "dev"
  }
}
