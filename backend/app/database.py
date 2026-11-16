from functools import lru_cache

from supabase import Client, create_client

from app.config import get_settings


@lru_cache
def get_supabase_admin() -> Client:
    settings = get_settings()
    try:
        url, _, service_key = settings.require_supabase_admin()
    except RuntimeError as error:
        from fastapi import HTTPException

        raise HTTPException(status_code=503, detail=str(error)) from error
    return create_client(url, service_key)
