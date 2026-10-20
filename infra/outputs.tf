output "fqdn" {
  value       = azurerm_container_app.api.ingress[0].fqdn
  description = "FQDN of the deployed Container App"
}

output "container_app_name" {
  value       = azurerm_container_app.api.name
  description = "Name of the Container App"
}

output "storage_container_name" {
  value       = azurerm_storage_container.results.name
  description = "Name of the private results Blob container"
}
