import re
import uuid
import logging
from typing import Any
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response
from starlette.concurrency import run_in_threadpool

from app.database import get_supabase_admin
from app.dependencies import current_profile, optional_profile, require_admin
from app.services.material_deletion import delete_material_record
from app.services.materials import material_select, material_view

router = APIRouter(prefix="/resources", tags=["materials"])
alias_router = APIRouter(prefix="/materials", tags=["materials"])
BUCKET = "study-materials"
MAX_DOCUMENT_SIZE = 20 * 1024 * 1024
MAX_IMAGE_SIZE = 5 * 1024 * 1024
ALLOWED_TYPES = {
    ".pdf": {"application/pdf"},
    ".doc": {"application/msword"},
    ".docx": {"application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
    ".ppt": {"application/vnd.ms-powerpoint"},
    ".pptx": {"application/vnd.openxmlformats-officedocument.presentationml.presentation"},
    ".txt": {"text/plain"},
    ".rtf": {"application/rtf", "text/rtf"},
    ".odt": {"application/vnd.oasis.opendocument.text"},
    ".odp": {"application/vnd.oasis.opendocument.presentation"},
    ".jpg": {"image/jpeg"},
    ".jpeg": {"image/jpeg"},
    ".png": {"image/png"},
    ".webp": {"image/webp"},
}
EXTENSIONS = {extension for extension in ALLOWED_TYPES}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
logger = logging.getLogger(__name__)


def _supabase_error(error: Exception, message: str) -> HTTPException:
    return HTTPException(status_code=503, detail=message)


def _material_by_id(material_id: str) -> dict[str, Any]:
    try:
        result = (
            get_supabase_admin().table("materials").select(material_select())
            .eq("id", material_id).maybe_single().execute()
        )
    except Exception as error:
        raise _supabase_error(error, "Could not load the material from Supabase.") from error
    if not result.data:
        raise HTTPException(status_code=404, detail="Material not found.")
    return result.data


def _can_view(row: dict[str, Any], context: dict[str, Any] | None) -> bool:
    return (
        row.get("approval_status") == "approved"
        or bool(context and (row.get("uploaded_by") == context.get("id") or context["profile"]["role"] == "ADMIN"))
    )


def _validate_signature(extension: str, content: bytes) -> None:
    signatures = {
        ".pdf": content.startswith(b"%PDF-"),
        ".png": content.startswith(b"\x89PNG\r\n\x1a\n"),
        ".jpg": content.startswith(b"\xff\xd8\xff"),
        ".jpeg": content.startswith(b"\xff\xd8\xff"),
        ".webp": len(content) >= 12 and content.startswith(b"RIFF") and content[8:12] == b"WEBP",
        ".doc": content.startswith(bytes.fromhex("D0CF11E0A1B11AE1")),
        ".ppt": content.startswith(bytes.fromhex("D0CF11E0A1B11AE1")),
        ".docx": content.startswith(b"PK\x03\x04"),
        ".pptx": content.startswith(b"PK\x03\x04"),
        ".odt": content.startswith(b"PK\x03\x04"),
        ".odp": content.startswith(b"PK\x03\x04"),
        ".rtf": content.lstrip().startswith(b"{\\rtf"),
        ".txt": b"\x00" not in content,
    }
    if not signatures[extension]:
        raise HTTPException(status_code=415, detail="File contents do not match the selected file type.")


@router.get("")
def list_materials(
    department_id: str | None = Query(default=None, alias="departmentId"),
    course_id: str | None = Query(default=None, alias="courseId"),
    material_type: str | None = Query(default=None, alias="type"),
    query: str | None = Query(default=None, alias="q", max_length=120),
    page: int = Query(default=0, ge=0),
    size: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    client = get_supabase_admin()
    statement = (
        client.table("materials").select(material_select(), count="exact")
        .eq("approval_status", "approved").order("created_at", desc=True)
    )
    if department_id:
        statement = statement.eq("department_id", department_id)
    if course_id:
        statement = statement.eq("course_id", course_id)
    if material_type:
        statement = statement.ilike("material_type", material_type)
    if query:
        safe_query = re.sub(r"[,()]", " ", query).strip()
        if safe_query:
            statement = statement.or_(
                f"title.ilike.%{safe_query}%,description.ilike.%{safe_query}%,course_label.ilike.%{safe_query}%"
            )
    try:
        result = statement.range(page * size, (page + 1) * size - 1).execute()
    except Exception as error:
        raise _supabase_error(error, "Could not search materials in Supabase.") from error
    rows = result.data or []
    total = result.count or 0
    return {
        "content": [material_view(row) for row in rows],
        "totalElements": total,
        "totalPages": (total + size - 1) // size,
        "number": page,
        "size": size,
    }


@router.get("/mine")
def my_uploads(context: dict[str, Any] = Depends(current_profile)) -> list[dict[str, Any]]:
    try:
        rows = (
            get_supabase_admin().table("materials").select(material_select())
            .eq("uploaded_by", context["id"]).order("created_at", desc=True).execute().data
        )
    except Exception as error:
        raise _supabase_error(error, "Could not load your uploads.") from error
    return [material_view(row) for row in rows or []]


@router.post("", status_code=201)
async def upload_material(
    title: str = Form(min_length=1, max_length=200),
    description: str = Form(default="", max_length=4000),
    material_type: str = Form(alias="type", min_length=1, max_length=60),
    department_id: str = Form(alias="departmentId"),
    course_label: str = Form(default="", alias="courseLabel", max_length=160),
    academic_year: str = Form(default="", alias="year", max_length=10),
    semester: str = Form(default="", max_length=40),
    exam_type: str = Form(default="", alias="examType", max_length=60),
    file: UploadFile = File(),
    context: dict[str, Any] = Depends(current_profile),
) -> dict[str, Any]:
    file_name = file.filename or ""
    extension = "." + file_name.rsplit(".", 1)[-1].lower() if "." in file_name else ""
    if extension not in EXTENSIONS:
        raise HTTPException(status_code=415, detail="This file extension is not permitted.")
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_TYPES[extension]:
        raise HTTPException(status_code=415, detail="The uploaded file MIME type does not match its extension.")
    limit = MAX_IMAGE_SIZE if extension in IMAGE_EXTENSIONS else MAX_DOCUMENT_SIZE
    contents = await file.read(limit + 1)
    if not contents:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(contents) > limit:
        raise HTTPException(status_code=413, detail="The uploaded file exceeds the allowed size.")
    _validate_signature(extension, contents)

    client = get_supabase_admin()
    department = client.table("departments").select("id").eq("id", department_id).maybe_single().execute()
    if not department.data:
        raise HTTPException(status_code=422, detail="Choose a valid department.")
    course_id = None
    if course_label.strip():
        courses = client.table("courses").select("id, course_code, course_name").eq("department_id", department_id).execute().data
        match = next(
            (row for row in courses if course_label.strip().casefold() in {
                row["course_code"].casefold(), row["course_name"].casefold()
            }),
            None,
        )
        if match:
            course_id = match["id"]
    safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", file_name)[:180] or f"upload{extension}"
    object_path = f"{context['id']}/{uuid.uuid4()}{extension}"
    try:
        await run_in_threadpool(
            client.storage.from_(BUCKET).upload,
            object_path,
            contents,
            {"content-type": content_type, "upsert": "false"},
        )
        inserted = (
            client.table("materials").insert({
                "title": title.strip(),
                "description": description.strip() or None,
                "file_name": safe_name,
                "file_path": object_path,
                "file_type": content_type,
                "file_size": len(contents),
                "department_id": department_id,
                "course_id": course_id,
                "course_label": course_label.strip() or None,
                "academic_level": context["profile"]["academicLevel"] or None,
                "academic_year": academic_year or None,
                "semester": semester or None,
                "material_type": material_type,
                "exam_type": exam_type or None,
                "uploaded_by": context["id"],
                "approval_status": "pending",
            }).select(material_select()).execute()
        )
        return material_view(inserted.data[0])
    except Exception as error:
        try:
            await run_in_threadpool(client.storage.from_(BUCKET).remove, [object_path])
        except Exception:
            logger.exception("Could not remove uploaded object after a failed material insert.")
        if isinstance(error, HTTPException):
            raise
        raise HTTPException(status_code=503, detail="Upload could not be saved to Supabase Storage and Database.") from error


@router.get("/{material_id}")
async def get_material(
    material_id: str,
    context: dict[str, Any] | None = Depends(optional_profile),
) -> dict[str, Any]:
    row = _material_by_id(material_id)
    if row.get("approval_status") != "approved":
        if not _can_view(row, context):
            raise HTTPException(status_code=404, detail="Material not found.")
    return material_view(row)


@router.get("/{material_id}/download")
def download_material(
    material_id: str,
    context: dict[str, Any] | None = Depends(optional_profile),
) -> Response:
    row = _material_by_id(material_id)
    if not _can_view(row, context):
        raise HTTPException(status_code=404, detail="Material not found.")
    try:
        content = get_supabase_admin().storage.from_(BUCKET).download(row["file_path"])
    except Exception as error:
        raise HTTPException(status_code=404, detail="Material file is unavailable.") from error
    filename = quote(row["file_name"])
    return Response(
        content=content,
        media_type=row["file_type"],
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"},
    )


@router.get("/{material_id}/preview")
def preview_material(
    material_id: str,
    context: dict[str, Any] | None = Depends(optional_profile),
) -> Response:
    row = _material_by_id(material_id)
    if not _can_view(row, context):
        raise HTTPException(status_code=404, detail="Material not found.")
    preview_types = {
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
        "text/plain",
    }
    if row["file_type"] not in preview_types:
        raise HTTPException(status_code=415, detail="Inline preview is available for PDF, image, and text files.")
    try:
        content = get_supabase_admin().storage.from_(BUCKET).download(row["file_path"])
    except Exception as error:
        raise HTTPException(status_code=404, detail="Material file is unavailable.") from error
    filename = quote(row["file_name"])
    return Response(
        content=content,
        media_type=row["file_type"],
        headers={
            "Content-Disposition": f"inline; filename*=UTF-8''{filename}",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
        },
    )


@router.delete("/{material_id}", status_code=204)
def delete_material(material_id: str, admin: dict[str, Any] = Depends(require_admin)) -> Response:
    delete_material_record(material_id, admin["id"])
    return Response(status_code=204)


alias_router.add_api_route("", list_materials, methods=["GET"])
alias_router.add_api_route("/my-uploads", my_uploads, methods=["GET"])
alias_router.add_api_route("/upload", upload_material, methods=["POST"], status_code=201)
alias_router.add_api_route("/{material_id}", get_material, methods=["GET"])
alias_router.add_api_route("/{material_id}/download", download_material, methods=["GET"])
alias_router.add_api_route("/{material_id}/preview", preview_material, methods=["GET"])
alias_router.add_api_route("/{material_id}", delete_material, methods=["DELETE"], status_code=204)
