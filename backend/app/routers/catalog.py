from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response

from app.database import get_supabase_admin
from app.dependencies import require_admin
from app.schemas.catalog import CourseWrite, DepartmentWrite

departments_router = APIRouter(prefix="/departments", tags=["departments"])
courses_router = APIRouter(prefix="/courses", tags=["courses"])


def _department(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row.get("description"),
        "active": True,
        "createdAt": row.get("created_at"),
    }


def _course(row: dict[str, Any]) -> dict[str, Any]:
    department = row.get("departments") or {}
    return {
        "id": row["id"],
        "code": row["course_code"],
        "title": row["course_name"],
        "departmentId": row["department_id"],
        "department": department.get("name", ""),
        "academicLevel": row.get("academic_level"),
        "semester": row.get("semester"),
        "active": True,
    }


@departments_router.get("")
def list_departments() -> list[dict[str, Any]]:
    try:
        rows = get_supabase_admin().table("departments").select("*").order("name").execute().data
        return [_department(row) for row in rows]
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=503, detail="Could not load departments from Supabase.") from error


@departments_router.get("/{department_id}")
def get_department(department_id: str) -> dict[str, Any]:
    result = get_supabase_admin().table("departments").select("*").eq("id", department_id).maybe_single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Department not found.")
    return _department(result.data)


@departments_router.post("", status_code=201)
def create_department(payload: DepartmentWrite, _: dict = Depends(require_admin)) -> dict[str, Any]:
    try:
        result = get_supabase_admin().table("departments").insert(
            {"name": payload.name.strip(), "description": payload.description}
        ).execute()
        return _department(result.data[0])
    except Exception as error:
        raise HTTPException(status_code=409, detail="Department could not be created; its name may already exist.") from error


@departments_router.put("/{department_id}")
def update_department(department_id: str, payload: DepartmentWrite, _: dict = Depends(require_admin)) -> dict[str, Any]:
    try:
        result = get_supabase_admin().table("departments").update(
            {"name": payload.name.strip(), "description": payload.description}
        ).eq("id", department_id).execute()
    except Exception as error:
        raise HTTPException(status_code=409, detail="Department could not be updated.") from error
    if not result.data:
        raise HTTPException(status_code=404, detail="Department not found.")
    return _department(result.data[0])


@departments_router.delete("/{department_id}", status_code=204)
def delete_department(department_id: str, _: dict = Depends(require_admin)) -> Response:
    try:
        result = get_supabase_admin().table("departments").delete().eq("id", department_id).execute()
    except Exception as error:
        raise HTTPException(status_code=409, detail="Department is in use and cannot be deleted.") from error
    if not result.data:
        raise HTTPException(status_code=404, detail="Department not found.")
    return Response(status_code=204)


@courses_router.get("")
def list_courses(department_id: str | None = None) -> list[dict[str, Any]]:
    query = get_supabase_admin().table("courses").select("*, departments(name)").order("course_name")
    if department_id:
        query = query.eq("department_id", department_id)
    try:
        return [_course(row) for row in query.execute().data]
    except Exception as error:
        raise HTTPException(status_code=503, detail="Could not load courses from Supabase.") from error


@courses_router.get("/department/{department_id}")
def courses_for_department(department_id: str) -> list[dict[str, Any]]:
    return list_courses(department_id=department_id)


@courses_router.get("/{course_id}")
def get_course(course_id: str) -> dict[str, Any]:
    result = get_supabase_admin().table("courses").select("*, departments(name)").eq("id", course_id).maybe_single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Course not found.")
    return _course(result.data)


@courses_router.post("", status_code=201)
def create_course(payload: CourseWrite, _: dict = Depends(require_admin)) -> dict[str, Any]:
    try:
        result = get_supabase_admin().table("courses").insert(
            {
                "department_id": payload.department_id,
                "course_name": payload.course_name.strip(),
                "course_code": payload.course_code.strip(),
                "academic_level": payload.academic_level,
                "semester": payload.semester,
            }
        ).execute()
        return _course(
            get_supabase_admin().table("courses").select("*, departments(name)")
            .eq("id", result.data[0]["id"]).single().execute().data
        )
    except Exception as error:
        raise HTTPException(status_code=409, detail="Course could not be created; verify its department and course code.") from error


@courses_router.put("/{course_id}")
def update_course(course_id: str, payload: CourseWrite, _: dict = Depends(require_admin)) -> dict[str, Any]:
    try:
        result = get_supabase_admin().table("courses").update(
            {
                "department_id": payload.department_id,
                "course_name": payload.course_name.strip(),
                "course_code": payload.course_code.strip(),
                "academic_level": payload.academic_level,
                "semester": payload.semester,
            }
        ).eq("id", course_id).execute()
    except Exception as error:
        raise HTTPException(status_code=409, detail="Course could not be updated.") from error
    if not result.data:
        raise HTTPException(status_code=404, detail="Course not found.")
    row = get_supabase_admin().table("courses").select("*, departments(name)").eq("id", course_id).single().execute().data
    return _course(row)


@courses_router.delete("/{course_id}", status_code=204)
def delete_course(course_id: str, _: dict = Depends(require_admin)) -> Response:
    try:
        result = get_supabase_admin().table("courses").delete().eq("id", course_id).execute()
    except Exception as error:
        raise HTTPException(status_code=409, detail="Course could not be deleted.") from error
    if not result.data:
        raise HTTPException(status_code=404, detail="Course not found.")
    return Response(status_code=204)
