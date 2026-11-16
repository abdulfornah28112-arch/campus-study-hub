import { Link } from "react-router-dom";
import { Bookmark, BookmarkCheck, Download } from "lucide-react";
import { StatusBadge } from "./Ui.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { useLibrary } from "../library/LibraryContext.jsx";
import { formatDate } from "../data/resources.js";
import { downloadFile } from "../api/client.js";

export default function ResourceCard({ resource: r, showDate = false }) {
  const { user } = useAuth();
  const { isSaved, toggle, error: libraryError } = useLibrary();
  const saved = isSaved(r.id);

  return (
    <article className="card resource">
      <div className="row between">
        <span className="badge badge-type">{r.type}</span>
        <StatusBadge status={r.status} />
      </div>
      <h3 style={{ marginTop: ".7rem" }}><Link to={`/resources/${r.id}`}>{r.title}</Link></h3>
      <p className="muted small" style={{ margin: 0 }}>{r.courseCode}: {r.courseName}</p>
      <p className="muted small" style={{ margin: 0 }}>{r.department}</p>
      <p className="muted small" style={{ margin: 0 }}>
        {r.year} {r.semester}{showDate ? ` · Added ${formatDate(r.date)}` : ""}
      </p>
      <div className="actions">
        <Link className="btn btn-secondary btn-sm" to={`/resources/${r.id}`}>View</Link>
        {r.hasFile ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadFile(`/api/resources/${r.id}/download`, r.fileName)}><Download size={14} aria-hidden="true" /> Download</button>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm" disabled title="File not available yet">
            <Download size={14} aria-hidden="true" /> Download
          </button>
        )}
        {user && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggle(r.id)} aria-pressed={saved}>
            {saved ? <BookmarkCheck size={14} aria-hidden="true" /> : <Bookmark size={14} aria-hidden="true" />}
            {saved ? "Saved" : "Save"}
          </button>
        )}
      </div>
      {libraryError && <p className="error-text" role="alert">{libraryError}</p>}
    </article>
  );
}
