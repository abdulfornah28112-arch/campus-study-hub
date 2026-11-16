import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Eye } from "lucide-react";
import { PageFrame } from "../components/Layout.jsx";
import { EmptyState, FilterSelect, PageHeader, SearchInput } from "../components/Ui.jsx";
import { departments as defaultDepartments, EXAM_TYPES, SEMESTERS, YEARS } from "../data/catalog.js";
import { byNewest } from "../data/resources.js";
import { useResources } from "../library/ResourceContext.jsx";
import { downloadFile } from "../api/client.js";

export default function PastQuestions() {
  const { resources: publicResources, departments, loading, error } = useResources();
  const [query, setQuery] = useState("");
  const [f, setF] = useState({ department: "", year: "", semester: "", examType: "" });
  const set = (key) => (value) => setF((prev) => ({ ...prev, [key]: value }));

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return publicResources
      .filter((r) => r.type === "Past Question")
      .filter((r) => !q || [r.courseName, r.courseCode].some((s) => s.toLowerCase().includes(q)))
      .filter((r) => !f.department || r.department === f.department)
      .filter((r) => !f.year || r.year === f.year)
      .filter((r) => !f.semester || r.semester === f.semester)
      .filter((r) => !f.examType || r.examType === f.examType)
      .sort(byNewest);
  }, [query, f]);

  const clear = () => { setQuery(""); setF({ department: "", year: "", semester: "", examType: "" }); };
  const departmentOptions = (departments.length ? departments : defaultDepartments).map((department) => department.name);

  return (
    <PageFrame>
      <div className="container section" style={{ paddingTop: "1.5rem" }}>
        <PageHeader title="Past Questions" subtitle="Find past examination papers for practice." />
        <SearchInput value={query} onChange={setQuery} placeholder="Search by course name or code" label="Search past questions" />
        <div className="filters">
          <FilterSelect label="Department" value={f.department} onChange={set("department")} options={departmentOptions} />
          <FilterSelect label="Academic year" value={f.year} onChange={set("year")} options={YEARS} allLabel="All years" />
          <FilterSelect label="Semester" value={f.semester} onChange={set("semester")} options={SEMESTERS} allLabel="All semesters" />
          <FilterSelect label="Examination type" value={f.examType} onChange={set("examType")} options={EXAM_TYPES} allLabel="All examination types" />
        </div>
        {results.length ? (
          <div className="card" style={{ paddingBlock: ".4rem" }}>
            {results.map((r) => (
              <div key={r.id} className="list-row">
                <div>
                  <Link to={`/resources/${r.id}`}><strong>{r.courseCode}: {r.courseName}</strong></Link>
                  <div className="muted small">{r.department} · {r.examType} · {r.year} · {r.semester}</div>
                </div>
                <div className="row">
                  <span className="badge">{r.format} · {r.size}</span>
                  <Link className="btn btn-secondary btn-sm" to={`/resources/${r.id}`}><Eye size={14} aria-hidden="true" /> Preview</Link>
                  {r.hasFile ? (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadFile(`/api/resources/${r.id}/download`, r.fileName)}><Download size={14} aria-hidden="true" /> Download</button>
                  ) : (
                    <button type="button" className="btn btn-ghost btn-sm" disabled title="File not available yet"><Download size={14} aria-hidden="true" /> Download</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title={publicResources.some((resource) => resource.type === "Past Question") ? "No past questions match your search" : "No past questions available yet"} action={publicResources.some((resource) => resource.type === "Past Question") ? <button type="button" className="btn btn-secondary" onClick={clear}>Clear filters</button> : undefined}>
            {error || (loading ? "Loading past questions…" : publicResources.some((resource) => resource.type === "Past Question") ? "Try another course code, year, or examination type." : "Past questions will appear here when they are provided.")}
          </EmptyState>
        )}
      </div>
    </PageFrame>
  );
}
