from services.encryption_service import (
    EncryptionService
)

service = EncryptionService()

encrypted = service.encrypt_key(
    "my-secret-key"
)

print("Encrypted:")
print(encrypted)

print()

print("Decrypted:")
print(
    service.decrypt_key(
        encrypted
    )
)