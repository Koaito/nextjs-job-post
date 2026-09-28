// app/(app)/jobs/[jobId]/apply-section.tsx
// Tương đương nhánh `{% else %}` (không phải staff) của aside trong
// job_detail.html: khách thấy 2 link đăng nhập; học viên thấy nút Ứng tuyển
// (hoặc "Đã ứng tuyển · Bấm để huỷ" nếu đã nộp) + nút Lưu job.
//
// Server Component thuần — chỉ 3 nút bên trong là Client Component
// (<ApplyJobDialog>, <WithdrawApplicationButton>, <SaveJobButton>). Page.tsx
// chỉ render component này ở nhánh KHÔNG-staff nên không nhận prop isStaff
// (staff có aside riêng, xem JobStatusPanel).
//
// Nhóm 5, Đợt 5.3: nộp CV thật + huỷ ứng tuyển. `alreadyApplied` do page.tsx
// tính (khớp already_applied của job_detail() bên Flask).

import Link from "next/link";
import { Bookmark, Send } from "lucide-react";
import { ApplyJobDialog } from "@/components/apply-job-dialog";
import { SaveJobButton } from "@/components/save-job-button";
import { WithdrawApplicationButton } from "@/components/withdraw-application-button";
import { buttonVariants } from "@/components/ui/button";

export function ApplySection({
  jobId,
  jobTitle,
  companyName,
  isAuthenticated,
  alreadyApplied,
}: {
  jobId: string;
  jobTitle: string;
  companyName: string;
  isAuthenticated: boolean;
  alreadyApplied: boolean;
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
      {alreadyApplied ? (
        <WithdrawApplicationButton
          jobId={jobId}
          jobTitle={jobTitle}
          companyName={companyName}
          variant="detail"
        />
      ) : (
        <ApplyJobDialog jobId={jobId} jobTitle={jobTitle} companyName={companyName} />
      )}
      <SaveJobButton jobId={jobId} variant="detail" />
    </section>
  );
}
