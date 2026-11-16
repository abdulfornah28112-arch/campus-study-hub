import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Search } from "lucide-react";
import { PublicLayout } from "../components/Layout.jsx";
import { departments } from "../data/catalog.js";

export default function Home() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const onSearch = (event) => {
    event.preventDefault();
    navigate(`/departments${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`);
  };

  return (
    <PublicLayout className="home">
      <div className="container">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">UNIMAK STUDY HUB</p>
            <h1 id="hero-title">Your studies, in one place.</h1>
            <p className="lead">
              Find your department, browse learning resources, and keep useful materials close at hand.
            </p>
            <form className="search-bar" onSubmit={onSearch} role="search">
              <Search size={19} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search departments"
                aria-label="Search departments"
              />
              <button type="submit" className="btn btn-primary">Search</button>
            </form>
            <div className="row">
              <Link className="btn btn-primary" to="/departments">Browse departments</Link>
              <Link className="text-link" to="/study-materials">Study materials <ArrowRight size={15} aria-hidden="true" /></Link>
            </div>
          </div>
          <div className="hero-media">
            <img
              src="/images/campushub3.jpg"
              alt="Student reading in a university library"
            />
          </div>
        </section>

        <section className="section department-section" aria-labelledby="departments-title">
          <div className="section-head">
            <div>
              <p className="eyebrow">EXPLORE</p>
              <h2 id="departments-title">Departments</h2>
            </div>
            <Link className="text-link" to="/departments">View all <ArrowRight size={15} aria-hidden="true" /></Link>
          </div>
          <div className="department-list">
            {departments.map((department) => (
              <Link
                key={department.id}
                className="department-link"
                to={`/departments/${department.id}`}
              >
                <span>{department.name}</span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>

        <section className="section resource-links" aria-labelledby="resources-title">
          <div>
            <p className="eyebrow">LEARNING RESOURCES</p>
            <h2 id="resources-title">Make room for better study habits.</h2>
            <p className="muted">Browse materials or look for past examination questions.</p>
          </div>
          <div className="row">
            <Link className="btn btn-secondary" to="/study-materials">Study materials</Link>
            <Link className="btn btn-secondary" to="/past-questions">Past questions</Link>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
