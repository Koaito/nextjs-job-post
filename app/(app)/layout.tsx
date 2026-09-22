// app/(app)/layout.tsx
//
// BẢN TỐI THIỂU (22/09) — chỉ đủ để có chỗ đặt /profile/security và
// /jobs, KHÔNG phải layout thật của Nhóm 1. Theo plan (dòng 359, 931),
// app/(app)/layout.tsx đúng ra phải có sidebar + FlashStack +
// UnreadBadge + EmailTemplateModal + inject SavedJobsProvider — toàn
// bộ phần đó thuộc Nhóm 1 (dựng cùng lúc với Jobs), CHƯA làm ở đây.
//
// QUAN TRỌNG (plan dòng 359, 855): layout này che CẢ route public
// (/jobs, /jobs/[jobId]) lẫn route cần login (/profile/security,
// /dashboard...) — nên KHÔNG được gọi requireUser()/requireStaff() ở
// đây (sẽ chặn nhầm luôn /jobs cho khách chưa đăng nhập). Guard thật
// nằm ở TỪNG route con cần login tự gọi requireUser()/requireStaff()
// (xem app/(app)/profile/security/page.tsx), đúng nguyên tắc 2 lớp:
// middleware.ts chặn sớm (Edge, chỉ check có cookie hay không) + Server
// Component tự gọi requireUser()/requireStaff() để xác thực "thật".

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8">
      {children}
    </div>
  );
}
