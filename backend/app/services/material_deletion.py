import logging
from typing import Any

from fastapi import HTTPException

from app.database import get_supabase_admin

logger = logging.getLogger(__name__)


def _remove_deletion_audit(client: Any, audit_id: str) -> bool:
    try:
        client.table("material_approvals").delete().eq("id", audit_id).execute()
        return True
    except Exception:
        logger.exception("Could not remove material deletion audit entry during rollback.")
        return False


def delete_material_record(material_id: str, admin_id: str) -> None:
    client = get_supabase_admin()
    try:
        result = (
            client.table("materials")
            .select("id, title, file_path, file_name, file_type")
            .eq("id", material_id)
            .maybe_single()
            .execute()
        )
    except Exception as error:
        raise HTTPException(status_code=503, detail="Could not load the material for deletion.") from error
    row = result.data
    if not row:
        raise HTTPException(status_code=404, detail="Material not found.")

    storage = client.storage.from_("study-materials")
    try:
        file_content = storage.download(row["file_path"])
    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail="The uploaded file could not be verified; the material was not deleted.",
        ) from error

    try:
        audit_result = (
            client.table("material_approvals")
            .insert({
                "material_id": material_id,
                "material_ref": material_id,
                "material_title": row["title"],
                "admin_id": admin_id,
                "action": "deleted",
                "comments": "Deleted by administrator",
            })
            .select("id")
            .execute()
        )
        audit_id = audit_result.data[0]["id"]
    except Exception as error:
        raise HTTPException(status_code=503, detail="Could not record the material deletion.") from error

    try:
        storage.remove([row["file_path"]])
    except Exception as error:
        restored = True
        try:
            storage.upload(
                row["file_path"],
                file_content,
                {"content-type": row["file_type"], "upsert": "true"},
            )
        except Exception:
            logger.exception("Could not restore a material file after storage deletion failed.")
            restored = False
        audit_removed = _remove_deletion_audit(client, audit_id)
        if not restored or not audit_removed:
            raise HTTPException(
                status_code=503,
                detail="Material deletion failed and rollback was incomplete; contact an administrator.",
            ) from error
        raise HTTPException(status_code=503, detail="The uploaded file could not be deleted; no material was removed.") from error

    try:
        delete_result = (
            client.table("materials")
            .delete()
            .eq("id", material_id)
            .select("id")
            .execute()
        )
        if not delete_result.data:
            raise HTTPException(status_code=404, detail="Material not found.")
    except Exception as error:
        try:
            remaining = (
                client.table("materials")
                .select("id")
                .eq("id", material_id)
                .maybe_single()
                .execute()
                .data
            )
        except Exception as check_error:
            logger.exception("Could not verify material state after database deletion failed.")
            raise HTTPException(
                status_code=503,
                detail="Material deletion status is uncertain; contact an administrator before retrying.",
            ) from check_error
        if not remaining:
            return

        restored = True
        try:
            storage.upload(
                row["file_path"],
                file_content,
                {"content-type": row["file_type"], "upsert": "true"},
            )
        except Exception:
            logger.exception("Could not restore a deleted material file after database deletion failed.")
            restored = False
        audit_removed = _remove_deletion_audit(client, audit_id)
        if not restored or not audit_removed:
            raise HTTPException(
                status_code=503,
                detail="Material deletion failed and rollback was incomplete; contact an administrator.",
            ) from error
        if isinstance(error, HTTPException) and error.status_code == 404:
            raise error
        raise HTTPException(
            status_code=503,
            detail="The material record could not be deleted; its uploaded file was restored.",
        ) from error
