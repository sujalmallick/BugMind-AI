"""
services/document_storage.py — private storage for uploaded project documents.

Azure Blob Storage when AZURE_STORAGE_CONNECTION_STRING is set (container
DOCUMENTS_CONTAINER, created private), otherwise a local directory
(DOCUMENT_STORAGE_DIR). That directory is deliberately NOT under uploads/,
which is served publicly.

Stored paths carry their backend ("blob:..." / "file:..."), so documents stay
readable if the configuration changes later. Keys are generated server-side.
"""

import logging
import os
import uuid
from pathlib import Path

from services.blob_storage_service import get_blob_service_client

logger = logging.getLogger("BugMind")

DEFAULT_CONTAINER = "project-documents"
DEFAULT_LOCAL_DIR = "data/documents"


def _container():
    from azure.core.exceptions import ResourceExistsError

    client = get_blob_service_client()
    container = client.get_container_client(os.getenv("DOCUMENTS_CONTAINER", DEFAULT_CONTAINER))
    try:
        container.create_container()  # private: no public access level
    except ResourceExistsError:
        pass
    return container


def _local_root() -> Path:
    return Path(os.getenv("DOCUMENT_STORAGE_DIR", DEFAULT_LOCAL_DIR)).resolve()


def _local_path(key: str) -> Path:
    root = _local_root()
    path = (root / key).resolve()
    if root not in path.parents:
        raise ValueError("Invalid document storage key")
    return path


def put(project_id: int, data: bytes, content_type: str) -> str:
    """Store bytes; returns the storage path to save on the document row."""
    key = f"projects/{int(project_id)}/{uuid.uuid4().hex}"
    if get_blob_service_client() is not None:
        from azure.storage.blob import ContentSettings

        _container().upload_blob(key, data, overwrite=False,
                                 content_settings=ContentSettings(content_type=content_type))
        return f"blob:{key}"

    path = _local_path(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return f"file:{key}"


def get(storage_path: str) -> bytes:
    backend, _, key = storage_path.partition(":")
    if backend == "blob":
        return _container().download_blob(key).readall()
    if backend == "file":
        return _local_path(key).read_bytes()
    raise ValueError(f"Unknown storage backend for {storage_path!r}")


def delete(storage_path: str) -> None:
    """Best effort: a leftover file is harmless, a failed request isn't."""
    backend, _, key = storage_path.partition(":")
    try:
        if backend == "blob":
            _container().delete_blob(key)
        elif backend == "file":
            _local_path(key).unlink(missing_ok=True)
    except Exception:
        logger.warning(f"Could not delete stored document {storage_path}", exc_info=True)
