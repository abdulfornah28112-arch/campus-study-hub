import pytest
from fastapi.testclient import TestClient

from app.dependencies import get_current_user
from app.main import app

client = TestClient(app)
MATERIAL_ID = "material-id"
ADMIN_ID = "admin-id"


class Result:
    def __init__(self, data=None, count=None):
        self.data = data
        self.count = count


class FakeSupabase:
    def __init__(self, approval_status="pending"):
        self.materials = {
            MATERIAL_ID: {
                "id": MATERIAL_ID,
                "title": "Test material",
                "file_path": "uploader/file.pdf",
                "file_name": "file.pdf",
                "file_type": "application/pdf",
                "approval_status": approval_status,
            }
        }
        self.bookmarks = [{"material_id": MATERIAL_ID}]
        self.approvals = [{"id": "previous-approval", "material_id": MATERIAL_ID}]
        self.objects = {"uploader/file.pdf": b"%PDF-1.7 test"}
        self.fail_storage_remove = False
        self.fail_material_delete = False
        self.storage = self.Storage(self)

    class Storage:
        def __init__(self, database):
            self.database = database

        def from_(self, bucket):
            assert bucket == "study-materials"
            return self

        def download(self, path):
            return self.database.objects[path]

        def remove(self, paths):
            if self.database.fail_storage_remove:
                raise RuntimeError("storage unavailable")
            for path in paths:
                self.database.objects.pop(path, None)

        def upload(self, path, content, options):
            self.database.objects[path] = content

    class Query:
        def __init__(self, database, table):
            self.database = database
            self.table = table
            self.action = "select"
            self.filters = {}
            self.single = False
            self.payload = None

        def select(self, *_args, **_kwargs):
            return self

        def eq(self, column, value):
            self.filters[column] = value
            return self

        def maybe_single(self):
            self.single = True
            return self

        def insert(self, payload):
            self.action = "insert"
            self.payload = payload
            return self

        def delete(self):
            self.action = "delete"
            return self

        def execute(self):
            if self.table == "materials":
                material_id = self.filters.get("id")
                if self.action == "select":
                    row = self.database.materials.get(material_id)
                    return Result(row if self.single else ([row] if row else []))
                if self.database.fail_material_delete:
                    raise RuntimeError("database unavailable")
                row = self.database.materials.pop(material_id, None)
                if not row:
                    return Result([])
                self.database.bookmarks = [
                    bookmark for bookmark in self.database.bookmarks
                    if bookmark["material_id"] != material_id
                ]
                for approval in self.database.approvals:
                    if approval["material_id"] == material_id:
                        approval["material_id"] = None
                return Result([{"id": material_id}])

            if self.table == "material_approvals":
                if self.action == "insert":
                    entry = {**self.payload, "id": "deletion-audit"}
                    self.database.approvals.append(entry)
                    return Result([{"id": entry["id"]}])
                audit_id = self.filters.get("id")
                self.database.approvals = [
                    entry for entry in self.database.approvals
                    if entry["id"] != audit_id
                ]
                return Result([])

            if self.table == "profiles":
                rows = []
            else:
                rows = []
            return Result(count=len(rows))

    def table(self, name):
        return self.Query(self, name)


@pytest.fixture
def authenticated_api_user(monkeypatch):
    def authenticate(role):
        app.dependency_overrides[get_current_user] = lambda: {"id": ADMIN_ID}
        monkeypatch.setattr(
            "app.dependencies.get_profile",
            lambda user_id: {
                "id": user_id,
                "role": role,
                "accountStatus": "ACTIVE",
            },
        )
        token = client.get("/api/auth/csrf").json()["token"]
        return {"X-XSRF-TOKEN": token}

    yield authenticate
    app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.parametrize("approval_status", ["pending", "approved", "rejected"])
def test_admin_can_delete_material_and_storage_file_for_any_status(
    approval_status, authenticated_api_user, monkeypatch
):
    database = FakeSupabase(approval_status)
    monkeypatch.setattr("app.services.material_deletion.get_supabase_admin", lambda: database)
    monkeypatch.setattr("app.routers.admin.get_supabase_admin", lambda: database)
    headers = authenticated_api_user("ADMIN")

    response = client.delete(f"/api/admin/materials/{MATERIAL_ID}", headers=headers)

    assert response.status_code == 204
    assert MATERIAL_ID not in database.materials
    assert "uploader/file.pdf" not in database.objects
    assert database.bookmarks == []
    assert database.approvals == [
        {"id": "previous-approval", "material_id": None},
        {
            "material_id": None,
            "material_ref": MATERIAL_ID,
            "material_title": "Test material",
            "admin_id": ADMIN_ID,
            "action": "deleted",
            "comments": "Deleted by administrator",
            "id": "deletion-audit",
        },
    ]

    dashboard = client.get("/api/admin/dashboard")
    assert dashboard.status_code == 200
    assert dashboard.json()["statistics"]["materials"] == 0
    assert dashboard.json()["statistics"]["pendingMaterials"] == 0
    assert dashboard.json()["statistics"]["approvedMaterials"] == 0
    assert dashboard.json()["statistics"]["rejectedMaterials"] == 0


def test_student_is_forbidden_from_admin_material_delete(
    authenticated_api_user, monkeypatch
):
    def unexpected_database_access():
        raise AssertionError("A student must be rejected before material deletion starts.")

    monkeypatch.setattr("app.services.material_deletion.get_supabase_admin", unexpected_database_access)
    headers = authenticated_api_user("STUDENT")

    response = client.delete(f"/api/admin/materials/{MATERIAL_ID}", headers=headers)

    assert response.status_code == 403


def test_failed_storage_delete_keeps_material_file_and_cleans_audit(
    authenticated_api_user, monkeypatch
):
    database = FakeSupabase()
    database.fail_storage_remove = True
    monkeypatch.setattr("app.services.material_deletion.get_supabase_admin", lambda: database)
    headers = authenticated_api_user("ADMIN")

    response = client.delete(f"/api/admin/materials/{MATERIAL_ID}", headers=headers)

    assert response.status_code == 503
    assert MATERIAL_ID in database.materials
    assert database.objects["uploader/file.pdf"] == b"%PDF-1.7 test"
    assert database.approvals == [{"id": "previous-approval", "material_id": MATERIAL_ID}]


def test_failed_database_delete_restores_file_and_keeps_material(
    authenticated_api_user, monkeypatch
):
    database = FakeSupabase()
    database.fail_material_delete = True
    monkeypatch.setattr("app.services.material_deletion.get_supabase_admin", lambda: database)
    headers = authenticated_api_user("ADMIN")

    response = client.delete(f"/api/admin/materials/{MATERIAL_ID}", headers=headers)

    assert response.status_code == 503
    assert MATERIAL_ID in database.materials
    assert database.objects["uploader/file.pdf"] == b"%PDF-1.7 test"
    assert database.approvals == [{"id": "previous-approval", "material_id": MATERIAL_ID}]
