// app/(app)/staff-activity/[id]/page.tsx
// Tương đương staff_activity_detail.html + blueprints/staff_activity.py::
// detail() (Flask) — hoạt động của 1 thành viên team SS. Nhóm 3, Đợt 3.3,
// Phần 2/4. Phần thân (thống kê + 4 danh sách) dùng chung với
// /profile/activity qua components/staff-activity-view.tsx (Phần 1/4).
//
// CHỈ STAFF: requireStaff(). 2 luật của Flask giữ nguyên, chặn ở TẦNG
// ROUTE (không chỉ ẩn link ở danh sách — gõ thẳng URL cũng bị chặn), đúng
// plan Nhóm 3:
//   1. id trùng người đang đăng nhập -> redirect /profile/activity (tránh
//      2 nơi cùng hiển thị 1 dữ liệu).
//   2. id không phải nhân sự ss_team/admin (không tồn tại, hoặc là học
//      viên) -> 404.
// Danh sách staff tải 1 lần ở đây rồi truyền xuống StaffActivityView
// (prop `staff`) để component khỏi gọi GET /auth/users lần nữa.
// force-dynamic: đổi người phụ trách contact ngay trên trang này phải
// thấy ngay sau router.refresh() (cùng lý do /profile/activity).

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth-guard";
import { listStaffUsers, type StaffUser } from "@/lib/api/auth";
import { StaffActivityView } from "@/components/staff-activity-view";
import { ROLE_LABELS } from "@/lib/constants";
import { formatDateVN } from "@/lib/date";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Hoạt động team SS — MindX Career Hub",
};

export default async function StaffActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireStaff();
  const { id } = await params;

  if (id === user.ss_user_id) redirect("/profile/activity");

  let staff: StaffUser[] = [];
  let error: string | null = null;
  try {
    staff = await listStaffUsers();
  } catch (err) {
    error = err instanceof Error ? err.message : "Đã có lỗi khi tải danh sách thành viên.";
  }

  const member = staff.find((u) => u.ss_user_id === id);

  // Không tải được danh sách: KHÔNG kết luận "không có người này" (Flask
  // flash lỗi rồi 404) — hiện lỗi thật để khỏi nhầm với id sai.
  if (error) {
    return (
      <div className="space-y-6">
        <Link href="/staff-activity" className="text-sm underline">
          ← Hoạt động team SS
        </Link>
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      </div>
    );
  }
  if (!member) notFound();

  return (
    <div className="space-y-6">
      <Link href="/staff-activity" className="text-sm underline">
        ← Hoạt động team SS
      </Link>

      <header>
        <span className="text-sm text-muted-foreground">Career Hub / Quản trị / Hoạt động team SS</span>
        <h1 className="font-heading text-3xl font-semibold">{member.full_name}</h1>
        <p className="mt-1 text-muted-foreground">
          {member.email} · {ROLE_LABELS[member.role] ?? member.role} · Tạo tài khoản{" "}
          {formatDateVN(member.created_at)}
        </p>
      </header>

      <StaffActivityView ssUserId={member.ss_user_id} subject="other" staff={staff} />
    </div>
  );
}
