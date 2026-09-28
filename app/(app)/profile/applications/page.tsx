// app/(app)/profile/applications/page.tsx
// Tương đương my_applications.html + my_stuff.my_applications() (Flask) —
// "Đã ứng tuyển". Nhóm 5, Đợt 5.3 của plan. Khung (tiêu đề "Trang cá nhân"
// + sub-nav) nằm ở profile/layout.tsx.
//
// CHỈ HỌC VIÊN: requireStudent() (staff -> /dashboard, khớp Flask).
// Huỷ ứng tuyển dùng chung <WithdrawApplicationButton> với trang chi tiết
// job (plan: 1 Dialog huỷ duy nhất, có ô ghi chú không bắt buộc + cảnh báo
// "CV sẽ bị xoá"), khác Flask chỉ có confirm() thuần ở trang này.
// force-dynamic: huỷ xong / nộp mới là thấy ngay.

import Link from "next/link";
import { JOB_GRID_CLASS } from "@/app/(app)/jobs/job-card";
import { WithdrawApplicationButton } from "@/components/withdraw-application-button";
import { buttonVariants } from "@/components/ui/button";
import { listMyApplications, type JobApplicationOut } from "@/lib/api/me";
import { requireStudent } from "@/lib/auth-guard";
import { JOB_STATUS_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  // Cố định múi giờ VN: server (Vercel) chạy UTC.
  return d.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

export default async function MyApplicationsPage() {
  await requireStudent();

  let errorMessage: string | null = null;
  let applications: JobApplicationOut[] = [];
  try {
    applications = await listMyApplications();
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Không tải được danh sách ứng tuyển.";
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-semibold">Job bạn đã ứng tuyển</h2>
        <p className="text-muted-foreground">
          Theo dõi các job bạn đã gửi hồ sơ. Team SS sẽ cập nhật trạng thái và liên hệ trực tiếp.
        </p>
      </div>

      {errorMessage && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      {applications.length > 0 ? (
        <div className={JOB_GRID_CLASS}>
          {applications.map((a) => {
            const statusRaw = a.job_status ?? "";
            const statusLabel = JOB_STATUS_LABELS[statusRaw] || statusRaw;
            return (
              <article
                key={a.application_id}
                className="flex flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-card"
              >
                {/* .ticket-stub */}
                <div className="flex items-center gap-2.5 border-b border-dashed border-border bg-[#FAFBFA] px-4 py-2.5">
                  <span className="mr-auto font-mono text-[11.5px] text-muted-foreground">
                    JOB-{a.job_id.slice(0, 8).toUpperCase()}
                  </span>
                  {statusRaw && (
                    <span
                      className={
                        "shrink-0 rounded-full px-[9px] py-1 text-[11px] font-semibold whitespace-nowrap " +
                        (statusRaw === "OPEN"
                          ? "bg-[var(--brand-teal-soft)] text-[var(--brand-teal)]"
                          : "bg-[#EDEFEC] text-muted-foreground")
                      }
                    >
                      {statusLabel}
                    </span>
                  )}
                </div>

                {/* .ticket-body */}
                <div className="flex flex-1 flex-col gap-2.5 p-4">
                  <h3 className="m-0 font-heading text-[16.5px] leading-[1.3] font-bold">
                    <Link href={`/jobs/${a.job_id}`} className="hover:text-primary">
                      {a.job_title}
                    </Link>
                  </h3>
                  <p className="m-0 text-[13.5px] text-[var(--brand-ink-soft)]">{a.company_name}</p>
                  {a.note && (
                    // Text thuần (JSX tự escape) — ghi chú do học viên nhập.
                    <p className="m-0 text-sm text-muted-foreground">Ghi chú của bạn: {a.note}</p>
                  )}
                  <div className="mt-auto border-t border-border pt-2 text-xs text-muted-foreground">
                    <span>📨 Đã ứng tuyển: {formatDate(a.applied_at)}</span>
                  </div>
                  <WithdrawApplicationButton
                    jobId={a.job_id}
                    jobTitle={a.job_title}
                    companyName={a.company_name}
                    variant="list"
                  />
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="mb-4 text-muted-foreground">Bạn chưa ứng tuyển job nào.</p>
          <Link href="/jobs" className={buttonVariants()}>
            Khám phá job ngay
          </Link>
        </div>
      )}
    </div>
  );
}
