// app/(app)/dashboard/dashboard-tabs.ts
// Danh sách 4 tab của /dashboard + hàm đọc `?tab=` — dùng chung giữa
// page.tsx (Server Component, đọc searchParams) và dashboard-tab-bar.tsx
// (Client Component, đổi tab). Không import gì từ React/Next để import
// được từ cả 2 phía.
//
// `ready: false` = tab CHƯA làm (Nhóm 3, Đợt 3.1 làm từng phần): hiện mờ,
// không bấm được — cùng quy ước `enabled: false` của profile-subnav/nav.ts.
// Làm xong tab nào thì đổi ready: true, không cần sửa chỗ nào khác ngoài
// nhánh render ở page.tsx.

export const DASHBOARD_TABS = [
  { id: "tong-quan", label: "Tổng quan", ready: true },
  { id: "hoc-vien", label: "Gợi ý học viên", ready: true },
  { id: "doanh-nghiep", label: "Doanh nghiệp", ready: true },
  { id: "bao-cao", label: "Báo cáo tháng", ready: false },
] as const;

export type DashboardTabId = (typeof DASHBOARD_TABS)[number]["id"];

export const DEFAULT_DASHBOARD_TAB: DashboardTabId = "tong-quan";

/** Giá trị `?tab=` lạ/thiếu/lặp -> "tong-quan" (khớp activate() bên Flask:
 *  tab không thuộc VALID_TABS thì rơi về "tong-quan", không lỗi). */
export function parseDashboardTab(raw: string | string[] | undefined): DashboardTabId {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const found = DASHBOARD_TABS.find((t) => t.id === value);
  return found ? found.id : DEFAULT_DASHBOARD_TAB;
}
