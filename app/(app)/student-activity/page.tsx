// app/(app)/student-activity/page.tsx
// Tương đương student_activity.html + blueprints/students.py::
// activity_index() (Flask) — "Hoạt động học viên". Nhóm 3, Đợt 3.3,
// Phần 3/4 (cùng với /student-activity/[id]).
//
// CHỈ STAFF (@staff_required bên Flask): requireStaff(). Tải toàn bộ
// user 1 lần, giữ role === "user" (học viên), lọc tên/email client-side
// trong StudentActivityTable — không phân trang, đúng plan Nhóm 3.
// force-dynamic: cùng nhóm staff-activity (Phần 4 mục 4 của plan).

import { requireStaff } from "@/lib/auth-guard";
import { listAllUsers, type StaffUser } from "@/lib/api/auth";
import { StudentActivityTable } from "./student-activity-table";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Hoạt động học viên — MindX Career Hub",
};

export default async function StudentActivityPage() {
  await requireStaff();

  let students: StaffUser[] = [];
  let error: string | null = null;
  try {
    students = (await listAllUsers()).filter((u) => u.role === "user");
  } catch (err) {
    error = err instanceof Error ? err.message : "Đã có lỗi khi tải danh sách học viên.";
  }

  return (
    <div className="space-y-6">
      <header>
        <span className="text-sm text-muted-foreground">Career Hub / Quản trị</span>
        <h1 className="font-heading text-3xl font-semibold">Hoạt động học viên</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Chọn 1 học viên để xem job họ đã ứng tuyển và đã lưu — dùng để chủ động hỗ trợ (nhắc deadline, gợi ý
          job phù hợp...) thay vì chờ học viên hỏi.
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <StudentActivityTable students={students} />
    </div>
  );
}
