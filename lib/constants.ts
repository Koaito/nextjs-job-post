// lib/constants.ts
// Tương đương constants.py bên Flask — dữ liệu tĩnh, không cần fetch.
// (Phần 2 mục 5 của plan: context_processor inject_role_labels -> import
// thẳng constant, không qua Provider)

// Danh sách ngành nghề cho dropdown "track" ở form đăng ký — copy y hệt
// constants.py (INDUSTRIES) để không lệch với validate phía backend.
export const INDUSTRIES = [
  "Code",
  "Data Analysis",
  "Data Engineer",
  "Data Scientist",
  "Business Analysis",
  "UI/UX Design",
] as const;

export const TRACK_OTHER = "Khác / Chưa xác định";

export const ROLE_LABELS: Record<string, string> = {
  user: "Học viên",
  ss_team: "SS Team",
  admin: "Admin",
};
