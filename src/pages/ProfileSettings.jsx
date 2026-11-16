import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { AppShell } from "../components/Layout.jsx";
import { PageHeader, PasswordField, SelectField, TextField } from "../components/Ui.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { useTheme } from "../theme/ThemeContext.jsx";
import { departments, LEVELS } from "../data/catalog.js";
import { useResources } from "../library/ResourceContext.jsx";

export default function ProfileSettings() {
  const { user, updateProfile, changePassword } = useAuth();
  const { departments: apiDepartments } = useResources();
  const { theme, followsDevice, setTheme, useDeviceTheme } = useTheme();

  const [profile, setProfile] = useState({ name: user.name, studentId: user.studentId || "", department: user.department || "", level: user.level || "" });
  const [profileErrors, setProfileErrors] = useState({});
  const [profileStatus, setProfileStatus] = useState("idle");
  const [profileError, setProfileError] = useState("");

  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwErrors, setPwErrors] = useState({});
  const [pwStatus, setPwStatus] = useState("idle");
  const [pwError, setPwError] = useState("");

  const setP = (k) => (e) => setProfile((p) => ({ ...p, [k]: e.target.value }));
  const setW = (k) => (e) => setPw((p) => ({ ...p, [k]: e.target.value }));

  const saveProfile = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!profile.name.trim()) errs.name = "Enter your full name.";
    if (!profile.department) errs.department = "Choose your department.";
    setProfileErrors(errs);
    if (Object.keys(errs).length) return;
    setProfileStatus("loading");
    setProfileError("");
    try {
      await updateProfile({ ...profile, name: profile.name.trim() });
      setProfileStatus("saved");
    } catch (error) {
      setProfileStatus("idle");
      setProfileError(error.message || "Profile could not be saved.");
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!pw.current) errs.current = "Enter your current password.";
    if (pw.next.length < 8) errs.next = "Use at least 8 characters.";
    if (pw.confirm !== pw.next) errs.confirm = "Passwords don't match.";
    setPwErrors(errs);
    if (Object.keys(errs).length) return;
    setPwStatus("loading");
    setPwError("");
    try {
      await changePassword(pw.current, pw.next);
      setPw({ current: "", next: "", confirm: "" });
      setPwStatus("saved");
    } catch (error) {
      setPwStatus("idle");
      setPwError(error.message || "Password could not be updated.");
    }
  };

  const mode = followsDevice ? "device" : theme;
  const pick = (value) => (value === "device" ? useDeviceTheme() : setTheme(value));

  return (
    <AppShell>
      <PageHeader title="Profile and Settings" subtitle="Manage your details, theme, and password." />
      <div className="stack" style={{ maxWidth: 720 }}>
        <section className="card" aria-labelledby="p-title">
          <h2 id="p-title">Profile</h2>
          {profileStatus === "saved" && <div className="alert alert-ok" role="status"><span><CheckCircle2 size={16} aria-hidden="true" style={{ verticalAlign: "-3px" }} /> Profile saved.</span></div>}
          {profileError && <div className="alert alert-err" role="alert">{profileError}</div>}
          <form onSubmit={saveProfile} noValidate>
            <div className="form-grid">
              <TextField label="Full Name" value={profile.name} onChange={setP("name")} error={profileErrors.name} />
              <TextField label="Student ID" value={profile.studentId} onChange={setP("studentId")} />
            </div>
            <TextField label="Email Address" value={user.email} readOnly hint="Contact an administrator to change your email." />
            <div className="form-grid">
              <SelectField label="Department" options={(apiDepartments.length ? apiDepartments : departments).map((d) => d.name)} value={profile.department} onChange={setP("department")} error={profileErrors.department} />
              <SelectField label="Academic Year or Level" options={LEVELS} value={profile.level} onChange={setP("level")} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={profileStatus === "loading"}>
              {profileStatus === "loading" ? <><Loader2 size={16} className="spin" aria-hidden="true" /> Saving…</> : "Save changes"}
            </button>
          </form>
        </section>

        <section className="card" aria-labelledby="t-title">
          <h2 id="t-title">Appearance</h2>
          <p className="muted small">Your choice applies to every page and is remembered on this device.</p>
          <div className="radio-cards" role="radiogroup" aria-label="Theme">
            {[["light", "Light Mode"], ["dark", "Dark Mode"], ["device", "Use device setting"]].map(([value, label]) => (
              <label key={value}>
                <input type="radio" name="theme" checked={mode === value} onChange={() => pick(value)} /> {label}
              </label>
            ))}
          </div>
        </section>

        <section className="card" aria-labelledby="pw-title">
          <h2 id="pw-title">Password</h2>
          {pwStatus === "saved" && <div className="alert alert-ok" role="status"><span>Password updated.</span></div>}
          {pwError && <div className="alert alert-err" role="alert">{pwError}</div>}
          <form onSubmit={savePassword} noValidate>
            <PasswordField label="Current password" value={pw.current} onChange={setW("current")} error={pwErrors.current} autoComplete="current-password" />
            <div className="form-grid">
              <PasswordField label="New password" value={pw.next} onChange={setW("next")} error={pwErrors.next} autoComplete="new-password" />
              <PasswordField label="Confirm new password" value={pw.confirm} onChange={setW("confirm")} error={pwErrors.confirm} autoComplete="new-password" />
            </div>
            <button type="submit" className="btn btn-secondary" disabled={pwStatus === "loading"}>
              {pwStatus === "loading" ? "Updating…" : "Update password"}
            </button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
