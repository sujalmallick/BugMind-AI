import os

from cryptography.fernet import Fernet
from dotenv import load_dotenv

load_dotenv()


class EncryptionService:

    def __init__(self):

        encryption_key = os.getenv(
            "ENCRYPTION_KEY"
        )

        if not encryption_key:
            raise ValueError(
                "ENCRYPTION_KEY missing."
            )

        self.fernet = Fernet(
            encryption_key.encode()
        )

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