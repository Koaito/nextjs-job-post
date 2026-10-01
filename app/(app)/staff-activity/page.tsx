// app/(app)/staff-activity/page.tsx
// Tương đương staff_activity.html + blueprints/staff_activity.py::index()
// (Flask) — "Hoạt động team SS". Nhóm 3, Đợt 3.3, LÀM THEO TỪNG PHẦN:
//   [x] Phần 1/4 — tách components/staff-activity-view.tsx dùng chung
//   [x] Phần 2/4 — /staff-activity (danh sách, file này) + /staff-activity/[id]
//   [x] Phần 3/4 — /student-activity + /student-activity/[id]
//   [x] Phần 4/4 — route tải CV cho staff (GET /students/cv/<application_id>)
//
// CHỈ STAFF (@staff_required bên Flask): requireStaff() — ss_team xem
// được, không cần admin. Danh sách lấy 1 lần toàn bộ (không phân trang)
// rồi lọc tên/email thuần client-side trong StaffActivityTable — đúng
// plan Nhóm 3 (số nhân sự team SS luôn nhỏ).
// force-dynamic: cùng nhóm dashboard/staff-accounts (Phần 4 mục 4 của
// plan), không dựa vào cache trang cũ.

import Link from "next/link";
import { requireStaff } from "@/lib/auth-guard";
import { listStaffUsers, type StaffUser } from "@/lib/api/auth";
import { StaffActivityTable } from "./staff-activity-table";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Hoạt động team SS — MindX Career Hub",
};

export default async function StaffActivityPage() {
  const user = await requireStaff();

  let staff: StaffUser[] = [];
  let error: string | null = null;
  try {
    staff = await listStaffUsers();
  } catch (err) {
    error = err instanceof Error ? err.message : "Đã có lỗi khi tải danh sách thành viên.";
  }

  return (
    <div className="space-y-6">
      <header>
        <span className="text-sm text-muted-foreground">Career Hub / Quản trị</span>
        <h1 className="font-heading text-3xl font-semibold">Hoạt động team SS</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Chọn 1 thành viên để xem job/công ty/contact họ đã tự thêm tay, và contact đang được giao cho họ
          phụ trách — dùng để nắm ai đang làm việc gì. Xem hoạt động của chính bạn? Vào{" "}
          <Link href="/profile/activity" className="underline">
            Trang cá nhân
          </Link>
          .
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <StaffActivityTable staff={staff} currentUserId={user.ss_user_id} />
    </div>
  );
}
