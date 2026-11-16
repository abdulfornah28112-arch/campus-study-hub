import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { AppShell } from "../components/Layout.jsx";
import { PageHeader, SelectField, TextField } from "../components/Ui.jsx";
import { EXAM_TYPES, RESOURCE_TYPES, SEMESTERS, YEARS } from "../data/catalog.js";
import { apiRequest } from "../api/client.js";
import { useResources } from "../library/ResourceContext.jsx";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const DOCUMENT_EXTENSIONS = [".pdf", ".doc", ".docx", ".ppt", ".pptx", ".txt", ".rtf", ".odt", ".odp"];
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const EMPTY_FORM = { title: "", department: "", course: "", type: "", year: "", semester: "", examType: "", description: "", file: null, image: null, declaration: false };

function hasAllowedExtension(file, extensions) {
  const name = file.name.toLowerCase();
  return extensions.some((extension) => name.endsWith(extension));
}

export default function UploadMaterials() {
  const { departments, error: catalogError } = useResources();
  const documentInput = useRef(null);
  const imageInput = useRef(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [imageError, setImageError] = useState("");
  const [status, setStatus] = useState("idle");
  const [imagePreview, setImagePreview] = useState("");

  useEffect(() => {
    if (!form.image) {
      setImagePreview("");
      return undefined;
    }

    const previewUrl = URL.createObjectURL(form.image);
    setImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [form.image]);

  const setField = (name) => (event) => {
    setForm((current) => ({ ...current, [name]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setStatus("idle");
  };

  const selectDocument = (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = "";
    if (file && !hasAllowedExtension(file, DOCUMENT_EXTENSIONS)) {
      setForm((current) => ({ ...current, file: null }));
      setErrors((current) => ({ ...current, file: "Use a PDF, Word, PowerPoint, text, RTF, or OpenDocument file." }));
      setStatus("idle");
      return;
    }
    if (file && file.size > MAX_FILE_SIZE) {
      setForm((current) => ({ ...current, file: null }));
      setErrors((current) => ({ ...current, file: "Files must be 20 MB or smaller." }));
      setStatus("idle");
      return;
    }
    setForm((current) => ({ ...current, file }));
    setErrors((current) => ({ ...current, file: undefined }));
    setStatus("idle");
  };

  const selectImage = (event) => {
    const image = event.target.files?.[0];
    event.target.value = "";
    setStatus("idle");
    if (!image) return;
    if (!hasAllowedExtension(image, IMAGE_EXTENSIONS)) {
      setImageError("Choose a JPG, JPEG, PNG, or WebP image.");
      return;
    }
    if (image.size > MAX_IMAGE_SIZE) {
      setImageError("Images must be 5 MB or smaller.");
      return;
    }
    setForm((current) => ({ ...current, image }));
    setImageError("");
  };

  const removeImage = () => {
    setForm((current) => ({ ...current, image: null }));
    setImageError("");
    setStatus("idle");
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.title.trim()) nextErrors.title = "Enter a title.";
    if (!form.department) nextErrors.department = "Choose a department.";
    if (!form.course.trim()) nextErrors.course = "Enter the course name or code.";
    if (!form.type) nextErrors.type = "Choose a material type.";
    if (!form.year) nextErrors.year = "Choose an academic year.";
    if (!form.semester) nextErrors.semester = "Choose a semester.";
    if (form.type === "Past Question" && !form.examType) nextErrors.examType = "Choose an examination type.";
    if (!form.file) nextErrors.file = "Choose a file to upload.";
    else if (!hasAllowedExtension(form.file, DOCUMENT_EXTENSIONS)) nextErrors.file = "Use a PDF, Word, PowerPoint, text, RTF, or OpenDocument file.";
    else if (form.file.size > MAX_FILE_SIZE) nextErrors.file = "Files must be 20 MB or smaller.";
    if (imageError) nextErrors.image = imageError;
    if (!form.declaration) nextErrors.declaration = "Confirm that you have the right to share this material.";
    setErrors(nextErrors);
    return Object.values(nextErrors).every((error) => !error);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!validate()) return;
    setStatus("loading");
    setErrors({});
    const body = new FormData();
    body.set("title", form.title.trim());
    body.set("description", form.description);
    body.set("type", form.type);
    body.set("departmentId", departments.find((department) => department.name === form.department)?.id || "");
    body.set("courseLabel", form.course.trim());
    body.set("year", form.year);
    body.set("semester", form.semester);
    if (form.examType) body.set("examType", form.examType);
    body.set("file", form.file);
    try {
      await apiRequest("/api/resources", { method: "POST", body });
      setStatus("submitted");
    } catch (error) {
      setStatus("failed");
      setErrors((previous) => ({ ...previous, submit: error.message || "The upload could not be completed." }));
    }
  };

  return (
    <AppShell>
      <PageHeader title="Upload Materials" subtitle="Choose a study document and optionally attach an image. Uploading requires a connected backend." />
      {catalogError && <div className="alert alert-err" role="alert">{catalogError}</div>}
      <form className="card" style={{ maxWidth: 720 }} onSubmit={submit} noValidate>
        <TextField label="Material title" value={form.title} onChange={setField("title")} error={errors.title} />
        <div className="form-grid">
          <SelectField label="Department" options={departments.map((department) => department.name)} value={form.department} onChange={setField("department")} error={errors.department} disabled={!departments.length} />
          <TextField label="Course name or code" value={form.course} onChange={setField("course")} error={errors.course} placeholder="e.g. CSC 101" />
          <SelectField label="Material type" options={RESOURCE_TYPES} value={form.type} onChange={setField("type")} error={errors.type} />
          {form.type === "Past Question" && <SelectField label="Examination type" options={EXAM_TYPES} value={form.examType} onChange={setField("examType")} error={errors.examType} />}
          <SelectField label="Academic year" options={YEARS} value={form.year} onChange={setField("year")} error={errors.year} />
          <SelectField label="Semester" options={SEMESTERS} value={form.semester} onChange={setField("semester")} error={errors.semester} />
        </div>
        <div className="field"><label htmlFor="description">Description (optional)</label><textarea id="description" className="input" value={form.description} onChange={setField("description")} /></div>
        <div className="field">
          <label htmlFor="material-file">Academic document</label>
          <input id="material-file" ref={documentInput} type="file" className="sr-only" accept={DOCUMENT_EXTENSIONS.join(",")} onChange={selectDocument} aria-invalid={Boolean(errors.file)} />
          <button type="button" className="btn btn-secondary" onClick={() => documentInput.current?.click()}>Choose document</button>
          {form.file && <p className="hint" role="status">{form.file.name}</p>}
          <p className="hint">PDF, Word, PowerPoint, TXT, RTF, or OpenDocument; maximum 20 MB.</p>
          {errors.file && <p className="error-text" role="alert">{errors.file}</p>}
        </div>
        <div className="field">
          <span className="field-label">Optional image</span>
          <input ref={imageInput} type="file" className="sr-only" accept={IMAGE_EXTENSIONS.join(",")} onChange={selectImage} aria-label="Choose an image to attach" />
          <div className="row">
            <button type="button" className="btn btn-secondary" onClick={() => imageInput.current?.click()}><ImagePlus size={16} aria-hidden="true" /> Upload Image</button>
            {form.image && <button type="button" className="btn btn-ghost" onClick={removeImage}><X size={16} aria-hidden="true" /> Remove image</button>}
          </div>
          <p className="hint">JPG, JPEG, PNG, or WebP; maximum 5 MB. This optional image is only a local preview; the academic document is uploaded.</p>
          {imageError && <p className="error-text" role="alert">{imageError}</p>}
          {form.image && (
            <div className="upload-image">
              <img src={imagePreview} alt={`Preview of ${form.image.name}`} />
              <span className="small">{form.image.name}</span>
            </div>
          )}
        </div>
        <div className="field"><label className="check" style={{ fontWeight: 400 }}><input type="checkbox" checked={form.declaration} onChange={setField("declaration")} /><span>I have the right to share this material.</span></label>{errors.declaration && <p className="error-text" role="alert">{errors.declaration}</p>}</div>
        {status === "failed" && <div className="alert alert-err" role="alert">{errors.submit}</div>}
        {status === "submitted" && <div className="alert alert-ok" role="status">Your material was uploaded and is pending administrator review.</div>}
        <button type="submit" className="btn btn-primary" disabled={status === "loading"}>{status === "loading" ? "Uploading…" : "Submit for review"}</button>
      </form>
    </AppShell>
  );
}
