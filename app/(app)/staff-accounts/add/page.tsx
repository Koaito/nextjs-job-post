// app/(app)/staff-accounts/add/page.tsx
// Tương đương staff_account_add.html + blueprints/staff.py::add() (Flask).
// Nhóm 3, Đợt 3.2, Phần 2/4.
//
// requireAdmin() (plan Phần 2 mục 4): ss_team KHÔNG vào được trang này —
// khác Flask (redirect về danh sách kèm flash), Next.js trả 404 giống mọi
// route admin-only khác (xem lib/auth-guard.ts). Nút "Thêm tài khoản" ở
// danh sách cũng chỉ hiện với admin nên ss_team bình thường không gặp.

import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guard";
import { AddStaffAccountForm } from "./add-staff-account-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Thêm tài khoản team SS — MindX Career Hub",
};

export default async function AddStaffAccountPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <Link href="/staff-accounts" className="text-sm text-muted-foreground hover:underline">
        ← Tài khoản team SS
      </Link>

      <header>
        <span className="text-sm text-muted-foreground">Career Hub / Quản trị</span>
        <h1 className="font-heading text-3xl font-semibold">Thêm tài khoản mới</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Backend tự sinh mật khẩu tạm — bạn sẽ thấy mật khẩu này ĐÚNG 1 LẦN ngay sau khi tạo, tự gửi cho
          người dùng qua kênh nội bộ (Slack/nói miệng). Tài khoản mới bắt buộc đổi mật khẩu ngay lần đăng
          nhập đầu.
        </p>
      </header>

      <AddStaffAccountForm />
    </div>
  );
}
