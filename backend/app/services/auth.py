from typing import Any

import httpx
from fastapi import HTTPException, Response

from app.config import get_settings

ACCESS_COOKIE = "studyhub_access"
REFRESH_COOKIE = "studyhub_refresh"


def _auth_config() -> tuple[str, str]:
    try:
        return get_settings().require_supabase_auth()
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


async def auth_request(
    method: str,
    path: str,
    *,
    token: str | None = None,
    payload: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], int]:
    base_url, anon_key = _auth_config()
    headers = {"apikey": anon_key, "Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            result = await client.request(
                method,
                f"{base_url}/auth/v1/{path.lstrip('/')}",
                headers=headers,
                json=payload,
            )
    except httpx.TimeoutException as error:
        raise HTTPException(
            status_code=503,
            detail="Supabase Auth timed out. Check the connection and try again.",
            headers={"X-Error-Code": "AUTH_SERVICE_TIMEOUT"},
        ) from error
    except httpx.RequestError as error:
        raise HTTPException(
            status_code=503,
            detail="Could not connect to Supabase Auth. Check the backend connection and try again.",
            headers={"X-Error-Code": "AUTH_SERVICE_UNAVAILABLE"},
        ) from error
    try:
        body = result.json()
    except ValueError:
        body = {}
    if result.is_error:
        message = body.get("msg") or body.get("message") or body.get("error_description") or "Authentication request failed."
        code = body.get("code") or body.get("error_code") or "AUTH_ERROR"
        normalized_code = str(code).lower()
        normalized_message = str(message).lower()
        if (
            path.split("?", 1)[0] == "signup"
            and (
                "email" in normalized_code and "rate" in normalized_code
                or "email rate limit" in normalized_message
                or "email sending rate" in normalized_message
            )
        ):
            raise HTTPException(
                status_code=429,
                detail=(
                    "Supabase has temporarily limited confirmation emails. Do not keep retrying. "
                    "Check your inbox and spam folder for an earlier confirmation email. "
                    "If you still cannot register, wait for the limit to reset or configure a "
                    "custom SMTP provider in Supabase Dashboard > Authentication > SMTP Settings."
                ),
                headers={"X-Error-Code": "EMAIL_RATE_LIMITED"},
            )
        if (
            "email_not_confirmed" in normalized_code
            or "email not confirmed" in normalized_message
            or "email address not confirmed" in normalized_message
        ):
            raise HTTPException(
                status_code=403,
                detail="Confirm your email using the link Supabase sent before signing in.",
                headers={"X-Error-Code": "EMAIL_NOT_CONFIRMED"},
            )
        status = 401 if result.status_code in {400, 401, 403} else result.status_code
        raise HTTPException(status_code=status, detail=message, headers={"X-Error-Code": str(code)})
    return body if isinstance(body, dict) else {}, result.status_code


def set_auth_cookies(response: Response, access_token: str, refresh_token: str | None) -> None:
    settings = get_settings()
    common = {
        "httponly": True,
        "secure": settings.session_cookie_secure,
        "samesite": settings.session_cookie_same_site,
        "path": "/",
    }
    response.set_cookie(ACCESS_COOKIE, access_token, max_age=3600, **common)
    if refresh_token:
        response.set_cookie(REFRESH_COOKIE, refresh_token, max_age=60 * 60 * 24 * 30, **common)


def clear_auth_cookies(response: Response) -> None:
    settings = get_settings()
    common = {
        "secure": settings.session_cookie_secure,
        "samesite": settings.session_cookie_same_site,
        "path": "/",
    }
    response.delete_cookie(ACCESS_COOKIE, httponly=True, **common)
    response.delete_cookie(REFRESH_COOKIE, httponly=True, **common)
