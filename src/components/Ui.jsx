import { useId, useState } from "react";
import { Eye, EyeOff, Inbox, Search } from "lucide-react";

export function StatusBadge({ status }) {
  const tone = { Verified: "badge-ok", Unverified: "badge-warn", "Pending review": "badge-warn", Rejected: "badge-err" };
  return <span className={`badge ${tone[status] || ""}`}>{status}</span>;
}

export function TextField({ label, error, hint, className = "", ...props }) {
  const id = useId();
  const describedBy = error ? `${id}-e` : hint ? `${id}-h` : undefined;
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      <input id={id} className={`input ${error ? "has-error" : ""}`} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...props} />
      {hint && !error && <p id={`${id}-h`} className="hint">{hint}</p>}
      {error && <p id={`${id}-e`} className="error-text" role="alert">{error}</p>}
    </div>
  );
}

export function PasswordField({ label, error, hint, className = "", ...props }) {
  const id = useId();
  const [show, setShow] = useState(false);
  const describedBy = error ? `${id}-e` : hint ? `${id}-h` : undefined;
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      <div className="input-wrap">
        <input id={id} type={show ? "text" : "password"} className={`input ${error ? "has-error" : ""}`} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...props} />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
          {show ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
      {hint && !error && <p id={`${id}-h`} className="hint">{hint}</p>}
      {error && <p id={`${id}-e`} className="error-text" role="alert">{error}</p>}
    </div>
  );
}

export function SelectField({ label, error, options, placeholder = "Select", className = "", ...props }) {
  const id = useId();
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      <select id={id} className={`input ${error ? "has-error" : ""}`} aria-invalid={Boolean(error)} {...props}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      {error && <p className="error-text" role="alert">{error}</p>}
    </div>
  );
}

export function FilterSelect({ label, value, onChange, options, allLabel }) {
  return (
    <select className="input" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{allLabel || `All ${label.toLowerCase()}s`}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

export function SearchInput({ value, onChange, placeholder, label = "Search" }) {
  return (
    <div className="search-bar" style={{ margin: "0 0 1rem", boxShadow: "none" }}>
      <Search size={18} aria-hidden="true" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} />
    </div>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="empty">
      <Inbox size={34} aria-hidden="true" />
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="section-head" style={{ marginBottom: "1.2rem" }}>
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted" style={{ margin: 0 }}>{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
