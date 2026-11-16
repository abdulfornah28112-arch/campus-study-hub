import asyncio

import httpx
from fastapi.testclient import TestClient
from fastapi import HTTPException

from app.main import app
from app.services.auth import auth_request

client = TestClient(app)


def test_health_check() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_csrf_endpoint_sets_cookie_and_returns_token() -> None:
    response = client.get("/api/auth/csrf")

    assert response.status_code == 200
    assert response.json()["token"]
    assert response.cookies.get("csrf_token") == response.json()["token"]


def test_unsafe_api_request_requires_csrf_token() -> None:
    response = client.post("/api/auth/register", json={})

    assert response.status_code == 403
    assert response.json()["code"] == "CSRF_INVALID"


def test_validation_errors_identify_fields_without_echoing_values() -> None:
    csrf_response = client.get("/api/auth/csrf")
    token = csrf_response.json()["token"]
    response = client.post(
        "/api/auth/register",
        headers={"X-XSRF-TOKEN": token},
        json={
            "fullName": "Test Student",
            "email": "not-an-email",
            "password": "short",
        },
    )

    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"
    assert any("email" in issue["loc"] for issue in response.json()["detail"])
    assert '"not-an-email"' not in response.text
    assert '"short"' not in response.text
    assert all("input" not in issue for issue in response.json()["detail"])


def test_login_explains_unconfirmed_email(monkeypatch) -> None:
    async def reject_unconfirmed_user(*args, **kwargs):
        raise HTTPException(
            status_code=401,
            detail="Email not confirmed",
            headers={"X-Error-Code": "email_not_confirmed"},
        )

    monkeypatch.setattr("app.routers.auth.auth_request", reject_unconfirmed_user)
    token = client.get("/api/auth/csrf").json()["token"]
    response = client.post(
        "/api/auth/login",
        headers={"X-XSRF-TOKEN": token},
        json={"identifier": "student@example.com", "password": "valid-password"},
    )

    assert response.status_code == 403
    assert response.json()["code"] == "EMAIL_NOT_CONFIRMED"
    assert "Confirm your email" in response.json()["detail"]


def test_registration_explains_missing_database_profile(monkeypatch) -> None:
    async def create_auth_user(*args, **kwargs):
        return {"user": {"id": "test-user-id"}, "access_token": None}, 200

    def missing_profile(user_id):
        raise HTTPException(status_code=403, detail="Your user profile has not been provisioned.")

    monkeypatch.setattr("app.routers.auth.auth_request", create_auth_user)
    monkeypatch.setattr("app.routers.auth.get_profile", missing_profile)
    token = client.get("/api/auth/csrf").json()["token"]
    response = client.post(
        "/api/auth/register",
        headers={"X-XSRF-TOKEN": token},
        json={
            "fullName": "Test Student",
            "studentId": "test-123",
            "email": "student@example.com",
            "password": "GoodPassword123!",
            "department": "Computer Science",
            "academicLevel": "Year 1",
        },
    )

    assert response.status_code == 503
    assert "schema.sql" in response.json()["detail"]
    assert "profiles for accounts created before the schema was installed" in response.json()["detail"]


def test_signup_email_rate_limit_has_actionable_error(monkeypatch) -> None:
    class RateLimitResponse:
        status_code = 429
        is_error = True

        @staticmethod
        def json():
            return {"code": "over_email_send_rate_limit", "msg": "Email rate limit exceeded"}

    class MockAsyncClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def request(self, *args, **kwargs):
            return RateLimitResponse()

    monkeypatch.setattr("app.services.auth._auth_config", lambda: ("https://example.supabase.co", "test-anon-key"))
    monkeypatch.setattr("app.services.auth.httpx.AsyncClient", lambda **kwargs: MockAsyncClient())

    try:
        asyncio.run(auth_request("POST", "signup", payload={}))
    except HTTPException as error:
        assert error.status_code == 429
        assert error.headers["X-Error-Code"] == "EMAIL_RATE_LIMITED"
        assert "custom SMTP provider" in error.detail
        assert "Do not keep retrying" in error.detail
    else:
        raise AssertionError("Signup email rate limits should return an actionable HTTP 429.")


def test_authenticated_supabase_request_uses_bearer_token(monkeypatch) -> None:
    observed = {}

    class SuccessResponse:
        status_code = 200
        is_error = False

        @staticmethod
        def json():
            return {"id": "test-user"}

    class MockAsyncClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def request(self, *args, **kwargs):
            observed.update(kwargs)
            return SuccessResponse()

    monkeypatch.setattr("app.services.auth._auth_config", lambda: ("https://example.supabase.co", "test-anon-key"))
    monkeypatch.setattr("app.services.auth.httpx.AsyncClient", lambda **kwargs: MockAsyncClient())

    result, status = asyncio.run(auth_request("GET", "user", token="test-access-token"))

    assert result == {"id": "test-user"}
    assert status == 200
    assert observed["headers"]["Authorization"] == "Bearer test-access-token"


def test_auth_service_normalizes_unconfirmed_email_error(monkeypatch) -> None:
    class UnconfirmedResponse:
        status_code = 400
        is_error = True

        @staticmethod
        def json():
            return {"code": "email_not_confirmed", "msg": "Email not confirmed"}

    class MockAsyncClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def request(self, *args, **kwargs):
            return UnconfirmedResponse()

    monkeypatch.setattr("app.services.auth._auth_config", lambda: ("https://example.supabase.co", "test-anon-key"))
    monkeypatch.setattr("app.services.auth.httpx.AsyncClient", lambda **kwargs: MockAsyncClient())

    try:
        asyncio.run(auth_request("POST", "token?grant_type=password", payload={}))
    except HTTPException as error:
        assert error.status_code == 403
        assert error.headers["X-Error-Code"] == "EMAIL_NOT_CONFIRMED"
    else:
        raise AssertionError("Unconfirmed email must be reported distinctly from invalid credentials.")


def test_auth_service_connection_error_returns_service_unavailable(monkeypatch) -> None:
    class MockAsyncClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def request(self, *args, **kwargs):
            raise httpx.RemoteProtocolError("server disconnected")

    monkeypatch.setattr("app.services.auth._auth_config", lambda: ("https://example.supabase.co", "test-anon-key"))
    monkeypatch.setattr("app.services.auth.httpx.AsyncClient", lambda **kwargs: MockAsyncClient())

    try:
        asyncio.run(auth_request("POST", "token?grant_type=password", payload={}))
    except HTTPException as error:
        assert error.status_code == 503
        assert error.headers["X-Error-Code"] == "AUTH_SERVICE_UNAVAILABLE"
        assert "Could not connect to Supabase Auth" in error.detail
    else:
        raise AssertionError("Supabase connection failures should return HTTP 503.")


def test_api_documentation_is_enabled() -> None:
    response = client.get("/docs")

    assert response.status_code == 200
