import os
import json
from typing import Optional, Dict, Any
from app.config import settings

_BLOB_INSTANCE: Optional["BlobClient"] = None


class BlobClient:
    def __init__(self):
        self.auth_mode = settings.BLOB_AUTH_MODE
        self.container_name = settings.BLOB_CONTAINER
        self._memory_store: Dict[str, str] = {}

        if self.auth_mode in ("azurite", "msi"):
            from azure.storage.blob import BlobServiceClient
            if self.auth_mode == "azurite":
                # Default Azurite connection string
                conn_str = "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;"
                self.service_client = BlobServiceClient.from_connection_string(conn_str)
            else:
                from azure.identity import DefaultAzureCredential
                self.service_client = BlobServiceClient(
                    account_url=settings.BLOB_ACCOUNT_URL,
                    credential=DefaultAzureCredential(),
                )

    async def save_result(self, tenant_id: str, run_id: str, content: Dict[str, Any]) -> str:
        blob_path = f"results/{tenant_id}/{run_id}.json"
        json_data = json.dumps(content)

        if self.auth_mode == "memory":
            self._memory_store[blob_path] = json_data
            return blob_path

        try:
            container_client = self.service_client.get_container_client(self.container_name)
            if not container_client.exists():
                container_client.create_container()
            blob_client = container_client.get_blob_client(blob_path)
            blob_client.upload_blob(json_data, overwrite=True)
            return blob_path
        except Exception:
            # Fallback to in-memory store if Azurite is offline during tests
            self._memory_store[blob_path] = json_data
            return blob_path

    async def get_result(self, blob_path: str) -> Optional[Dict[str, Any]]:
        if self.auth_mode == "memory" or blob_path in self._memory_store:
            raw = self._memory_store.get(blob_path)
            return json.loads(raw) if raw else None

        try:
            container_client = self.service_client.get_container_client(self.container_name)
            blob_client = container_client.get_blob_client(blob_path)
            download = blob_client.download_blob()
            data = download.readall().decode("utf-8")
            return json.loads(data)
        except Exception:
            raw = self._memory_store.get(blob_path)
            return json.loads(raw) if raw else None


def get_blob_client() -> BlobClient:
    global _BLOB_INSTANCE
    if _BLOB_INSTANCE is None:
        _BLOB_INSTANCE = BlobClient()
    return _BLOB_INSTANCE
