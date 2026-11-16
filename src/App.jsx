import { Routes, Route, Navigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "./auth/AuthContext.jsx";
import { PageFrame } from "./components/Layout.jsx";
import Home from "./pages/Home.jsx";
import Departments from "./pages/Departments.jsx";
import About from "./pages/About.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import StudyMaterials from "./pages/StudyMaterials.jsx";
import PastQuestions from "./pages/PastQuestions.jsx";
import ResourceDetails from "./pages/ResourceDetails.jsx";
import MyLibrary from "./pages/MyLibrary.jsx";
import UploadMaterials from "./pages/UploadMaterials.jsx";
import ProfileSettings from "./pages/ProfileSettings.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";

function Protected({ children, admin = false }) {
  const { user, loading, authError } = useAuth();
  const location = useLocation();
  if (loading) return <PageFrame><div className="container section"><p role="status">Restoring your session…</p></div></PageFrame>;
  if (authError) return <PageFrame><div className="container section"><p className="alert alert-err" role="alert">{authError}</p></div></PageFrame>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (admin && user.role !== "admin") return <Navigate to="/dashboard" replace />;
  return children;
}

function NotFound() {
  return (
    <PageFrame>
      <div className="container section">
        <h1>Page not found</h1>
        <p className="muted">The page may have moved or no longer exists.</p>
        <Link className="btn btn-primary" to="/">Back to Home</Link>
      </div>
    </PageFrame>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/departments" element={<Departments />} />
      <Route path="/departments/:id" element={<Departments />} />
      <Route path="/about" element={<About />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/study-materials" element={<StudyMaterials />} />
      <Route path="/past-questions" element={<PastQuestions />} />
      <Route path="/resources/:id" element={<ResourceDetails />} />
      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="/library" element={<Protected><MyLibrary /></Protected>} />
      <Route path="/upload" element={<Protected><UploadMaterials /></Protected>} />
      <Route path="/settings" element={<Protected><ProfileSettings /></Protected>} />
      <Route path="/admin" element={<Protected admin><AdminDashboard /></Protected>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
