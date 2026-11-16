export const courses = [];
export const resources = [];
export const publicResources = resources;

export const isPublic = (resource) => resource.status === "Verified" || resource.status === "Unverified";

export const byNewest = (a, b) => b.date.localeCompare(a.date);

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
