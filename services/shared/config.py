"""
FinBank Shared - Configuration
"""
from pydantic_settings import BaseSettings
from typing import List


def _looks_insecure_secret(value: str) -> bool:
    normalized = (value or "").strip()
    if not normalized:
        return True

    lowered = normalized.lower()
    return (
        lowered.startswith("change-this")
        or lowered.startswith("replace-with")
        or lowered.startswith("insert_")
        or lowered.startswith("placeholder")
    )


class SharedSettings(BaseSettings):
    MONGODB_URL: str = "mongodb://mongo:27017"
    MONGODB_DB_NAME: str = "finbank"
    JWT_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"
    DEBUG: bool = False
    ENABLE_DEV_SEED_ROUTES: bool = False
    DEV_BOOTSTRAP_TOKEN: str = ""
    RESEND_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    def validate_runtime_settings(self) -> None:
        errors = []

        if _looks_insecure_secret(self.JWT_SECRET) or len(self.JWT_SECRET) < 32:
            errors.append(
                "JWT_SECRET must be set to a non-placeholder value with at least 32 characters."
            )

        if self.ENABLE_DEV_SEED_ROUTES:
            if not self.DEBUG:
                errors.append("ENABLE_DEV_SEED_ROUTES requires DEBUG=true.")
            if _looks_insecure_secret(self.DEV_BOOTSTRAP_TOKEN) or len(self.DEV_BOOTSTRAP_TOKEN) < 16:
                errors.append(
                    "DEV_BOOTSTRAP_TOKEN must be a strong non-placeholder value when seed routes are enabled."
                )

        if errors:
            raise RuntimeError("Invalid security configuration: " + " ".join(errors))

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = SharedSettings()