variable "subscription_id" {
  type        = string
  description = "Target Azure subscription ID"
}

variable "env" {
  type        = string
  description = "Deployment environment (dev or test)"
}

variable "resource_group_name" {
  type        = string
  description = "Assigned resource group name"
}

variable "container_app_env_name" {
  type        = string
  description = "Assigned Container Apps environment name"
}

variable "acr_name" {
  type        = string
  description = "Assigned Azure Container Registry name"
}

variable "storage_account_name" {
  type        = string
  description = "Assigned Storage Account name"
}

variable "identity_name" {
  type        = string
  description = "Assigned User Assigned Managed Identity name"
}

variable "sql_server_fqdn" {
  type        = string
  description = "Assigned SQL Server FQDN"
}

variable "sql_database_name" {
  type        = string
  default     = "lathe"
  description = "SQL database name"
}

variable "image_tag" {
  type        = string
  description = "Container image tag (git short SHA)"
}

variable "session_secret" {
  type        = string
  sensitive   = true
  description = "HMAC secret for signing session JWT tokens (min 32 bytes)"
}

variable "enable_test_hooks" {
  type        = bool
  default     = false
  description = "Enable X-Test-Force-Failure test hook header (dev only)"
}
