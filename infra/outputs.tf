/**
 * Terraform Outputs
 */

output "supabase_project_id" {
  description = "Supabase project ID"
  value       = supabase_project.hangboard.id
}

output "supabase_project_url" {
  description = "Supabase project API URL"
  value       = supabase_project.hangboard.api_url
}

output "database_url" {
  description = "PostgreSQL database connection string"
  value       = supabase_project.hangboard.connection_string
  sensitive   = true
}

output "database_host" {
  description = "PostgreSQL database host"
  value       = supabase_project.hangboard.db_host
}

output "database_port" {
  description = "PostgreSQL database port"
  value       = 5432
}

output "database_name" {
  description = "PostgreSQL database name"
  value       = "postgres"
}

output "backend_api_key" {
  description = "API key for backend service"
  value       = supabase_api_key.backend.api_key
  sensitive   = true
}

output "frontend_api_key" {
  description = "API key for frontend (limited access)"
  value       = supabase_api_key.frontend.api_key
  sensitive   = true
}

output "backend_api_key_name" {
  description = "Backend API key name"
  value       = supabase_api_key.backend.name
}

output "frontend_api_key_name" {
  description = "Frontend API key name"
  value       = supabase_api_key.frontend.name
}

output "storage_bucket_name" {
  description = "Storage bucket name for backups"
  value       = supabase_storage_bucket.backups.name
}

output "environment_variables" {
  description = "Environment variables for deployment"
  value = {
    SUPABASE_URL     = supabase_project.hangboard.api_url
    SUPABASE_KEY     = supabase_api_key.frontend.api_key
    DATABASE_URL     = supabase_project.hangboard.connection_string
    BACKEND_API_KEY  = supabase_api_key.backend.api_key
  }
  sensitive = true
}

output "deployment_guide" {
  description = "Steps to deploy the system"
  value = <<-EOT
    
    ========================================
    HANGBOARD DEPLOYMENT GUIDE
    ========================================
    
    1. Initialize Database:
       psql "${supabase_project.hangboard.connection_string}" -f infra/migrations/001_init.sql
       psql "${supabase_project.hangboard.connection_string}" -f infra/migrations/002_seed_data.sql
    
    2. Backend (Railway):
       - Set DATABASE_URL in secrets
       - Deploy backend/ directory
       - Get backend URL
    
    3. Frontend (Vercel):
       - Set VITE_API_URL = backend URL
       - Set VITE_WS_URL = backend WS URL (ws://)
       - Deploy frontend/ directory
    
    4. ESP32:
       - Update WiFi credentials in firmware
       - Set WS_SERVER to backend URL
       - Upload firmware with PlatformIO
    
    ========================================
  EOT
}
