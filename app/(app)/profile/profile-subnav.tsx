"use client";
// app/(app)/profile/profile-subnav.tsx
// Sub-nav ngang của khu "Trang cá nhân" — tương đương _profile_subnav.html
// (Flask). Tab đang active suy ra từ pathname (mỗi tab là 1 route thật).
//
// Mục nào hiện tuỳ role (khớp Flask):
//   - Thông tin chung, Bảo mật: mọi role.
//   - Job đã lưu, Đã ứng tuyển: CHỈ học viên (vô nghĩa với team SS/admin).
//   - Hoạt động: CHỈ team SS/admin.
//
// Mục có `enabled: false` = route đích chưa làm -> hiện mờ, không bấm
// được (thay vì dẫn tới 404; cùng cách tab "Quản lý mẫu email" từng bị
// disabled ở /contacts trước khi làm xong). "Hoạt động" đã làm xong ở Đợt
// 5.4 (app/(app)/profile/activity/page.tsx) — không còn mục nào bị tắt ở
// sub-nav này nữa; 2 mục học viên (saved-jobs, applications) đã bật ở Đợt
// 5.2/5.3.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface SubnavItem {
  href: string;
  label: string;
  audience: "all" | "student" | "staff";
  enabled?: boolean;
}

const ITEMS: SubnavItem[] = [
  { href: "/profile", label: "Thông tin chung", audience: "all" },
  { href: "/profile/security", label: "Bảo mật", audience: "all" },
  { href: "/profile/saved-jobs", label: "Job đã lưu", audience: "student" },
  { href: "/profile/applications", label: "Đã ứng tuyển", audience: "student" },
  { href: "/profile/activity", label: "Hoạt động", audience: "staff" },
];

export function ProfileSubnav({ isStaff }: { isStaff: boolean }) {
  const pathname = usePathname();

  const visible = ITEMS.filter((item) => {
    if (item.audience === "all") return true;
    return item.audience === "staff" ? isStaff : !isStaff;
  });

  return (
    <nav aria-label="Trang cá nhân" className="flex flex-wrap gap-1 border-b">
      {visible.map((item) => {
        const base = "-mb-px border-b-2 px-4 py-2 text-sm font-medium";

        if (item.enabled === false) {
          return (
            <span
              key={item.href}
              aria-disabled="true"
              title="Sắp có"
              className={cn(base, "cursor-not-allowed border-transparent text-muted-foreground/50")}
            >
              {item.label}
            </span>
          );
        }

        // "/profile" chỉ active đúng chính nó (không theo tiền tố, vì mọi
        // tab khác cũng bắt đầu bằng "/profile/").
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              base,
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
