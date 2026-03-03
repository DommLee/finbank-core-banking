"""
FinBank Core Banking System - Configuration
"""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # MongoDB
    MONGODB_URL: str = "mongodb://mongo:27017"
    MONGODB_DB_NAME: str = "finbank"

    # JWT
    JWT_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60

    # API
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    DEBUG: bool = False

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # Resend
    RESEND_API_KEY: str = ""

    # Telegram
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""

    # Webhooks
    WEBHOOK_URL: str = ""
    WEBHOOK_TIMEOUT: int = 5
    WEBHOOK_RETRY_COUNT: int = 3

    # Rate Limiting
    RATE_LIMIT_AUTH: str = "5/minute"
    RATE_LIMIT_GENERAL: str = "60/minute"

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173,https://finbank-core-banking.pages.dev"

    # Logging
    JSON_LOGS: bool = False
    LOG_LEVEL: str = "INFO"

    # Gemini AI
    GEMINI_API_KEY: str = ""

    # Exchange Rates
    EXCHANGE_API_KEY: str = ""

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "allow"


settings = Settings()
