from typing import Any

from fastapi import Cookie, Depends, HTTPException, Response

from app.database import get_supabase_admin
from app.services.auth import ACCESS_COOKIE, REFRESH_COOKIE, auth_request, set_auth_cookies


async def get_current_user(
    response: Response,
    access_token: str | None = Cookie(default=None, alias=ACCESS_COOKIE),
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE),
) -> dict[str, Any]:
    if access_token:
        try:
            user, _ = await auth_request("GET", "user", token=access_token)
            return user
        except HTTPException as error:
            if error.status_code != 401 or not refresh_token:
                raise HTTPException(status_code=401, detail="Sign in to continue.", headers={"X-Error-Code": "UNAUTHORIZED"}) from error

    if not refresh_token:
        raise HTTPException(status_code=401, detail="Sign in to continue.", headers={"X-Error-Code": "UNAUTHORIZED"})
    try:
        refreshed, _ = await auth_request(
            "POST",
            "token?grant_type=refresh_token",
            payload={"refresh_token": refresh_token},
        )
    except HTTPException as error:
        raise HTTPException(status_code=401, detail="Your sign-in session has expired.", headers={"X-Error-Code": "UNAUTHORIZED"}) from error
    new_access = refreshed.get("access_token")
    user = refreshed.get("user")
    if not new_access or not user:
        raise HTTPException(status_code=401, detail="Your sign-in session has expired.")
    set_auth_cookies(response, new_access, refreshed.get("refresh_token"))
    return user


def get_profile(user_id: str) -> dict[str, Any]:
    client = get_supabase_admin()
    result = (
        client.table("profiles")
        .select("*, departments(name)")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=403, detail="Your user profile has not been provisioned.")
    profile = result.data
    department = profile.get("departments") or {}
    return {
        "id": profile["id"],
        "fullName": profile.get("full_name") or "",
        "email": profile.get("email") or "",
        "studentId": profile.get("student_id") or "",
        "department": department.get("name") or "",
        "departmentId": profile.get("department_id"),
        "academicLevel": profile.get("academic_level") or "",
        "role": profile.get("role", "student").upper(),
        "accountStatus": "SUSPENDED" if profile.get("is_suspended") else "ACTIVE",
    }


def current_profile(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    profile = get_profile(user["id"])
    if profile["accountStatus"] == "SUSPENDED":
        raise HTTPException(status_code=403, detail="This account is suspended.", headers={"X-Error-Code": "ACCOUNT_NOT_ACTIVE"})
    return {**user, "profile": profile}


def require_admin(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    profile = get_profile(user["id"])
    if profile["accountStatus"] == "SUSPENDED":
        raise HTTPException(status_code=403, detail="This account is suspended.")
    if profile["role"] != "ADMIN":
        raise HTTPException(status_code=403, detail="Administrator access is required.")
    return {**user, "profile": profile}


async def optional_profile(
    access_token: str | None = Cookie(default=None, alias=ACCESS_COOKIE),
) -> dict[str, Any] | None:
    if not access_token:
        return None
    try:
        user, _ = await auth_request("GET", "user", token=access_token)
    except HTTPException as error:
        if error.status_code == 401:
            return None
        raise
    profile = get_profile(user["id"])
    if profile["accountStatus"] == "SUSPENDED":
        return None
    return {**user, "profile": profile}
