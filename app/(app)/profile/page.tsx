// app/(app)/profile/page.tsx
// Tương đương profile_overview.html + profile.index() (Flask) — "Thông
// tin chung": xem lại thông tin tài khoản + sửa họ tên (mọi role) và
// phone/định hướng ngành (chỉ học viên). Nhóm 5, Đợt 5.1 của plan.
//
// Mọi role đăng nhập đều vào được (Flask: @login_required) nên dùng
// requireUser(), không phải requireStaff().
//
// Dữ liệu form lấy từ getCurrentUser() (GET /auth/me, luôn mới nhất) chứ
// không từ cookie/JWT — sau khi lưu, server action revalidate layout nên
// sidebar cũng hiện tên mới ngay.

import { requireUser } from "@/lib/auth-guard";
import { ROLE_LABELS } from "@/lib/constants";
import { ProfileForm } from "./profile-form";
import { formatDateVN } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser();
  const isStudent = !user.is_staff;

  return (
    <div className="max-w-2xl space-y-6">
      <p className="text-muted-foreground">Xem lại thông tin tài khoản và cập nhật họ tên hiển thị.</p>

      <dl className="grid grid-cols-1 gap-4 rounded-md border p-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Email</dt>
          <dd className="break-all text-sm font-medium">{user.email}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Vai trò</dt>
          <dd className="text-sm font-medium">{ROLE_LABELS[user.role] ?? user.role}</dd>
        </div>
        {user.created_at && (
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Tham gia từ</dt>
            <dd className="text-sm font-medium">{formatDateVN(user.created_at)}</dd>
          </div>
        )}
      </dl>

      <ProfileForm
        isStudent={isStudent}
        initialValues={{
          fullName: user.full_name,
          phone: user.phone ?? "",
          track: user.track ?? "",
        }}
      />
    </div>
  );
}
