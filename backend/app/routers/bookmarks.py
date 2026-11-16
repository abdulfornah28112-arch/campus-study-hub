from fastapi import APIRouter, Depends, HTTPException, Response

from app.database import get_supabase_admin
from app.dependencies import current_profile
from app.services.materials import material_view

router = APIRouter(prefix="/bookmarks", tags=["bookmarks"])


@router.get("")
def list_bookmarks(context: dict = Depends(current_profile)) -> list[dict]:
    try:
        rows = (
            get_supabase_admin().table("bookmarks")
            .select("material_id, materials(*, departments(name), courses(course_name, course_code))")
            .eq("user_id", context["id"]).order("created_at", desc=True).execute().data
        )
    except Exception as error:
        raise HTTPException(status_code=503, detail="Could not load bookmarks.") from error
    return [
        material_view(row["materials"])
        for row in rows or []
        if row.get("materials") and row["materials"].get("approval_status") == "approved"
    ]


@router.post("/{material_id}", status_code=201)
def add_bookmark(material_id: str, context: dict = Depends(current_profile)) -> dict[str, bool]:
    client = get_supabase_admin()
    material = client.table("materials").select("id, approval_status").eq("id", material_id).maybe_single().execute()
    if not material.data or material.data["approval_status"] != "approved":
        raise HTTPException(status_code=404, detail="Approved material not found.")
    try:
        client.table("bookmarks").upsert(
            {"user_id": context["id"], "material_id": material_id},
            on_conflict="user_id,material_id",
            ignore_duplicates=True,
        ).execute()
    except Exception as error:
        raise HTTPException(status_code=503, detail="Bookmark could not be saved.") from error
    return {"saved": True}


@router.delete("/{material_id}", status_code=204)
def remove_bookmark(material_id: str, context: dict = Depends(current_profile)) -> Response:
    try:
        get_supabase_admin().table("bookmarks").delete().eq("user_id", context["id"]).eq("material_id", material_id).execute()
    except Exception as error:
        raise HTTPException(status_code=503, detail="Bookmark could not be removed.") from error
    return Response(status_code=204)
