// app/(app)/profile/layout.tsx
// Khung chung của khu "Trang cá nhân" (/profile/...) — tương đương phần
// đầu chung của profile_*.html + _profile_subnav.html (Flask): eyebrow,
// tiêu đề, sub-nav. Mỗi page con chỉ render phần thân bên dưới.
//
// requireUser() ở đây để có role dựng sub-nav, NHƯNG layout không chạy lại
// khi chuyển giữa các page con -> KHÔNG được coi là guard duy nhất: từng
// page con vẫn phải tự gọi requireUser()/requireStaff() (plan Nhóm 5: check
// quyền nhất quán theo cả nhóm route, đừng để route mới thêm vào sót).

import { requireUser } from "@/lib/auth-guard";
import { ProfileSubnav } from "./profile-subnav";

export const metadata = {
  title: "Trang cá nhân — MindX Career Hub",
};

export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="w-full space-y-6">
      <header>
        <span className="text-sm text-muted-foreground">Career Hub / Trang cá nhân</span>
        <h1 className="font-heading text-3xl font-semibold">Trang cá nhân</h1>
      </header>
      <ProfileSubnav isStaff={user.is_staff} />
      {children}
    </div>
  );
}
