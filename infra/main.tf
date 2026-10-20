data "azurerm_resource_group" "rg" {
  name = var.resource_group_name
}

data "azurerm_container_app_environment" "cae" {
  name                = var.container_app_env_name
  resource_group_name = var.resource_group_name
}

data "azurerm_container_registry" "acr" {
  name                = var.acr_name
  resource_group_name = var.resource_group_name
}

data "azurerm_storage_account" "st" {
  name                = var.storage_account_name
  resource_group_name = var.resource_group_name
}

data "azurerm_user_assigned_identity" "id" {
  name                = var.identity_name
  resource_group_name = var.resource_group_name
}

# ==============================================================================
# SCORED RESOURCE 1/2: Private Blob Container for run results
# ==============================================================================
resource "azurerm_storage_container" "results" {
  name                  = "results-${var.env}"
  storage_account_id    = data.azurerm_storage_account.st.id
  container_access_type = "private"
}

# ==============================================================================
# SCORED RESOURCE 2/2: Azure Container App for TextForge monolith API + built web SPA
# ==============================================================================
resource "azurerm_container_app" "api" {
  name                         = "textforge-${var.env}"
  resource_group_name          = data.azurerm_resource_group.rg.name
  container_app_environment_id = data.azurerm_container_app_environment.cae.id
  revision_mode                = "Single"

  identity {
    type         = "UserAssigned"
    identity_ids = [data.azurerm_user_assigned_identity.id.id]
  }

  registry {
    server   = data.azurerm_container_registry.acr.login_server
    identity = data.azurerm_user_assigned_identity.id.id
  }

  secret {
    name  = "session-secret"
    value = var.session_secret
  }

  ingress {
    external_enabled = true
    target_port      = 8000
    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = 1
    max_replicas = 2

    container {
      name   = "api"
      image  = "${data.azurerm_container_registry.acr.login_server}/textforge:${var.image_tag}"
      cpu    = 0.5
      memory = "1Gi"

      env {
        name  = "APP_ENV"
        value = var.env
      }
      env {
        name  = "SQL_AUTH_MODE"
        value = "msi"
      }
      env {
        name  = "SQL_SERVER"
        value = var.sql_server_fqdn
      }
      env {
        name  = "SQL_DATABASE"
        value = var.sql_database_name
      }
      env {
        name  = "AZURE_CLIENT_ID"
        value = data.azurerm_user_assigned_identity.id.client_id
      }
      env {
        name  = "BLOB_ACCOUNT_URL"
        value = data.azurerm_storage_account.st.primary_blob_endpoint
      }
      env {
        name  = "BLOB_CONTAINER"
        value = azurerm_storage_container.results.name
      }
      env {
        name  = "ENABLE_TEST_HOOKS"
        value = tostring(var.enable_test_hooks)
      }
      env {
        name        = "SESSION_SECRET"
        secret_name = "session-secret"
      }

      liveness_probe {
        transport = "HTTP"
        path      = "/health"
        port      = 8000
      }

      readiness_probe {
        transport = "HTTP"
        path      = "/health"
        port      = 8000
      }
    }
  }
}
