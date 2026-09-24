// app/(app)/jobs/[jobId]/apply-section.tsx
// Tương đương nhánh `{% else %}` (không phải staff) của aside trong
// job_detail.html: khách thấy 2 link đăng nhập, học viên thấy nút Ứng
// tuyển + nút Lưu job.
//
// Server Component thuần — chỉ <SaveJobButton> bên trong là Client
// Component. Page.tsx chỉ render component này ở nhánh KHÔNG-staff nên
// không nhận prop isStaff (staff có aside riêng, xem JobStatusPanel).
//
// CHƯA làm ở round này — thuộc Nhóm 5 (plan dòng "Nộp CV khi ứng
// tuyển", "Huỷ ứng tuyển"):
//   - nộp CV thật (POST /me/applications, multipart PDF ≤ 5MB — cần
//     test giới hạn body Vercel ~4.5MB trước, Phụ lục B),
//   - trạng thái "Đã ứng tuyển · Bấm để huỷ" (already_applied) + Dialog
//     huỷ có cảnh báo "CV sẽ bị xoá".
// Vì vậy nút "Ứng tuyển ngay" ở đây bị vô hiệu hoá kèm giải thích, thay
// vì để bấm được rồi không làm gì.

import Link from "next/link";
import { Bookmark, Send } from "lucide-react";
import { SaveJobButton } from "@/components/save-job-button";
import { Button, buttonVariants } from "@/components/ui/button";

export function ApplySection({
  jobId,
  isAuthenticated,
  initialSaved,
}: {
  jobId: string;
  isAuthenticated: boolean;
  initialSaved: boolean;
}) {
  // Đường quay lại sau khi đăng nhập. /login đã tự lọc `next` qua
  // safeInternalPath() (login/page.tsx), path này cũng luôn là path nội
  // bộ do mình tự dựng từ jobId, không lấy từ input người dùng.
  const loginHref = `/login?next=${encodeURIComponent(`/jobs/${jobId}`)}`;

  if (!isAuthenticated) {
    return (
      <section className="space-y-2 rounded-md border p-4">
        <Link href={loginHref} className={buttonVariants({ className: "w-full" })}>
          <Send />
          Đăng nhập để ứng tuyển
        </Link>
        <Link href={loginHref} className={buttonVariants({ variant: "outline", className: "w-full" })}>
          <Bookmark />
          Đăng nhập để lưu job
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-2 rounded-md border p-4">
      <Button type="button" className="w-full" disabled>
        <Send />
        Ứng tuyển ngay
      </Button>
      <p className="text-xs text-muted-foreground">
        Nộp CV trực tiếp trên trang này sẽ có ở bản cập nhật sau.
      </p>
      <SaveJobButton jobId={jobId} initialSaved={initialSaved} variant="detail" />
    </section>
  );
}
