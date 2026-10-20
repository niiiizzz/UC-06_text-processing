from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_ENV: Literal["dev", "test", "prod"] = "dev"
    PROJECT_NAME: str = "TextForge"
    PORT: int = 8000
    VERSION: str = "0.1.0"

    # Database
    SQL_AUTH_MODE: Literal["sql", "msi", "sqlite"] = "sql"
    SQL_SERVER: str = "localhost"
    SQL_DATABASE: str = "textforge"
    SQL_USER: str = "sa"
    SQL_PASSWORD: str = ""
    SQL_PORT: int = 1433
    SQL_DRIVER: str = "ODBC Driver 18 for SQL Server"
    SQLITE_PATH: str = "lathe_dev.db"

    # Blob Storage
    BLOB_AUTH_MODE: Literal["azurite", "msi", "memory"] = "azurite"
    BLOB_ACCOUNT_URL: str = "http://127.0.0.1:10000/devstoreaccount1"
    BLOB_CONTAINER: str = "results-dev"

    # Auth & Sessions
    SESSION_SECRET: str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    SESSION_TTL_MINUTES: int = 480
    SEED_PASSWORD: str = "LatheDemo2026!"

    # Test hooks & Flags
    ENABLE_TEST_HOOKS: bool = True
    FEATURE_BILLING_SIM: bool = False
    FEATURE_SIGNUP_SIM: bool = False


settings = Settings()
