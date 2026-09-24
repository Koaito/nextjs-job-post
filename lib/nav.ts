// lib/nav.ts
// Cấu hình menu sidebar — dịch từ <nav id="sidebarNav"> trong
// templates/base.html (Flask). Chỉ là dữ liệu + 2 hàm thuần (lọc theo
// quyền, xác định mục đang active) để AppSidebar (client component)
// không phải nhét cả bảng menu vào JSX.
//
// File này import icon (component function) nên CHỈ được import từ phía
// client (components/app-sidebar.tsx) — không truyền được qua ranh giới
// Server -> Client Component như props.

import {
  Activity,
  ArrowLeftRight,
  Briefcase,
  Building2,
  Contact,
  DatabaseZap,
  GraduationCap,
  LayoutDashboard,
  MessageSquare,
  Plus,
  ScrollText,
  UserCog,
  type LucideIcon,
} from "lucide-react";

/** Phần thông tin người dùng mà sidebar cần — cố ý KHÔNG truyền cả
 *  BackendUser xuống Client Component (tránh lộ field thừa vào HTML). */
export interface SidebarViewer {
  fullName: string;
  email: string;
  role: string;
  isStaff: boolean;
}

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** "unread-messages" -> gắn <UnreadBadge /> (SWR polling, xem
   *  components/unread-badge.tsx). */
  badge?: "unread-messages";
}

export interface NavGroup {
  label: string;
  /** everyone = kể cả khách; authenticated = đã đăng nhập (mọi role);
   *  staff = ss_team + admin (khớp current_user.is_staff bên Flask). */
  audience: "everyone" | "authenticated" | "staff";
  /** false = nhóm đã có trong bảng nhưng CHƯA hiện ra (route đích chưa
   *  làm). Bật lại bằng cách đổi thành true khi làm xong route. */
  enabled?: boolean;
  items: NavItem[];
}

// Thứ tự + nhãn + icon giữ đúng base.html. Quyết định đã chốt ở Round 5:
//   - Mọi mục nhóm staff hiện đủ, link thẳng (chấp nhận 404 tạm thời
//     tới khi làm đúng nhóm tương ứng ở plan).
//   - Nhóm "Nhắn tin" ẨN cho tới khi có /messages (Nhóm 4) — khi đó chỉ
//     cần đổi enabled: true, <UnreadBadge /> đã sẵn sàng.
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Việc làm",
    audience: "everyone",
    items: [{ label: "Danh sách job", href: "/jobs", icon: Briefcase }],
  },
  {
    label: "Nhắn tin",
    audience: "authenticated",
    enabled: false,
    items: [
      {
        label: "Tin nhắn",
        href: "/messages",
        icon: MessageSquare,
        badge: "unread-messages",
      },
    ],
  },
  {
    label: "Doanh nghiệp",
    audience: "staff",
    items: [
      { label: "Danh sách công ty", href: "/companies", icon: Building2 },
      { label: "Danh sách contact", href: "/contacts", icon: Contact },
    ],
  },
  {
    label: "Thêm mới",
    audience: "staff",
    items: [{ label: "Thêm mới", href: "/them-moi", icon: Plus }],
  },
  {
    label: "Báo cáo",
    audience: "staff",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Quản trị",
    audience: "staff",
    items: [
      { label: "Tài khoản team SS", href: "/staff-accounts", icon: UserCog },
      { label: "Hoạt động học viên", href: "/student-activity", icon: GraduationCap },
      { label: "Hoạt động team SS", href: "/staff-activity", icon: Activity },
      { label: "Lịch sử thao tác", href: "/activity-logs", icon: ScrollText },
      { label: "Xuất / Nhập dữ liệu", href: "/data-management", icon: ArrowLeftRight },
      { label: "Vận hành dữ liệu", href: "/crawl", icon: DatabaseZap },
    ],
  },
];

/** Lọc nhóm menu theo người xem (khách / học viên / staff). */
export function getVisibleNavGroups(viewer: SidebarViewer | null): NavGroup[] {
  return NAV_GROUPS.filter((group) => {
    if (group.enabled === false) return false;
    if (group.audience === "everyone") return true;
    if (!viewer) return false;
    if (group.audience === "authenticated") return true;
    return viewer.isStaff;
  });
}

/** Mục nào đang active: đúng path, hoặc path con (vd /jobs/abc, /jobs/abc/edit
 *  vẫn sáng mục "Danh sách job", khớp request.endpoint in
 *  ['jobs.index','jobs.detail'] bên Flask). */
export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
