import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Bookmark, BookOpen, Building2, FileQuestion, GraduationCap, LayoutDashboard,
  LogOut, Menu, Settings, ShieldCheck, Upload, X,
} from "lucide-react";
import ThemeToggle from "./ThemeToggle.jsx";
import { useAuth } from "../auth/AuthContext.jsx";

export function Logo({ to = "/" }) {
  return (
    <Link to={to} className="logo" aria-label="UniMak Study Hub home">
      <GraduationCap size={24} aria-hidden="true" />
      <span><strong>UNIMAK</strong><small>STUDY HUB</small></span>
    </Link>
  );
}

const publicLinks = [
  ["/", "Home"],
  ["/departments", "Departments"],
  ["/study-materials", "Study Materials"],
  ["/past-questions", "Past Questions"],
  ["/about", "About"],
];

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <nav aria-label="Footer">
          {[["/", "Home"], ["/departments", "Departments"], ["/study-materials", "Study Materials"], ["/past-questions", "Past Questions"], ["/about", "About"]].map(([to, label]) => (
            <Link key={label} to={to}>{label}</Link>
          ))}
        </nav>
        <p style={{ margin: 0 }}>© {new Date().getFullYear()} UniMak Study Hub. An independent student resource platform, not an official university website.</p>
      </div>
    </footer>
  );
}

export function PublicLayout({ children, className = "" }) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  return (
    <div className={`page ${className}`}>
      <header className="nav">
        <div className="container nav-inner">
          <Logo />
          <nav className="nav-links" aria-label="Main">
            {publicLinks.map(([to, label]) => (
              <NavLink key={label} to={to} end={to === "/"}>{label}</NavLink>
            ))}
          </nav>
          <div className="nav-actions">
            <ThemeToggle className="hide-sm" />
            {user ? (
              <Link className="btn btn-primary hide-sm" to="/dashboard">Dashboard</Link>
            ) : (
              <>
                <Link className="btn btn-ghost hide-sm" to="/login">Sign In</Link>
                <Link className="btn btn-primary hide-sm" to="/register">Create Account</Link>
              </>
            )}
            <button type="button" className="icon-btn menu-btn" onClick={() => setOpen((o) => !o)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
              {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
            </button>
          </div>
        </div>
        {open && (
          <div className="container mobile-menu">
            {publicLinks.map(([to, label]) => (
              <Link key={label} to={to} onClick={() => setOpen(false)}>{label}</Link>
            ))}
            <div className="row" style={{ marginTop: ".5rem" }}>
              <ThemeToggle />
              {user ? (
                <Link className="btn btn-primary" to="/dashboard">Dashboard</Link>
              ) : (
                <>
                  <Link className="btn btn-secondary" to="/login">Sign In</Link>
                  <Link className="btn btn-primary" to="/register">Create Account</Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>
      <main>{children}</main>
      <Footer />
    </div>
  );
}

export function AppShell({ children }) {
  const [open, setOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const items = [
    ["/dashboard", "Dashboard", LayoutDashboard],
    ["/departments", "Departments", Building2],
    ["/study-materials", "Study Materials", BookOpen],
    ["/past-questions", "Past Questions", FileQuestion],
    ["/library", "My Library", Bookmark],
    ...(user.canUpload !== false ? [["/upload", "Upload Materials", Upload]] : []),
    ["/settings", "Profile and Settings", Settings],
    ...(user.role === "admin" ? [["/admin", "Admin", ShieldCheck]] : []),
  ];
  const initials = user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="shell">
      <div className={`scrim ${open ? "open" : ""}`} onClick={() => setOpen(false)} />
      <aside className={`sidebar ${open ? "open" : ""}`} aria-label="Sidebar">
        <Logo to="/dashboard" />
        <nav className="side-nav" aria-label="App">
          {items.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} onClick={() => setOpen(false)} aria-label={label} title={label}>
              <Icon size={18} aria-hidden="true" />
              <span className="sidebar-label">{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <button type="button" className="btn btn-ghost btn-block" aria-label="Sign out" title="Sign out" onClick={async () => {
            try {
              await signOut();
            } catch (error) {
              window.alert(error.message || "Could not end the server session.");
            }
            navigate("/");
          }}>
            <LogOut size={16} aria-hidden="true" />
            <span className="sidebar-label">Sign out</span>
          </button>
        </div>
      </aside>
      <div>
        <div className="topbar">
          <button type="button" className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={18} aria-hidden="true" />
          </button>
          <div className="grow" />
          <ThemeToggle />
          <Link to="/settings" className="avatar" aria-label="Profile and settings" title={user.name}>{initials}</Link>
        </div>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}

export function PageFrame({ children }) {
  const { user } = useAuth();
  return user ? <AppShell>{children}</AppShell> : <PublicLayout>{children}</PublicLayout>;
}

export function AuthShell({ children, wide = false }) {
  return (
    <div className="auth">
      <div className="auth-top">
        <Link to="/" className="btn btn-ghost btn-sm">← Back to Home</Link>
        <ThemeToggle />
      </div>
      <div className="auth-main">
        <div className={`card auth-card ${wide ? "wide" : ""}`} style={{ padding: "1.75rem" }}>
          <Logo />
          {children}
        </div>
      </div>
    </div>
  );
}
