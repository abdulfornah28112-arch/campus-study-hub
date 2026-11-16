import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download, ExternalLink, Trash2 } from "lucide-react";
import { AppShell } from "../components/Layout.jsx";
import { EmptyState, FilterSelect, PageHeader, SearchInput } from "../components/Ui.jsx";
import { useLibrary } from "../library/LibraryContext.jsx";
import { departments as defaultDepartments, RESOURCE_TYPES } from "../data/catalog.js";
import { useResources } from "../library/ResourceContext.jsx";
import { downloadFile } from "../api/client.js";

export default function MyLibrary() {
  const { ids, toggle, error: libraryError } = useLibrary();
  const { resources: publicResources, departments } = useResources();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [department, setDepartment] = useState("");

  const saved = useMemo(() => publicResources.filter((r) => ids.includes(r.id)), [ids]);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return saved
      .filter((r) => !q || [r.title, r.courseName, r.courseCode].some((s) => s.toLowerCase().includes(q)))
      .filter((r) => !type || r.type === type)
      .filter((r) => !department || r.department === department);
  }, [saved, query, type, department]);
  const departmentOptions = (departments.length ? departments : defaultDepartments).map((item) => item.name);

  return (
    <AppShell>
      <PageHeader title="My Library" subtitle="Resources you've saved for later." />
      {libraryError && <div className="alert alert-err" role="alert">{libraryError}</div>}
      {saved.length === 0 ? (
        <EmptyState title="Your library is empty" action={<Link className="btn btn-primary" to="/study-materials">Browse Study Materials</Link>}>
          Select Save on any resource and it will appear here.
        </EmptyState>
      ) : (
        <>
          <SearchInput value={query} onChange={setQuery} placeholder="Search your saved resources" label="Search saved resources" />
          <div className="filters" style={{ maxWidth: 560 }}>
            <FilterSelect label="Resource type" value={type} onChange={setType} options={RESOURCE_TYPES} allLabel="All resource types" />
            <FilterSelect label="Department" value={department} onChange={setDepartment} options={departmentOptions} />
          </div>
          {results.length ? (
            <div className="grid-cards">
              {results.map((r) => (
                <article key={r.id} className="card resource">
                  <span className="badge badge-type">{r.type}</span>
                  <h3 style={{ marginTop: ".7rem" }}>{r.title}</h3>
                  <p className="muted small" style={{ margin: 0 }}>{r.courseCode}: {r.courseName}</p>
                  <div className="actions">
                    <Link className="btn btn-secondary btn-sm" to={`/resources/${r.id}`}><ExternalLink size={14} aria-hidden="true" /> Open</Link>
                    {r.hasFile ? (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadFile(`/api/resources/${r.id}/download`, r.fileName)}><Download size={14} aria-hidden="true" /> Download</button>
                    ) : (
                      <button type="button" className="btn btn-ghost btn-sm" disabled title="File not available yet"><Download size={14} aria-hidden="true" /> Download</button>
                    )}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggle(r.id)}><Trash2 size={14} aria-hidden="true" /> Remove</button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="No saved resources match">Try a different search or filter.</EmptyState>
          )}
        </>
      )}
    </AppShell>
  );
}
