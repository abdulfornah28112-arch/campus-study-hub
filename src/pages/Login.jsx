import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { AuthShell } from "../components/Layout.jsx";
import { PasswordField, TextField } from "../components/Ui.jsx";
import { useAuth } from "../auth/AuthContext.jsx";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [errors, setErrors] = useState({});
  const [requestError, setRequestError] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | invalid | accountInactive | network

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setStatus("idle");
  };

  const validate = () => {
    const next = {};
    const id = form.identifier.trim();
    if (!id) next.identifier = "Enter your email address or student ID.";
    else if (id.includes("@") && !EMAIL_RE.test(id)) next.identifier = "Enter a valid email address.";
    if (!form.password) next.password = "Enter your password.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e) => {
    e?.preventDefault();
    if (!validate()) return;
    setStatus("loading");
    setRequestError("");
    try {
      const signedInUser = await signIn({
        identifier: form.identifier.trim(),
        password: form.password,
      });
      setStatus("success");
      const destination = location.state?.from || (signedInUser.role === "admin" ? "/admin" : "/dashboard");
      navigate(destination, { replace: true });
    } catch (err) {
      setStatus(
        err.code === "EMAIL_NOT_CONFIRMED" ? "emailNotConfirmed" :
          err.code === "INVALID_CREDENTIALS" ? "invalid" :
          err.code === "ACCOUNT_NOT_ACTIVE" ? "accountInactive" :
            err.status ? "serverError" : "network"
      );
      if (err.status && err.code !== "INVALID_CREDENTIALS") setRequestError(err.message);
    }
  };

  const loading = status === "loading";

  return (
    <AuthShell>
      <h1>Welcome Back</h1>
      <p className="muted">Sign in to continue exploring your courses and study resources.</p>

      <div className="tabs" role="tablist" aria-label="Login type">
        <button type="button" role="tab" aria-selected="true">Student Login</button>
      </div>

      {status === "invalid" && (
        <div className="alert alert-err" role="alert">
          <span><AlertCircle size={16} aria-hidden="true" style={{ verticalAlign: "-3px" }} /> We couldn't sign you in. Check your details and try again.</span>
        </div>
      )}
      {status === "accountInactive" && (
        <div className="alert alert-err" role="alert">
          This account has been suspended. Contact the Study Hub administrator for help.
        </div>
      )}
      {status === "emailNotConfirmed" && (
        <div className="alert alert-err" role="alert">{requestError || "Confirm your email using the link we sent before signing in."}</div>
      )}
      {status === "network" && (
        <div className="alert alert-err" role="alert">
          <span>We couldn't reach the server. Check your connection.</span>
          <button type="button" onClick={submit}>Retry</button>
        </div>
      )}
      {status === "serverError" && (
        <div className="alert alert-err" role="alert">{requestError || "Sign-in could not be completed."}</div>
      )}
      {status === "success" && (
        <div className="alert alert-ok" role="status">
          <span><CheckCircle2 size={16} aria-hidden="true" style={{ verticalAlign: "-3px" }} /> Signed in. Taking you to your dashboard.</span>
        </div>
      )}

      <form onSubmit={submit} noValidate>
        <TextField label="Email Address or Student ID" type="text" value={form.identifier} onChange={set("identifier")} error={errors.identifier} autoComplete="username" disabled={loading} placeholder="name@email.com or student ID" />
        <PasswordField label="Password" value={form.password} onChange={set("password")} error={errors.password} autoComplete="current-password" disabled={loading} placeholder="Enter your password" />
        <div className="row between" style={{ marginBottom: "1.1rem" }}>
          <span className="hint">Your sign-in session expires after inactivity.</span>
          <Link to="/login" className="small">Forgot Password?</Link>
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? <><Loader2 size={16} className="spin" aria-hidden="true" /> Signing in…</> : "Sign In"}
        </button>
      </form>

      <p className="center muted small" style={{ marginTop: "1.2rem", marginBottom: 0 }}>
        Don't have an account? <Link to="/register">Create Account</Link>
      </p>
    </AuthShell>
  );
}
