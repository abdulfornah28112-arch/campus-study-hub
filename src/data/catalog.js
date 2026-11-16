export const departments = [
  { id: "computer-science", name: "Computer Science" },
  { id: "law", name: "Law" },
  { id: "public-health", name: "Public Health" },
  { id: "agriculture", name: "Agriculture" },
  { id: "mass-communication", name: "Mass Communication" },
  { id: "accounting", name: "Accounting" },
  { id: "public-administration", name: "Public Administration" },
  { id: "business-administration", name: "Business Administration" },
  { id: "nursing", name: "Nursing" },
  { id: "development-studies", name: "Development Studies" },
];

export const RESOURCE_TYPES = ["Lecture Notes", "Course Outline", "Assignment", "Study Guide", "Past Question"];
export const STUDY_TYPES = RESOURCE_TYPES.filter((type) => type !== "Past Question");
export const YEARS = ["2026", "2025", "2024", "2023"];
export const SEMESTERS = ["Semester 1", "Semester 2"];
export const EXAM_TYPES = ["End of semester", "Mid-semester", "Resit"];
export const LEVELS = ["Year 1", "Year 2", "Year 3", "Year 4"];
