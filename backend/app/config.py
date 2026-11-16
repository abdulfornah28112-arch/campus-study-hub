from functools import lru_cache
from pathlib import Path
from pydantic import field_validator
from urllib.parse import urlsplit

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    supabase_url: str | None = None
    supabase_anon_key: str | None = None
    supabase_service_role_key: str | None = None
    cors_origins: str = "http://localhost:5173"
    session_cookie_secure: bool = False
    session_cookie_same_site: str = "lax"

    @field_validator("session_cookie_same_site")
    @classmethod
    def valid_same_site(cls, value: str) -> str:
        normalized = value.lower()
        if normalized not in {"lax", "strict", "none"}:
            raise ValueError("SESSION_COOKIE_SAME_SITE must be lax, strict, or none.")
        return normalized

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[1] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    def require_supabase_auth(self) -> tuple[str, str]:
        if not self.supabase_url or not self.supabase_anon_key:
            raise RuntimeError("Set SUPABASE_URL and SUPABASE_ANON_KEY in backend/.env.")
        parsed = urlsplit(self.supabase_url.strip())
        if parsed.scheme != "https" or not parsed.netloc:
            raise RuntimeError("SUPABASE_URL must be the HTTPS project API origin from Supabase Project Settings.")
        return f"{parsed.scheme}://{parsed.netloc}", self.supabase_anon_key

    def require_supabase_admin(self) -> tuple[str, str, str]:
        url, anon_key = self.require_supabase_auth()
        if not self.supabase_service_role_key:
            raise RuntimeError("Set SUPABASE_SERVICE_ROLE_KEY in backend/.env.")
        return url, anon_key, self.supabase_service_role_key


@lru_cache
def get_settings() -> Settings:
    return Settings()
