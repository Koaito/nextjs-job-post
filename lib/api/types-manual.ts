// lib/api/types-manual.ts
//
// TẠM THỜI viết tay — chỉ chứa các type tối thiểu cần cho Phần 2 (auth
// layer). Theo Phần 1 mục 2.5 của plan, các type còn lại (Job, Company,
// Contact...) PHẢI sinh tự động bằng `openapi-typescript` từ
// /openapi.json của Scrap_JD, không tự gõ tay.
//
// Cách generate (làm 1 lần, không chạy trong CI):
//   1. Set ENABLE_DOCS=true tạm thời ở Scrap_JD (local/staging, KHÔNG
//      bật ở production — xem Phần 1 mục 2.5).
//   2. npx openapi-typescript http://localhost:8000/openapi.json \
//        -o lib/api/types.ts
//   3. Tắt lại ENABLE_DOCS.
//
// Sau khi có lib/api/types.ts thật, có thể xoá file này và import
// BackendUser cùng các type khác trực tiếp từ types.ts.

export interface BackendUser {
  ss_user_id: string;
  email: string;
  full_name: string;
  role: "user" | "ss_team" | "admin";
  is_active: boolean;
  is_staff: boolean; // true nếu role là ss_team hoặc admin
  must_change_password: boolean;
  phone?: string | null;
  track?: string | null;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
}
