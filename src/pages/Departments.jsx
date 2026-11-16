import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Search } from "lucide-react";
import { PageFrame } from "../components/Layout.jsx";
import { EmptyState, PageHeader } from "../components/Ui.jsx";
import { departments } from "../data/catalog.js";
import { useResources } from "../library/ResourceContext.jsx";

export default function Departments() {
  const { departments: apiDepartments } = useResources();
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const directory = apiDepartments.length ? apiDepartments : departments;
  const department = directory.find((item) => item.id === id || item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") === id);
  const filtered = directory.filter((item) =>
    item.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <PageFrame>
      <div className="container section">
        {id ? (
          department ? (
            <>
              <Link className="text-link back-link" to="/departments">
                <ArrowLeft size={15} aria-hidden="true" /> All departments
              </Link>
              <PageHeader title={department.name} subtitle="Department" />
              <EmptyState title="No resources available yet">
                Courses and learning resources for this department will appear here when they are provided.
              </EmptyState>
            </>
          ) : (
            <EmptyState title="Department not found" action={<Link className="btn btn-primary" to="/departments">Browse departments</Link>}>
              Check the department name or choose one from the directory.
            </EmptyState>
          )
        ) : (
          <>
            <PageHeader title="Departments" subtitle="Browse the departments listed in UniMak Study Hub." />
            <label className="search-bar directory-search">
              <Search size={18} aria-hidden="true" />
              <span className="sr-only">Search departments</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setSearchParams(event.target.value ? { q: event.target.value } : {})}
                placeholder="Search departments"
              />
            </label>
            {filtered.length ? (
              <div className="department-list">
                {filtered.map((item) => (
                  <Link key={item.id} className="department-link" to={`/departments/${item.id}`}>
                    <span>{item.name}</span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState title="No departments match your search">
                Try another department name.
              </EmptyState>
            )}
          </>
        )}
      </div>
    </PageFrame>
  );
}
