import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Upload } from "lucide-react";
import { PageFrame } from "../components/Layout.jsx";
import ResourceCard from "../components/ResourceCard.jsx";
import { EmptyState, FilterSelect, PageHeader, SearchInput } from "../components/Ui.jsx";
import { departments as defaultDepartments, SEMESTERS, STUDY_TYPES, YEARS } from "../data/catalog.js";
import { byNewest } from "../data/resources.js";
import { useResources } from "../library/ResourceContext.jsx";

export default function StudyMaterials() {
  const { resources, courses, departments, loading, error } = useResources();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || "");
  const [f, setF] = useState({ department: "", course: "", type: "", year: "", semester: "" });
  const set = (key) => (value) => setF((prev) => ({ ...prev, [key]: value, ...(key === "department" ? { course: "" } : {}) }));

  const courseOptions = courses
    .filter((c) => !f.department || c.department === f.department)
    .map((c) => `${c.code}: ${c.name}`);
  const departmentOptions = (departments.length ? departments : defaultDepartments).map((department) => department.name);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return resources
      .filter((r) => r.type !== "Past Question")
      .filter((r) => !q || [r.title, r.courseName, r.courseCode].some((s) => s.toLowerCase().includes(q)))
      .filter((r) => !f.department || r.department === f.department)
      .filter((r) => !f.course || f.course.startsWith(`${r.courseCode}:`))
      .filter((r) => !f.type || r.type === f.type)
      .filter((r) => !f.year || r.year === f.year)
      .filter((r) => !f.semester || r.semester === f.semester)
      .sort(byNewest);
  }, [query, f, resources]);

  const clear = () => { setQuery(""); setF({ department: "", course: "", type: "", year: "", semester: "" }); };

  return (
    <PageFrame>
      <div className="container section" style={{ paddingTop: "1.5rem" }}>
        <PageHeader
          title="Study Materials"
          subtitle="Search lecture notes, outlines, assignments, and study guides."
          actions={<Link className="btn btn-primary" to="/upload"><Upload size={16} aria-hidden="true" /> Upload Materials</Link>}
        />
        <SearchInput value={query} onChange={setQuery} placeholder="Search by resource title, course name, or course code" label="Search study materials" />
        <div className="filters">
          <FilterSelect label="Department" value={f.department} onChange={set("department")} options={departmentOptions} />
          <FilterSelect label="Course" value={f.course} onChange={set("course")} options={courseOptions} />
          <FilterSelect label="Resource type" value={f.type} onChange={set("type")} options={STUDY_TYPES} allLabel="All resource types" />
          <FilterSelect label="Academic year" value={f.year} onChange={set("year")} options={YEARS} allLabel="All years" />
          <FilterSelect label="Semester" value={f.semester} onChange={set("semester")} options={SEMESTERS} allLabel="All semesters" />
        </div>
        <p className="muted small" role="status">{results.length} {results.length === 1 ? "resource" : "resources"} found</p>
        {results.length ? (
          <div className="grid-cards">{results.map((r) => <ResourceCard key={r.id} resource={r} showDate />)}</div>
        ) : (
          <EmptyState
            title={resources.length ? "No resources match your search" : "No study materials available yet"}
            action={resources.length ? <button type="button" className="btn btn-secondary" onClick={clear}>Clear filters</button> : undefined}
          >
            {error || (loading ? "Loading available study materials…" : resources.length ? "Try a different course code or remove a filter." : "Study materials will appear here when they are provided.")}
          </EmptyState>
        )}
      </div>
    </PageFrame>
  );
}
