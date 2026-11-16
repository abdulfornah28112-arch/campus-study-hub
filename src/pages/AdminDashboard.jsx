import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { AppShell } from "../components/Layout.jsx";
import { EmptyState, PageHeader } from "../components/Ui.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { departments } from "../data/catalog.js";
import { useResources } from "../library/ResourceContext.jsx";
import { apiRequest } from "../api/client.js";

const TABS = [
  ["resources", "Resources"],
  ["users", "Users"],
  ["departments", "Departments and courses"],
];
const RESOURCE_STATUSES = [
  ["PENDING", "Pending"],
  ["VERIFIED", "Approved"],
  ["REJECTED", "Rejected"],
];

export default function AdminDashboard() {
  const { user } = useAuth();
  const { resources, courses, departments: apiDepartments, loading, error } = useResources();
  const [tab, setTab] = useState("resources");
  const [resourceStatus, setResourceStatus] = useState("PENDING");
  const [resourcePage, setResourcePage] = useState(0);
  const [resourceTotalPages, setResourceTotalPages] = useState(0);
  const [adminData, setAdminData] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [adminError, setAdminError] = useState("");
  const [adminNotice, setAdminNotice] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const [resourceToDelete, setResourceToDelete] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deletingResource, setDeletingResource] = useState(false);
  const cancelDeleteButton = useRef(null);

  useEffect(() => {
    if (resourceToDelete) cancelDeleteButton.current?.focus();
  }, [resourceToDelete]);

  const loadAdminData = async () => {
    if (!user) return;
    setAdminLoading(true);
    setAdminError("");
    try {
      const data = tab === "users"
        ? await apiRequest("/api/admin/users")
        : tab === "resources"
          ? await apiRequest(`/api/admin/resources?status=${resourceStatus}&page=${resourcePage}&size=100`)
          : null;
      if (data) {
        setAdminData(tab === "users" ? data : data.content || []);
        if (tab === "resources") setResourceTotalPages(data.totalPages || 0);
      }
    } catch (error) {
      setAdminError(error.message || "Could not load administrator data.");
    } finally {
      setAdminLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, [tab, resourceStatus, resourcePage, user?.id]);

  useEffect(() => {
    if (!user) return;
    apiRequest("/api/admin/dashboard")
      .then((result) => setStatistics(result.statistics))
      .catch((error) => setAdminError(error.message || "Could not load dashboard statistics."));
  }, [user?.id]);

  const setAccountStatus = async (id, status) => {
    setAdminError("");
    try {
      const updated = await apiRequest(`/api/admin/users/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setAdminData((current) => current.map((item) => item.id === id ? updated : item));
    } catch (error) {
      setAdminError(error.message || "The account status could not be changed.");
    }
  };

  const reviewResource = async (id, status) => {
    setAdminError("");
    const rejectionReason = status === "REJECTED"
      ? window.prompt("Enter the reason for rejecting this material:")?.trim()
      : undefined;
    if (status === "REJECTED" && !rejectionReason) {
      setAdminError("A rejection reason is required.");
      return;
    }
    try {
      await apiRequest(`/api/admin/resources/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, rejectionReason }),
      });
      setAdminData((current) => current.filter((item) => item.id !== id));
    } catch (error) {
      setAdminError(error.message || "The resource could not be reviewed.");
    }
  };

  const deleteResource = (resource) => {
    setAdminError("");
    setAdminNotice("");
    setDeleteError("");
    setResourceToDelete(resource);
  };

  const confirmDeleteResource = async () => {
    if (!resourceToDelete || deletingResource) return;
    const resource = resourceToDelete;
    setDeleteError("");
    setAdminError("");
    setDeletingResource(true);
    try {
      await apiRequest(`/api/admin/materials/${resource.id}`, { method: "DELETE" });
      setAdminData((current) => current.filter((item) => item.id !== resource.id));
      setResourceToDelete(null);
      setAdminNotice("Material deleted successfully.");
      const deletedStatus = (resource.approvalStatus || resource.status || "").toUpperCase();
      setStatistics((current) => current ? {
        ...current,
        materials: Math.max(0, current.materials - 1),
        pendingMaterials: Math.max(0, current.pendingMaterials - (deletedStatus === "PENDING" ? 1 : 0)),
        approvedMaterials: Math.max(0, current.approvedMaterials - (["APPROVED", "VERIFIED"].includes(deletedStatus) ? 1 : 0)),
        rejectedMaterials: Math.max(0, current.rejectedMaterials - (deletedStatus === "REJECTED" ? 1 : 0)),
      } : current);
      try {
        const result = await apiRequest("/api/admin/dashboard");
        setStatistics(result.statistics);
      } catch (error) {
        setAdminError(`Material was deleted, but dashboard statistics could not be refreshed: ${error.message || "Try reloading the page."}`);
      }
    } catch (error) {
      setDeleteError(error.message || "The material could not be deleted.");
      setAdminError(error.message || "The resource could not be deleted.");
    } finally {
      setDeletingResource(false);
    }
  };

  return (
    <AppShell>
      <PageHeader title="Admin Dashboard" subtitle="Review platform content and browse the department catalogue." />
      {adminError && <div className="alert alert-err" role="alert">{adminError}</div>}
      {adminNotice && <div className="alert alert-ok" role="status">{adminNotice}</div>}
      {statistics && (
        <div className="grid-2" aria-label="Platform statistics" style={{ marginBottom: "1.5rem" }}>
          {[
            ["Users", statistics.users],
            ["Active users", statistics.activeUsers],
            ["Total materials", statistics.materials],
            ["Pending materials", statistics.pendingMaterials],
            ["Approved materials", statistics.approvedMaterials],
            ["Rejected materials", statistics.rejectedMaterials],
          ].map(([label, count]) => (
            <div className="card" key={label}>
              <p className="muted small" style={{ margin: 0 }}>{label}</p>
              <strong style={{ fontSize: "1.5rem" }}>{count}</strong>
            </div>
          ))}
        </div>
      )}

      <div className="tabs" role="tablist" aria-label="Admin sections">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            aria-controls={`admin-panel-${key}`}
            id={`admin-tab-${key}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <section
        className="card table-wrap"
        role="tabpanel"
        id={`admin-panel-${tab}`}
        aria-labelledby={`admin-tab-${tab}`}
      >
        {tab === "resources" && (
          <>
            <div className="tabs" role="tablist" aria-label="Filter resources by status">
              {RESOURCE_STATUSES.map(([status, label]) => (
                <button
                  key={status}
                  type="button"
                  role="tab"
                  aria-selected={resourceStatus === status}
                  onClick={() => {
                    setResourceStatus(status);
                    setResourcePage(0);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {adminLoading ? <p className="muted">Loading resources…</p> : adminData.length ? (
              <div className="stack">
                {adminData.map((resource) => (
                  <article className="card row between" key={resource.id}>
                    <div>
                      <h2>{resource.title}</h2>
                      <p className="muted small">{resource.department} · {resource.courseName} · {resource.type} · {resource.fileName}</p>
                    </div>
                    <div className="row">
                      {resourceStatus === "PENDING" && (
                        <>
                          <button className="btn btn-primary btn-sm" type="button" onClick={() => reviewResource(resource.id, "VERIFIED")}>Approve</button>
                          <button className="btn btn-secondary btn-sm" type="button" onClick={() => reviewResource(resource.id, "REJECTED")}>Reject</button>
                        </>
                      )}
                      {user?.role === "admin" && (
                        <button
                          className="btn btn-danger btn-sm"
                          type="button"
                          aria-label={`Delete ${resource.title}`}
                          onClick={() => deleteResource(resource)}
                        >
                          <Trash2 size={14} aria-hidden="true" /> Delete
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title={`No ${resourceStatus.toLowerCase()} resources`}>
                {adminError || error || (loading ? "Loading…" : "There are no resources in this status.")}
              </EmptyState>
            )}
            {resourceTotalPages > 1 && (
              <div className="row between" style={{ marginTop: "1rem" }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={resourcePage === 0 || adminLoading}
                  onClick={() => setResourcePage((page) => page - 1)}
                >
                  Previous
                </button>
                <span className="muted small">Page {resourcePage + 1} of {resourceTotalPages}</span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={resourcePage + 1 >= resourceTotalPages || adminLoading}
                  onClick={() => setResourcePage((page) => page + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

        {tab === "users" && (
          adminLoading ? <p className="muted">Loading users…</p> : adminData.length ? (
            <div className="stack">
              {adminData.map((account) => (
                <article className="card row between" key={account.id}>
                  <div><h2>{account.fullName}</h2><p className="muted small">{account.email} · {account.role} · {account.accountStatus}</p></div>
                  <div className="row">
                    {account.accountStatus !== "ACTIVE" && <button className="btn btn-primary btn-sm" type="button" onClick={() => setAccountStatus(account.id, "ACTIVE")}>Activate</button>}
                    {account.accountStatus !== "SUSPENDED" && <button className="btn btn-secondary btn-sm" type="button" onClick={() => setAccountStatus(account.id, "SUSPENDED")}>Suspend</button>}
                  </div>
                </article>
              ))}
            </div>
          ) : <EmptyState title="No users found">No accounts have been registered.</EmptyState>
        )}

        {tab === "departments" && (
          <div className="admin-catalog">
            <div>
              <h2>Departments</h2>
              <ul className="catalog-list">
                {(apiDepartments.length ? apiDepartments : departments).map((department) => <li key={department.id}>{department.name}</li>)}
              </ul>
            </div>
            <div>
              <h2>Courses</h2>
              {courses.length ? (
                <ul className="catalog-list">
                  {courses.map((course) => <li key={course.code}>{course.code}: {course.name}</li>)}
                </ul>
              ) : (
                <p className="muted">No course catalogue has been provided.</p>
              )}
            </div>
          </div>
        )}
      </section>
      {resourceToDelete && (
        <div
          className="delete-confirm-backdrop"
          onKeyDown={(event) => {
            if (event.key === "Escape" && !deletingResource) setResourceToDelete(null);
          }}
        >
          <section
            className="card delete-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-material-title"
            aria-describedby="delete-material-description"
          >
            <h2 id="delete-material-title">Delete material</h2>
            <p id="delete-material-description">Are you sure you want to permanently delete this material?</p>
            <p><strong>{resourceToDelete.title}</strong></p>
            {deleteError && <div className="alert alert-err" role="alert">{deleteError}</div>}
            <div className="delete-confirm-actions">
              <button
                ref={cancelDeleteButton}
                type="button"
                className="btn btn-secondary"
                disabled={deletingResource}
                onClick={() => setResourceToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={deletingResource}
                onClick={confirmDeleteResource}
              >
                {deletingResource ? "Deleting…" : "Delete"}
              </button>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
