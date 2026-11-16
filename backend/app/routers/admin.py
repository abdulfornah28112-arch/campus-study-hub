from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from app.database import get_supabase_admin
from app.dependencies import require_admin
from app.schemas.admin import MaterialReview, ResourceStatus, UserStatus
from app.services.material_deletion import delete_material_record
from app.services.materials import material_select, material_view

router = APIRouter(prefix="/admin", tags=["administration"])


def _count(table: str, filters: dict[str, str] | None = None) -> int:
    statement = get_supabase_admin().table(table).select("*", count="exact", head=True)
    for column, value in (filters or {}).items():
        statement = statement.eq(column, value)
    return statement.execute().count or 0


def _statistics() -> dict[str, int]:
    return {
        "users": _count("profiles"),
        "activeUsers": _count("profiles", {"is_suspended": "false"}),
        "materials": _count("materials"),
        "pendingMaterials": _count("materials", {"approval_status": "pending"}),
        "approvedMaterials": _count("materials", {"approval_status": "approved"}),
        "rejectedMaterials": _count("materials", {"approval_status": "rejected"}),
    }


def _profile_view(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "fullName": row.get("full_name") or "",
        "email": row.get("email") or "",
        "studentId": row.get("student_id") or "",
        "role": row.get("role", "student").upper(),
        "accountStatus": "SUSPENDED" if row.get("is_suspended") else "ACTIVE",
        "createdAt": row.get("created_at"),
    }


def _admin_materials(status: str, page: int, size: int) -> dict[str, Any]:
    query = (
        get_supabase_admin().table("materials").select(material_select(), count="exact")
        .eq("approval_status", status).order("created_at", desc=True)
    )
    result = query.range(page * size, (page + 1) * size - 1).execute()
    total = result.count or 0
    return {
        "content": [material_view(row) for row in result.data or []],
        "totalElements": total,
        "totalPages": (total + size - 1) // size,
        "number": page,
        "size": size,
    }


def _set_review(material_id: str, admin_id: str, status: str, reason: str | None) -> dict[str, Any]:
    client = get_supabase_admin()
    row = client.table("materials").select("id, title, approval_status").eq("id", material_id).maybe_single().execute().data
    if not row:
        raise HTTPException(status_code=404, detail="Material not found.")
    if status == "rejected" and not (reason and reason.strip()):
        raise HTTPException(status_code=422, detail="A rejection reason is required.")
    try:
        updated = client.table("materials").update(
            {
                "approval_status": status,
                "rejection_reason": reason.strip() if status == "rejected" and reason else None,
            }
        ).eq("id", material_id).execute()
        client.table("material_approvals").insert({
            "material_id": material_id,
            "material_ref": material_id,
            "material_title": row["title"],
            "admin_id": admin_id,
            "action": status,
            "comments": reason.strip() if reason else None,
        }).execute()
        return material_view(
            client.table("materials").select(material_select()).eq("id", material_id).single().execute().data
        )
    except Exception as error:
        raise HTTPException(status_code=503, detail="Material review could not be recorded.") from error


@router.get("/dashboard")
def dashboard(_: dict = Depends(require_admin)) -> dict[str, Any]:
    try:
        return {"statistics": _statistics()}
    except Exception as error:
        raise HTTPException(status_code=503, detail="Could not load dashboard statistics.") from error


@router.get("/statistics")
def statistics(_: dict = Depends(require_admin)) -> dict[str, int]:
    try:
        return _statistics()
    except Exception as error:
        raise HTTPException(status_code=503, detail="Could not load dashboard statistics.") from error


@router.get("/materials/{status}")
def list_review_materials(
    status: str,
    page: int = Query(default=0, ge=0),
    size: int = Query(default=100, ge=1, le=100),
    _: dict = Depends(require_admin),
) -> dict[str, Any]:
    if status not in {"pending", "approved", "rejected"}:
        raise HTTPException(status_code=404, detail="Unknown material review queue.")
    try:
        return _admin_materials(status, page, size)
    except Exception as error:
        raise HTTPException(status_code=503, detail="Could not load the review queue.") from error


@router.patch("/materials/{material_id}/approve")
def approve_material(material_id: str, admin: dict = Depends(require_admin)) -> dict[str, Any]:
    return _set_review(material_id, admin["id"], "approved", None)


@router.patch("/materials/{material_id}/reject")
def reject_material(
    material_id: str,
    payload: MaterialReview,
    admin: dict = Depends(require_admin),
) -> dict[str, Any]:
    return _set_review(material_id, admin["id"], "rejected", payload.rejection_reason)


@router.delete("/materials/{material_id}", status_code=204)
def admin_delete_material(material_id: str, admin: dict = Depends(require_admin)) -> Response:
    delete_material_record(material_id, admin["id"])
    return Response(status_code=204)


@router.get("/resources")
def frontend_resource_queue(
    status: str = "PENDING",
    page: int = Query(default=0, ge=0),
    size: int = Query(default=100, ge=1, le=100),
    _: dict = Depends(require_admin),
) -> dict[str, Any]:
    status_map = {"PENDING": "pending", "VERIFIED": "approved", "REJECTED": "rejected"}
    if status not in status_map:
        raise HTTPException(status_code=422, detail="Unknown resource status.")
    try:
        return _admin_materials(status_map[status], page, size)
    except Exception as error:
        raise HTTPException(status_code=503, detail="Could not load administrator resources.") from error


@router.patch("/resources/{material_id}/status")
def frontend_review_material(
    material_id: str,
    payload: ResourceStatus,
    admin: dict = Depends(require_admin),
) -> dict[str, Any]:
    status_map = {"VERIFIED": "approved", "APPROVED": "approved", "REJECTED": "rejected"}
    status = status_map.get(payload.status.upper())
    if not status:
        raise HTTPException(status_code=422, detail="Status must be VERIFIED or REJECTED.")
    return _set_review(material_id, admin["id"], status, payload.rejection_reason)


@router.get("/users")
def list_users(_: dict = Depends(require_admin)) -> list[dict[str, Any]]:
    try:
        rows = get_supabase_admin().table("profiles").select("*").order("created_at", desc=True).execute().data
        return [_profile_view(row) for row in rows or []]
    except Exception as error:
        raise HTTPException(status_code=503, detail="Could not load user accounts.") from error


@router.patch("/users/{user_id}/status")
def set_user_status(
    user_id: str,
    payload: UserStatus,
    admin: dict = Depends(require_admin),
) -> dict[str, Any]:
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="You cannot suspend your own administrator account.")
    status = payload.status.upper()
    if status not in {"ACTIVE", "SUSPENDED"}:
        raise HTTPException(status_code=422, detail="Status must be ACTIVE or SUSPENDED.")
    try:
        result = get_supabase_admin().table("profiles").update(
            {"is_suspended": status == "SUSPENDED"}
        ).eq("id", user_id).execute()
    except Exception as error:
        raise HTTPException(status_code=503, detail="User status could not be updated.") from error
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found.")
    return _profile_view(result.data[0])
