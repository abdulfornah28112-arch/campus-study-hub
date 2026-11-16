import secrets
from typing import Any

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response

from app.database import get_supabase_admin
from app.config import get_settings
from app.dependencies import current_profile, get_profile
from app.schemas.auth import LoginRequest, PasswordChangeRequest, ProfileUpdateRequest, RegisterRequest
from app.services.auth import (
    ACCESS_COOKIE,
    REFRESH_COOKIE,
    auth_request,
    clear_auth_cookies,
    set_auth_cookies,
)

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.get("/csrf")
def csrf(request: Request, response: Response) -> dict[str, str]:
    token = request.cookies.get("csrf_token") or secrets.token_urlsafe(32)
    response.set_cookie(
        "csrf_token",
        token,
        httponly=False,
        secure=get_settings().session_cookie_secure,
        samesite=get_settings().session_cookie_same_site,
        path="/",
    )
    return {"token": token}


def _profile_after_auth(user_id: str) -> dict[str, Any]:
    try:
        return get_profile(user_id)
    except HTTPException as error:
        if error.status_code == 403:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Your Supabase Auth account exists, but its database profile is missing. "
                    "Run backend/supabase/schema.sql in the Supabase SQL Editor; it will create "
                    "profiles for accounts created before the schema was installed."
                ),
            ) from error
        raise
    except Exception as error:
        message = str(error).lower()
        if any(phrase in message for phrase in ("does not exist", "schema cache", "could not find the table")):
            detail = (
                "The Supabase database schema is not installed. Run "
                "backend/supabase/schema.sql in the Supabase SQL Editor, then try again."
            )
        else:
            detail = "Could not load the account profile from Supabase. Check the backend database connection."
        raise HTTPException(status_code=503, detail=detail) from error


@router.post("/register", status_code=201)
async def register(payload: RegisterRequest, response: Response) -> dict[str, Any]:
    metadata = {
        "full_name": payload.fullName.strip(),
        "student_id": payload.studentId.strip() if payload.studentId else None,
        "department": payload.department,
        "academic_level": payload.academicLevel,
        "role": "student",
    }
    result, _ = await auth_request(
        "POST",
        "signup",
        payload={"email": str(payload.email), "password": payload.password, "data": metadata},
    )
    user = result.get("user") or result
    if not user.get("id"):
        raise HTTPException(status_code=502, detail="Supabase did not return the registered user.")
    profile = _profile_after_auth(user["id"])
    if result.get("access_token"):
        set_auth_cookies(response, result["access_token"], result.get("refresh_token"))
        status = "active"
    else:
        status = "pending"
    return {"user": profile, "status": status}


@router.post("/login")
async def login(payload: LoginRequest, response: Response) -> dict[str, Any]:
    identifier = payload.identifier.strip()
    email = identifier.lower() if "@" in identifier else identifier
    if "@" not in identifier:
        try:
            lookup = (
                get_supabase_admin()
                .table("profiles")
                .select("email")
                .eq("student_id", identifier)
                .maybe_single()
                .execute()
            )
            if not lookup.data:
                raise HTTPException(status_code=401, detail="Invalid email/student ID or password.", headers={"X-Error-Code": "INVALID_CREDENTIALS"})
            email = lookup.data["email"]
        except HTTPException:
            raise
        except Exception as error:
            raise HTTPException(status_code=503, detail="Could not look up the student ID.") from error

    try:
        result, _ = await auth_request(
            "POST",
            "token?grant_type=password",
            payload={"email": email, "password": payload.password},
        )
    except HTTPException as error:
        error_code = (error.headers or {}).get("X-Error-Code", "").lower()
        if error_code == "email_not_confirmed":
            raise HTTPException(
                status_code=403,
                detail="Confirm your email using the link Supabase sent before signing in.",
                headers={"X-Error-Code": "EMAIL_NOT_CONFIRMED"},
            ) from error
        if error.status_code == 401 and error_code in {
            "invalid_credentials",
            "invalid_grant",
            "invalid_login_credentials",
        }:
            raise HTTPException(
                status_code=401,
                detail="Invalid email/student ID or password.",
                headers={"X-Error-Code": "INVALID_CREDENTIALS"},
            ) from error
        raise
    if not result.get("access_token") or not result.get("user", {}).get("id"):
        raise HTTPException(status_code=401, detail="Invalid email/student ID or password.", headers={"X-Error-Code": "INVALID_CREDENTIALS"})
    profile = _profile_after_auth(result["user"]["id"])
    if profile["accountStatus"] == "SUSPENDED":
        raise HTTPException(status_code=403, detail="This account is suspended.", headers={"X-Error-Code": "ACCOUNT_NOT_ACTIVE"})
    set_auth_cookies(response, result["access_token"], result.get("refresh_token"))
    return profile


@router.post("/logout", status_code=204)
async def logout(request: Request, response: Response) -> Response:
    token = request.cookies.get(ACCESS_COOKIE)
    if token:
        try:
            await auth_request("POST", "logout", token=token)
        except HTTPException as error:
            if error.status_code != 401:
                raise
    clear_auth_cookies(response)
    response.status_code = 204
    return response


@router.get("/me")
def me(context: dict[str, Any] = Depends(current_profile)) -> dict[str, Any]:
    return context["profile"]


@router.put("/me")
def update_profile(
    payload: ProfileUpdateRequest,
    context: dict[str, Any] = Depends(current_profile),
) -> dict[str, Any]:
    client = get_supabase_admin()
    department_id = None
    if payload.department:
        department = (
            client.table("departments")
            .select("id")
            .eq("name", payload.department.strip())
            .maybe_single()
            .execute()
        )
        if not department.data:
            raise HTTPException(status_code=422, detail="Choose a department from the catalogue.")
        department_id = department.data["id"]
    try:
        client.table("profiles").update(
            {
                "full_name": payload.fullName.strip(),
                "student_id": payload.studentId.strip() if payload.studentId else None,
                "department_id": department_id,
                "academic_level": payload.academicLevel,
            }
        ).eq("id", context["id"]).execute()
    except Exception as error:
        raise HTTPException(status_code=409, detail="The profile could not be saved; check for a duplicate student ID.") from error
    return _profile_after_auth(context["id"])


@router.put("/password", status_code=204)
async def change_password(
    payload: PasswordChangeRequest,
    context: dict[str, Any] = Depends(current_profile),
    access_token: str | None = Cookie(default=None, alias=ACCESS_COOKIE),
) -> None:
    if not access_token:
        raise HTTPException(status_code=401, detail="Sign in to continue.")
    try:
        verification, _ = await auth_request(
            "POST",
            "token?grant_type=password",
            payload={"email": context["email"], "password": payload.currentPassword},
        )
    except HTTPException as error:
        if error.status_code == 401:
            raise HTTPException(status_code=400, detail="The current password is incorrect.", headers={"X-Error-Code": "CURRENT_PASSWORD_INVALID"}) from error
        raise
    verify_token = verification.get("access_token")
    if not verify_token:
        raise HTTPException(status_code=401, detail="Could not verify the current password.")
    await auth_request("PUT", "user", token=verify_token, payload={"password": payload.newPassword})
