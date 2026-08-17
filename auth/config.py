from datetime import timedelta
from dotenv import load_dotenv
import os

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")

if not SECRET_KEY or len(SECRET_KEY) < 32:
    raise RuntimeError(
        "SECRET_KEY environment variable is missing or insecure. "
        "It must be set and at least 32 characters long."
    )

ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = 60

ACCESS_TOKEN_EXPIRE_DELTA = timedelta(
    minutes=ACCESS_TOKEN_EXPIRE_MINUTES
)