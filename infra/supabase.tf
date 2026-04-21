/**
 * Supabase Project Configuration
 */

# Create Supabase project
resource "supabase_project" "hangboard" {
  name                = "${var.project_name}-${var.environment}"
  organization_id     = var.organization_id  # Set in terraform.tfvars
  database_password   = var.db_password
  region              = var.region
  
  # Free tier settings
  db_replica_region   = var.enable_replication ? var.region : null

  tags = merge(
    var.tags,
    {
      Name = "${var.project_name}-${var.environment}"
    }
  )
}

# Get database connection info
resource "supabase_database_connection" "main" {
  project_id = supabase_project.hangboard.id
}

# Upload migrations to initialize database
resource "null_resource" "database_migrations" {
  triggers = {
    db_url = supabase_project.hangboard.connection_string
  }

  provisioner "local-exec" {
    command = <<-EOT
      echo "Database initialized at: ${supabase_project.hangboard.connection_string}"
      echo "Run migrations manually or use a migration tool"
      echo "psql \"${supabase_project.hangboard.connection_string}\" -f migrations/001_init.sql"
      echo "psql \"${supabase_project.hangboard.connection_string}\" -f migrations/002_seed_data.sql"
    EOT
  }

  depends_on = [supabase_project.hangboard]
}

# Enable required PostgreSQL extensions
resource "supabase_postgres_extension" "pgcrypto" {
  project_id = supabase_project.hangboard.id
  name       = "pgcrypto"
}

resource "supabase_postgres_extension" "pg_trgm" {
  project_id = supabase_project.hangboard.id
  name       = "pg_trgm"
}

# Create API key for backend
resource "supabase_api_key" "backend" {
  project_id = supabase_project.hangboard.id
  name       = "backend-api-key"
  role       = "service_role"  # Full access for backend

  tags = {
    Service = "Backend"
  }
}

# Create API key for frontend (limited access)
resource "supabase_api_key" "frontend" {
  project_id = supabase_project.hangboard.id
  name       = "frontend-api-key"
  role       = "anon"  # Limited access for frontend

  tags = {
    Service = "Frontend"
  }
}

# Create storage bucket for backups/exports
resource "supabase_storage_bucket" "backups" {
  project_id = supabase_project.hangboard.id
  name       = "backups"
  is_public  = false

  tags = {
    Purpose = "Database Backups"
  }
}
