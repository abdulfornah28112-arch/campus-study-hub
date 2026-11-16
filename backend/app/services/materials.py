from typing import Any


def material_view(row: dict[str, Any]) -> dict[str, Any]:
    department = row.get("departments") or {}
    course = row.get("courses") or {}
    status = row.get("approval_status", "pending").upper()
    return {
        "id": row["id"],
        "title": row["title"],
        "description": row.get("description") or "",
        "type": row.get("material_type") or "",
        "department": department.get("name") or "",
        "departmentId": row.get("department_id"),
        "courseCode": course.get("course_code") or row.get("course_label") or "",
        "courseName": course.get("course_name") or row.get("course_label") or "",
        "year": row.get("academic_year") or "",
        "semester": row.get("semester") or "",
        "examType": row.get("exam_type") or "",
        "date": row.get("created_at"),
        "status": "VERIFIED" if status == "APPROVED" else status,
        "approvalStatus": status,
        "fileName": row.get("file_name"),
        "fileSize": row.get("file_size") or 0,
        "contentType": row.get("file_type") or "application/octet-stream",
        "uploadedBy": row.get("uploaded_by"),
        "rejectionReason": row.get("rejection_reason"),
    }


def material_select():
    return "*, departments(name), courses(course_name, course_code)"
