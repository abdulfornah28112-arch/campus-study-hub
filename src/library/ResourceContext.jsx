import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";

const ResourceContext = createContext(null);

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function mapResource(resource) {
  const extension = resource.fileName?.split(".").pop()?.toUpperCase() || "FILE";
  const contentType = resource.contentType || "";
  const statuses = { VERIFIED: "Verified", PENDING: "Pending review", REJECTED: "Rejected" };
  return {
    id: resource.id,
    title: resource.title,
    description: resource.description || "",
    type: resource.type,
    department: resource.department,
    departmentId: resource.departmentId,
    courseCode: resource.courseCode || "",
    courseName: resource.courseName || "",
    year: resource.year || "",
    semester: resource.semester || "",
    examType: resource.examType || "",
    date: resource.date,
    status: statuses[resource.status] || resource.status,
    format: extension,
    size: formatSize(resource.fileSize),
    fileName: resource.fileName,
    previewType: contentType === "application/pdf" || extension === "PDF"
      ? "pdf"
      : contentType.startsWith("image/") || ["JPG", "JPEG", "PNG", "WEBP"].includes(extension)
        ? "image"
        : contentType === "text/plain" || extension === "TXT"
          ? "text"
          : null,
    hasFile: Boolean(resource.fileName),
  };
}

export function ResourceProvider({ children }) {
  const { user } = useAuth();
  const [resources, setResources] = useState([]);
  const [courses, setCourses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      apiRequest("/api/resources?size=100"),
      apiRequest("/api/courses"),
      apiRequest("/api/departments"),
    ])
      .then(([resourcePage, courseList, departmentList]) => {
        if (!active) return;
        setResources((resourcePage.content || []).map(mapResource));
        setCourses(courseList.map((course) => ({
          id: course.id,
          code: course.code,
          name: course.title,
          department: course.department,
        })));
        setDepartments(departmentList.map((department) => ({ id: department.id, name: department.name })));
      })
      .catch(() => {
        if (!active) return;
        setResources([]);
        setCourses([]);
        setDepartments([]);
        setError("Study resources are unavailable. Check that the backend is running and try again.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.id]);

  const value = useMemo(() => ({ resources, courses, departments, loading, error }), [resources, courses, departments, loading, error]);
  return <ResourceContext.Provider value={value}>{children}</ResourceContext.Provider>;
}

export const useResources = () => useContext(ResourceContext);
