// app/(app)/layout.tsx
//
// BẢN TỐI THIỂU (22/09) — chỉ đủ để có chỗ đặt /profile/security và
// test được luồng đổi mật khẩu ngay, KHÔNG phải layout thật của Nhóm 1.
// Theo plan (dòng 359, 931), app/(app)/layout.tsx đúng ra phải có
// sidebar + FlashStack + UnreadBadge + EmailTemplateModal + inject
// SavedJobsProvider — toàn bộ phần đó thuộc Nhóm 1 (dựng cùng lúc với
// Jobs, vì cần layout thật để test trang chủ), CHƯA làm ở đây. Khi vào
// Nhóm 1, file này sẽ bị thay hoàn toàn, không phải sửa thêm — không
// nên coi layout tối giản này là nền đã "xong" của Nhóm 1.
//
// requireUser() (không phải requireStaff()) vì /profile/security áp
// dụng cho MỌI role (học viên lẫn staff đều tự đổi mật khẩu được) —
// giống hệt Flask (blueprints/profile.py không giới hạn role cho route
// đổi mật khẩu của chính mình).

import { requireUser } from "@/lib/auth-guard";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();

  return (
    <div className="mx-auto min-h-screen w-full max-w-3xl px-4 py-8">
      {children}
    </div>
  );
}
