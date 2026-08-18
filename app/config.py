from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    c2_host: str = "0.0.0.0"
    c2_port: int = 8010
    c2_version: str = "1.0.0"

    mongodb_uri: str
    mongodb_database: str
    mongodb_collection: str = "finalapplications"

    rule_engine_url: str
    rule_engine_endpoint: str = "/policy-rag/evaluate"

    risk_engine_url: str
    risk_engine_endpoint: str = "/risk/evaluate"

    request_timeout_seconds: float = 120.0

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
