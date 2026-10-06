import os

from cryptography.fernet import Fernet, MultiFernet
from dotenv import load_dotenv

load_dotenv()


class EncryptionService:
    """
    Encrypts users' BYOK API keys at rest.

    ENCRYPTION_KEY may hold several comma-separated Fernet keys to rotate
    without losing access to stored data: the FIRST key encrypts, every key
    can decrypt. To rotate, prepend a new key, deploy, re-save keys (or let
    them be re-encrypted over time), then drop the old key.
    """

    def __init__(self):

        encryption_key = os.getenv(
            "ENCRYPTION_KEY"
        )

        if not encryption_key:
            raise ValueError(
                "ENCRYPTION_KEY missing."
            )

        keys = [k.strip() for k in encryption_key.split(",") if k.strip()]
        self.fernet = MultiFernet([Fernet(k.encode()) for k in keys])

    def encrypt_key(
        self,
        api_key: str
    ) -> str:

        return self.fernet.encrypt(
            api_key.encode()
        ).decode()

    def decrypt_key(
        self,
        encrypted_key: str
    ) -> str:

        return self.fernet.decrypt(
            encrypted_key.encode()
        ).decode()
