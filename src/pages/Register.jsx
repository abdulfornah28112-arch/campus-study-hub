import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { AuthShell } from "../components/Layout.jsx";
import { PasswordField, SelectField, TextField } from "../components/Ui.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { departments, LEVELS } from "../data/catalog.js";
import { useResources } from "../library/ResourceContext.jsx";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const scorePassword = (p) =>
  [p.length >= 8, /[a-z]/.test(p) && /[A-Z]/.test(p), /\d/.test(p), /[^A-Za-z0-9]/.test(p)].filter(Boolean).length;

const EMPTY = { name: "", studentId: "", email: "", department: "", level: "", password: "", confirm: "", terms: false };

export default function Register() {
  const { signUp } = useAuth();
  const { departments: apiDepartments } = useResources();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [requestError, setRequestError] = useState("");
  const [emailRateLimited, setEmailRateLimited] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | loading | failed | pending | active

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Enter your full name.";
    if (!form.studentId.trim()) e.studentId = "Enter your student ID.";
    if (!form.email.trim()) e.email = "Enter your email address.";
    else if (!EMAIL_RE.test(form.email.trim())) e.email = "Enter a valid email address.";
    if (!form.department) e.department = "Choose your department.";
    if (!form.level) e.level = "Choose your level.";
    if (!form.password) e.password = "Create a password.";
    else if (scorePassword(form.password) < 3) e.password = "Use at least 8 characters with a mix of letters, numbers, or symbols.";
    if (!form.confirm) e.confirm = "Confirm your password.";
    else if (form.confirm !== form.password) e.confirm = "Passwords don't match.";
    if (!form.terms) e.terms = "Accept the Terms and Privacy Policy to continue.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setStatus("loading");
    setRequestError("");
    setEmailRateLimited(false);
    try {
      const result = await signUp({ ...form });
      setStatus(result.status === "pending" ? "pending" : "active");
    } catch (error) {
      setStatus("failed");
      setEmailRateLimited(error.code === "EMAIL_RATE_LIMITED");
      setRequestError(error.message || "We couldn't create your account. Try again in a moment.");
    }
  };

  if (status === "pending" || status === "active") {
    const pending = status === "pending";
    return (
      <AuthShell>
        <div className="center">
          {pending ? <Clock size={40} aria-hidden="true" /> : <CheckCircle2 size={40} aria-hidden="true" />}
          <h1 style={{ marginTop: ".6rem" }}>{pending ? "Check your email" : "Account created"}</h1>
          <p className="muted">
            {pending
              ? `We created your account. Follow the confirmation link sent to ${form.email} before signing in. Check your spam folder if it is not in your inbox.`
              : "Your account is ready. Sign in to start exploring."}
          </p>
          <Link className="btn btn-primary" to="/login">Go to Sign In</Link>
        </div>
      </AuthShell>
    );
  }

  const loading = status === "loading";
  const strength = scorePassword(form.password);

  return (
    <AuthShell wide>
      <h1>Create Your Account</h1>
      <p className="muted">Join UniMak Study Hub and access learning resources in one place.</p>

      {status === "failed" && (
        <div className="alert alert-err" role="alert">
          <span>{requestError || "We couldn't create your account. Try again in a moment."}</span>
          {emailRateLimited && (
            <p>
              If you already submitted this address, check your inbox and spam folder before trying again.
              For ongoing limits, the project owner must configure custom SMTP in Supabase.
            </p>
          )}
        </div>
      )}

      <form onSubmit={submit} noValidate>
        <div className="form-grid">
          <TextField label="Full Name" value={form.name} onChange={set("name")} error={errors.name} autoComplete="name" disabled={loading} />
          <TextField label="Student ID" value={form.studentId} onChange={set("studentId")} error={errors.studentId} disabled={loading} />
        </div>
        <TextField label="Email Address" type="email" value={form.email} onChange={set("email")} error={errors.email} autoComplete="email" disabled={loading} placeholder="name@email.com" />
        <div className="form-grid">
          <SelectField label="Department" options={(apiDepartments.length ? apiDepartments : departments).map((d) => d.name)} value={form.department} onChange={set("department")} error={errors.department} disabled={loading} />
          <SelectField label="Academic Year or Level" options={LEVELS} value={form.level} onChange={set("level")} error={errors.level} disabled={loading} />
        </div>
        <div className="form-grid">
          <div>
            <PasswordField label="Password" value={form.password} onChange={set("password")} error={errors.password} autoComplete="new-password" disabled={loading} hint="At least 8 characters, mixing letters, numbers, or symbols." />
            <div className="strength" aria-hidden="true" style={{ marginTop: "-.6rem", marginBottom: "1rem" }}>
              {[1, 2, 3, 4].map((n) => <span key={n} className={strength >= n ? "on" : ""} />)}
            </div>
          </div>
          <PasswordField label="Confirm Password" value={form.confirm} onChange={set("confirm")} error={errors.confirm} autoComplete="new-password" disabled={loading} />
        </div>
        <div className="field">
          <label className="check" style={{ fontWeight: 400 }}>
            <input type="checkbox" checked={form.terms} onChange={set("terms")} disabled={loading} />
            <span>I agree to the <Link to="/about">Terms</Link> and <Link to="/about">Privacy Policy</Link>.</span>
          </label>
          {errors.terms && <p className="error-text" role="alert">{errors.terms}</p>}
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? <><Loader2 size={16} className="spin" aria-hidden="true" /> Creating account…</> : "Create Account"}
        </button>
      </form>

      <p className="center muted small" style={{ marginTop: "1.2rem", marginBottom: 0 }}>
        Already have an account? <Link to="/login">Sign In</Link>
      </p>
    </AuthShell>
  );
}
