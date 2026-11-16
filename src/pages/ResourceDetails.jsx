import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Bookmark, BookmarkCheck, Download, FileText } from "lucide-react";
import { PageFrame } from "../components/Layout.jsx";
import ResourceCard from "../components/ResourceCard.jsx";
import { EmptyState, StatusBadge } from "../components/Ui.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { useLibrary } from "../library/LibraryContext.jsx";
import { formatDate, isPublic } from "../data/resources.js";
import { useResources } from "../library/ResourceContext.jsx";
import { API_BASE_URL, downloadFile } from "../api/client.js";
import { apiRequest } from "../api/client.js";
import { mapResource } from "../library/ResourceContext.jsx";

export default function ResourceDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const { isSaved, toggle } = useLibrary();
  const { resources, loading } = useResources();
  const [resource, setResource] = useState(null);
  const [resourceLoading, setResourceLoading] = useState(true);
  const [resourceError, setResourceError] = useState("");

  useEffect(() => {
    let active = true;
    const listed = resources.find((item) => item.id === id);
    if (listed) {
      setResource(listed);
      setResourceLoading(false);
      setResourceError("");
      return () => { active = false; };
    }
    if (loading) return () => { active = false; };
    setResourceLoading(true);
    apiRequest(`/api/resources/${id}`)
      .then((response) => {
        if (active) {
          setResource(mapResource(response));
          setResourceError("");
        }
      })
      .catch((error) => {
        if (active) {
          setResource(null);
          setResourceError(error.message || "This resource could not be loaded.");
        }
      })
      .finally(() => { if (active) setResourceLoading(false); });
    return () => { active = false; };
  }, [id, resources, loading]);

  const visible = resource && (isPublic(resource) || user?.role === "admin");

  if (resourceLoading) {
    return <PageFrame><div className="container section"><p role="status">Loading resource…</p></div></PageFrame>;
  }

  if (!visible) {
    return (
      <PageFrame>
        <div className="container section">
          <EmptyState title="Resource not found" action={<Link className="btn btn-primary" to="/study-materials">Browse Study Materials</Link>}>
            {resourceError || "It may have been removed or isn't available yet."}
          </EmptyState>
        </div>
      </PageFrame>
    );
  }

  const r = resource;
  const saved = isSaved(r.id);
  const listPath = r.type === "Past Question" ? "/past-questions" : "/study-materials";
  const related = resources.filter((x) => x.courseCode === r.courseCode && x.id !== r.id && isPublic(x)).slice(0, 3);
  const rows = [
    ["Course", `${r.courseCode}: ${r.courseName}`],
    ["Department", r.department],
    ["Resource type", r.type],
    ["Academic year", r.year],
    ["Semester", r.semester],
    ...(r.examType ? [["Examination type", r.examType]] : []),
    ["Added", formatDate(r.date)],
    ["File", `${r.fileName} · ${r.size}`],
  ];

  return (
    <PageFrame>
      <div className="container section" style={{ paddingTop: "1.5rem" }}>
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link> / <Link to={listPath}>{r.type === "Past Question" ? "Past Questions" : "Study Materials"}</Link> / <span aria-current="page">{r.title}</span>
        </nav>
        <div className="row between" style={{ marginBottom: "1rem" }}>
          <div>
            <h1>{r.title}</h1>
            <div className="row"><span className="badge badge-type">{r.type}</span><StatusBadge status={r.status} /></div>
          </div>
          <div className="row">
            {r.hasFile ? (
              <button type="button" className="btn btn-primary" onClick={() => downloadFile(`/api/resources/${r.id}/download`, r.fileName)}><Download size={16} aria-hidden="true" /> Download</button>
            ) : (
              <button type="button" className="btn btn-primary" disabled title="File not available yet"><Download size={16} aria-hidden="true" /> Download</button>
            )}
            {user && (
              <button type="button" className="btn btn-secondary" onClick={() => toggle(r.id)} aria-pressed={saved}>
                {saved ? <BookmarkCheck size={16} aria-hidden="true" /> : <Bookmark size={16} aria-hidden="true" />}
                {saved ? "Saved to My Library" : "Save to My Library"}
              </button>
            )}
          </div>
        </div>

        <div className="detail">
          <div className="stack">
            {r.previewType ? (
              <div className="card material-preview">
                {r.previewType === "image" ? (
                  <img src={`${API_BASE_URL}/api/resources/${r.id}/preview`} alt={`Preview of ${r.title}`} />
                ) : (
                  <iframe
                    title={`Preview of ${r.title}`}
                    src={`${API_BASE_URL}/api/resources/${r.id}/preview`}
                    style={{ width: "100%", height: 520, border: 0 }}
                  />
                )}
              </div>
            ) : (
              <div className="preview">
                <div>
                  <FileText size={40} aria-hidden="true" />
                  <h3>{r.hasFile ? "Preview unavailable" : "File not available"}</h3>
                  <p className="muted small" style={{ marginBottom: 0 }}>
                    {r.hasFile ? `${r.format} files can't be previewed in the browser. Use Download to open this file.` : "The file hasn't been attached yet."}
                  </p>
                </div>
              </div>
            )}
            <div className="card">
              <h2>About this resource</h2>
              <p className="muted" style={{ marginBottom: 0 }}>{r.description}</p>
            </div>
          </div>
          <aside className="card" aria-label="Resource information">
            <h2>Details</h2>
            <dl style={{ margin: 0 }}>
              {rows.map(([k, v]) => (
                <div key={k} style={{ marginBottom: ".7rem" }}>
                  <dt className="muted small">{k}</dt>
                  <dd style={{ margin: 0 }}>{v}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>

        {related.length > 0 && (
          <section style={{ marginTop: "2rem" }} aria-labelledby="rel">
            <h2 id="rel">Related resources from this course</h2>
            <div className="grid-cards">{related.map((x) => <ResourceCard key={x.id} resource={x} />)}</div>
          </section>
        )}
      </div>
    </PageFrame>
  );
}
