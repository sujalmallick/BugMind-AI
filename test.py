from auth.security import (
    hash_password,
    verify_password,
)

password = "Password123"

hashed = hash_password(password)

print(hashed)

print(
    verify_password(
        password,
        hashed,
    )
)