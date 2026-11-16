import axios from "axios";

export const API_BASE_URL = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:8000"
).replace(/\/+$/, "");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

let csrfRequest;

async function csrfToken() {
  if (!csrfRequest) {
    csrfRequest = api.get("/api/auth/csrf")
      .then(({ data }) => data.token)
      .finally(() => { csrfRequest = null; });
  }
  return csrfRequest;
}

api.interceptors.request.use(async (config) => {
  const method = (config.method || "GET").toUpperCase();
  if (!SAFE_METHODS.has(method)) {
    config.headers.set("X-XSRF-TOKEN", await csrfToken());
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || "";
    if (status === 401 && !url.includes("/api/auth/login") && !url.includes("/api/auth/register")) {
      window.dispatchEvent(new Event("unimak-auth-expired"));
    }
    const body = error.response?.data;
    const message = body?.detail || body?.message || error.message || "The request could not be completed.";
    const validationMessage = Array.isArray(message)
      ? message.map((issue) => {
        const field = issue.loc?.filter((part) => !["body", "query", "path"].includes(part)).join(" ");
        const label = field ? `${field.charAt(0).toUpperCase()}${field.slice(1)}: ` : "";
        return `${label}${issue.msg || "Invalid value."}`;
      }).join(" ")
      : message;
    return Promise.reject(new ApiError(
      validationMessage,
      status,
      body?.code,
    ));
  },
);

export async function apiRequest(path, options = {}) {
  const { body, ...requestOptions } = options;
  const headers = { ...requestOptions.headers };
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isFormData && !Object.keys(headers).some((key) => key.toLowerCase() === "content-type")) {
    headers["Content-Type"] = "application/json";
  }
  const response = await api.request({
    url: path,
    ...requestOptions,
    headers,
    data: body,
  });
  return response.status === 204 ? null : response.data;
}

export async function downloadFile(path, fileName) {
  try {
    const response = await api.get(path, { responseType: "blob" });
    const blob = response.data;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    window.alert(error.message || "The file could not be downloaded.");
  }
}
