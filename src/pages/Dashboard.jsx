import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bookmark, BookOpen, Building2, FileQuestion, Search, Upload } from "lucide-react";
import { AppShell } from "../components/Layout.jsx";
import ResourceCard from "../components/ResourceCard.jsx";
import { EmptyState } from "../components/Ui.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { useLibrary } from "../library/LibraryContext.jsx";
import { byNewest } from "../data/resources.js";
import { useResources } from "../library/ResourceContext.jsx";

export default function Dashboard() {
  const { user } = useAuth();
  const { ids } = useLibrary();
  const { resources: publicResources, loading, error } = useResources();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const recent = [...publicResources].sort(byNewest).slice(0, 3);
  const saved = publicResources.filter((r) => ids.includes(r.id)).slice(0, 3);

  const actions = [
    ["/departments", "Browse Departments", Building2],
    ["/study-materials", "Find Study Materials", BookOpen],
    ["/past-questions", "Browse Past Questions", FileQuestion],
    ["/library", "My Library", Bookmark],
    ...(user.canUpload !== false ? [["/upload", "Upload Materials", Upload]] : []),
  ];

  const onSearch = (e) => {
    e.preventDefault();
    navigate(`/study-materials${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`);
  };

  return (
    <AppShell>
      <h1>Welcome back, {user.name}</h1>
      <p className="muted">Pick up where you left off, or find something new to study today.</p>

      <form className="search-bar" onSubmit={onSearch} role="search" style={{ marginTop: "1.2rem" }}>
        <Search size={18} aria-hidden="true" />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search study materials" aria-label="Search study materials" />
        <button type="submit" className="btn btn-primary btn-sm">Search</button>
      </form>

      <div className="row" style={{ marginBottom: "2rem" }}>
        {actions.map(([to, label, Icon]) => (
          <Link key={to} className="btn btn-secondary" to={to}><Icon size={16} aria-hidden="true" /> {label}</Link>
        ))}
      </div>

      <section aria-labelledby="recent">
        <h2 id="recent">Recently added resources</h2>
        {recent.length ? (
          <div className="grid-cards">{recent.map((r) => <ResourceCard key={r.id} resource={r} showDate />)}</div>
        ) : (
          <EmptyState title="No resources available yet">{error || (loading ? "Loading available resources…" : "New study materials will appear here when they are added.")}</EmptyState>
        )}
      </section>

      <div className="grid-2" style={{ marginTop: "2rem", alignItems: "start" }}>
        <section aria-labelledby="saved">
          <div className="section-head"><h2 id="saved">Saved resources</h2><Link to="/library">Open My Library</Link></div>
          {saved.length ? (
            <div className="stack">{saved.map((r) => <ResourceCard key={r.id} resource={r} />)}</div>
          ) : (
            <EmptyState title="Nothing saved yet">Use Save on any resource to keep it here.</EmptyState>
          )}
        </section>
        <section aria-labelledby="explore">
          <h2 id="explore">Explore any department</h2>
          <div className="card">
            <p className="muted">You can browse every department, not only your own.</p>
            <Link className="btn btn-primary" to="/departments">Explore Departments</Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
