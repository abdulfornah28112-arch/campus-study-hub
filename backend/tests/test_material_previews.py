from app.dependencies import get_current_user
from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_approved_pdf_can_be_previewed_inline(monkeypatch) -> None:
    row = {
        "id": "material-id",
        "approval_status": "approved",
        "file_path": "folder/material.pdf",
        "file_name": "material.pdf",
        "file_type": "application/pdf",
        "uploaded_by": "uploader-id",
    }

    class StorageBucket:
        def download(self, path):
            assert path == row["file_path"]
            return b"%PDF-1.7 sample"

    class Storage:
        def from_(self, bucket):
            assert bucket == "study-materials"
            return StorageBucket()

    class Supabase:
        storage = Storage()

    monkeypatch.setattr("app.routers.materials._material_by_id", lambda material_id: row)
    monkeypatch.setattr("app.routers.materials.get_supabase_admin", lambda: Supabase())

    response = client.get("/api/resources/material-id/preview")

    assert response.status_code == 200
    assert response.content == b"%PDF-1.7 sample"
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["content-disposition"].startswith("inline;")
    assert response.headers["x-content-type-options"] == "nosniff"


def test_preview_rejects_file_types_not_supported_inline(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.routers.materials._material_by_id",
        lambda material_id: {
            "id": material_id,
            "approval_status": "approved",
            "file_path": "folder/material.docx",
            "file_name": "material.docx",
            "file_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "uploaded_by": "uploader-id",
        },
    )

    response = client.get("/api/resources/material-id/preview")

    assert response.status_code == 415


def test_unapproved_other_users_material_cannot_be_previewed(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.routers.materials._material_by_id",
        lambda material_id: {
            "id": material_id,
            "approval_status": "pending",
            "file_path": "folder/material.pdf",
            "file_name": "material.pdf",
            "file_type": "application/pdf",
            "uploaded_by": "another-user",
        },
    )

    response = client.get("/api/resources/material-id/preview")

    assert response.status_code == 404


def test_student_cannot_delete_material(monkeypatch) -> None:
    app.dependency_overrides[get_current_user] = lambda: {"id": "student-id"}
    monkeypatch.setattr(
        "app.dependencies.get_profile",
        lambda user_id: {
            "id": user_id,
            "role": "STUDENT",
            "accountStatus": "ACTIVE",
        },
    )
    token = client.get("/api/auth/csrf").json()["token"]

    try:
        response = client.delete(
            "/api/resources/material-id",
            headers={"X-XSRF-TOKEN": token},
        )
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 403
