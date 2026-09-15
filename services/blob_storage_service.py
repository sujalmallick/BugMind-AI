import os
import logging
from typing import Optional
from azure.storage.blob import BlobServiceClient, ContentSettings

logger = logging.getLogger("BugMind")

AZURE_STORAGE_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
AZURE_STORAGE_CONTAINER = os.getenv("AZURE_STORAGE_CONTAINER", "avatars")

_blob_service_client = None

def get_blob_service_client() -> Optional[BlobServiceClient]:
    global _blob_service_client
    if _blob_service_client is not None:
        return _blob_service_client
    
    conn_str = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
    if not conn_str:
        return None
    try:
        _blob_service_client = BlobServiceClient.from_connection_string(conn_str)
        return _blob_service_client
    except Exception as e:
        logger.error(f"Failed to initialize BlobServiceClient: {e}")
        return None

def upload_avatar_blob(user_id: int, file_bytes: bytes, content_type: str = "image/webp") -> Optional[str]:
    """
    Uploads avatar bytes to Azure Blob Storage under avatars/{user_id}/avatar.webp.
    Returns the public URL of the uploaded blob, or None if Azure Storage is not configured.
    """
    client = get_blob_service_client()
    if not client:
        return None

    blob_name = f"avatars/{user_id}/avatar.webp"
    try:
        container_client = client.get_container_client(AZURE_STORAGE_CONTAINER)
        blob_client = container_client.get_blob_client(blob_name)

        content_settings = ContentSettings(
            content_type=content_type,
            cache_control="public, max-age=3600"
        )

        blob_client.upload_blob(
            file_bytes,
            overwrite=True,
            content_settings=content_settings
        )

        logger.info(f"Successfully uploaded avatar for user {user_id} to Azure Blob Storage: {blob_client.url}")
        return blob_client.url
    except Exception as e:
        logger.error(f"Failed to upload avatar blob for user {user_id}: {e}")
        raise e

def delete_avatar_blob(avatar_url: str) -> bool:
    """
    Deletes an avatar blob from Azure Blob Storage given its URL.
    Returns True if successfully deleted or not found.
    """
    if not avatar_url or "blob.core.windows.net" not in avatar_url:
        return False

    client = get_blob_service_client()
    if not client:
        return False

    try:
        # Extract blob path from URL: https://<account>.blob.core.windows.net/<container>/<blob_path>
        parts = avatar_url.split(f"/{AZURE_STORAGE_CONTAINER}/")
        if len(parts) < 2:
            return False
        blob_name = parts[1].split("?")[0]

        container_client = client.get_container_client(AZURE_STORAGE_CONTAINER)
        blob_client = container_client.get_blob_client(blob_name)
        blob_client.delete_blob()
        logger.info(f"Deleted avatar blob: {blob_name}")
        return True
    except Exception as e:
        logger.warning(f"Could not delete avatar blob {avatar_url}: {e}")
        return False