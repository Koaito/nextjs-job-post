// app/(app)/profile/activity/page.tsx
// Tương đương profile_activity.html + blueprints/profile.py::activity()
// (Flask) — "Hoạt động của bạn". Nhóm 5, Đợt 5.4 của plan. Khung (tiêu đề
// "Trang cá nhân" + sub-nav) nằm ở profile/layout.tsx.
//
// CHỈ STAFF: requireStaff() (học viên không tự tạo job/công ty/contact,
// mục "Hoạt động" cũng không hiện với họ trong sub-nav — @staff_required ở
// Flask, KHÔNG phải @login_required như 2 route overview/security).
//
// Cùng dữ liệu/logic với /staff-activity/[id] (Nhóm 3, Đợt 3.3) — trang
// đó cho staff/admin xem hoạt động của NGƯỜI KHÁC, trang này chỉ xem của
// CHÍNH MÌNH (ss_user_id luôn = user hiện tại, không nhận tham số nào từ
// URL). Phần thân (thống kê + 4 danh sách + lấy dữ liệu song song) đã tách
// ra components/staff-activity-view.tsx để 2 trang dùng chung, đúng như
// plan Nhóm 3 dặn (không viết trùng).
// force-dynamic (no-store, cùng nhóm dashboard/staff-activity ở Phần 4 mục
// 4 của plan): đổi người phụ trách/trạng thái contact ở chính trang này
// phải thấy ngay khi router.refresh(), không đợi cache.

import { requireStaff } from "@/lib/auth-guard";
import { StaffActivityView } from "@/components/staff-activity-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Hoạt động — Trang cá nhân — MindX Career Hub",
};

export default async function ProfileActivityPage() {
  const user = await requireStaff();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-semibold">Hoạt động của bạn</h2>
        <p className="text-muted-foreground">
          Job/công ty/contact bạn đã tự thêm tay, và contact đang được giao cho bạn phụ trách.
        </p>
      </div>

      <StaffActivityView ssUserId={user.ss_user_id} subject="self" />
    </div>
  );
}
