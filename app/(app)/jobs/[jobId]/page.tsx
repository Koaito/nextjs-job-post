// app/(app)/jobs/[jobId]/page.tsx
// Tương đương job_detail.html (Flask). Route PUBLIC (xem được khi chưa
// đăng nhập, giống /jobs) — KHÔNG gọi requireUser()/requireStaff() ở
// đầu file, chỉ đọc getCurrentUser() (không redirect) để tự rẽ nhánh
// UI staff/học viên/khách, đúng cách jobs/page.tsx đã làm.
//
// CHƯA làm (Nhóm 5, xem comment trong apply-section.tsx): apply/
// withdraw CV, already_applied, nút "Xem CV" của staff. Đã làm:
// applicants/savers (staff), đổi trạng thái + đóng job (staff, note
// tuỳ chọn), save/unsave job (học viên).

import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getJob, toJobDetailData } from "@/lib/api/jobs";
import { listJobApplicants, listJobSavers } from "@/lib/api/applications";
import { JobStatusPanel } from "./job-status-panel";
import { ApplySection } from "./apply-section";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("vi-VN");
}

/** Khớp filter |to_bullets bên Flask ở mức tối thiểu: mỗi dòng non-empty
 *  -> 1 đoạn <p>, giữ xuống dòng người dùng đã nhập thay vì gộp thành 1
 *  khối văn bản dài không xuống dòng. */
function TextBlock({ text }: { text: string }) {
  if (!text) return <p className="text-muted-foreground">Chưa có thông tin.</p>;
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  return (
    <div className="space-y-1.5 text-sm">
      {lines.map((line, i) => (
        <p key={i}>{line}</p>
      ))}
    </div>
  );
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;

  const [rawJob, user] = await Promise.all([getJob(jobId), getCurrentUser()]);
  if (!rawJob) notFound();
  const job = toJobDetailData(rawJob);

  const isStaff = !!user?.is_staff;
  const isAuthenticated = !!user;

  // 2 lời gọi phụ CHỈ chạy đúng ngữ cảnh cần (khớp job_detail() bên
  // Flask — applicants/savers chỉ gọi cho staff). Trạng thái "đã lưu"
  // của học viên KHÔNG fetch ở đây nữa: <SaveJobButton> đọc từ
  // SavedJobsProvider (app/(app)/layout.tsx, Round 5). is_duplicate_
  // candidate KHÔNG có ở đây nữa — xem comment ở lib/api/jobs.ts giải
  // thích lý do bỏ.
  const [applicants, savers] = await Promise.all([
    isStaff ? listJobApplicants(jobId).catch(() => []) : Promise.resolve(null),
    isStaff ? listJobSavers(jobId).catch(() => []) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <Link href="/jobs" className="text-sm text-muted-foreground underline">
        ← Danh sách job
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="text-sm text-muted-foreground">
            JOB-{job.id.slice(0, 8).toUpperCase()} · {job.industry || "Chưa xác định"} ·{" "}
            {job.level || "—"}
          </span>
          <h1 className="font-heading text-2xl font-semibold">{job.position}</h1>
          <p className="mt-1 text-muted-foreground">
            <Link href={`/companies/${job.companyId}`} className="underline">
              {job.company}
            </Link>{" "}
            · {job.location || "Chưa rõ địa điểm"}
            {job.workType && ` · ${job.workType}`}
          </p>
        </div>
        <span
          className={
            "shrink-0 rounded-full px-3 py-1 text-sm font-medium " +
            (job.statusRaw === "OPEN"
              ? "bg-[var(--brand-teal-soft)] text-[var(--brand-teal)]"
              : "bg-muted text-muted-foreground")
          }
        >
          {job.statusLabel}
        </span>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <section className="rounded-md border p-4">
            <h4 className="font-heading font-semibold">Mô tả công việc</h4>
            <div className="mt-2">
              <TextBlock text={job.description} />
            </div>
          </section>

          <section className="rounded-md border p-4">
            <h4 className="font-heading font-semibold">Yêu cầu ứng viên</h4>
            <div className="mt-2">
              <TextBlock text={job.requirements} />
            </div>
          </section>

          {job.skills.length > 0 && (
            <section className="rounded-md border p-4">
              <h4 className="font-heading font-semibold">Kỹ năng / công nghệ</h4>
              <div className="mt-2 flex flex-wrap gap-2">
                {job.skills.map((sk) => (
                  <span key={sk} className="rounded-full bg-muted px-2.5 py-1 text-xs">
                    {sk}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-md border p-4">
            <h4 className="font-heading font-semibold">Quyền lợi</h4>
            <div className="mt-2">
              <TextBlock text={job.benefits} />
            </div>
          </section>

          {job.note && (
            <section className="rounded-md border p-4">
              <h4 className="font-heading font-semibold">Ghi chú của team SS</h4>
              <p className="mt-2 text-sm">{job.note}</p>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          {isStaff ? (
            <>
              <JobStatusPanel jobId={job.id} position={job.position} statusRaw={job.statusRaw} />

              <section className="rounded-md border p-4">
                <h4 className="font-heading font-semibold">
                  Học viên đã ứng tuyển ({applicants?.length ?? 0})
                </h4>
                {applicants && applicants.length > 0 ? (
                  <ul className="mt-2 space-y-3 text-sm">
                    {applicants.map((a) => (
                      <li key={a.application_id} className="border-t pt-2 first:border-t-0 first:pt-0">
                        <p className="font-medium">{a.full_name}</p>
                        <p className="text-muted-foreground">
                          {a.email}
                          {a.phone && ` · ${a.phone}`}
                        </p>
                        <p className="text-muted-foreground">Ứng tuyển: {formatDate(a.applied_at)}</p>
                        {a.note && <p className="text-muted-foreground">Ghi chú: {a.note}</p>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Chưa có học viên nào ứng tuyển job này.
                  </p>
                )}
              </section>

              <section className="rounded-md border p-4">
                <h4 className="font-heading font-semibold">
                  Học viên đã lưu job này ({savers?.length ?? 0})
                </h4>
                {savers && savers.length > 0 ? (
                  <ul className="mt-2 space-y-3 text-sm">
                    {savers.map((s) => (
                      <li key={s.saved_job_id} className="border-t pt-2 first:border-t-0 first:pt-0">
                        <p className="font-medium">{s.full_name}</p>
                        <p className="text-muted-foreground">
                          {s.email}
                          {s.phone && ` · ${s.phone}`}
                        </p>
                        <p className="text-muted-foreground">Đã lưu: {formatDate(s.created_at)}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Chưa có học viên nào lưu job này.
                  </p>
                )}
              </section>
            </>
          ) : (
            <ApplySection jobId={job.id} isAuthenticated={isAuthenticated} />
          )}

          <section className="rounded-md border p-4">
            <h4 className="font-heading font-semibold">Thông tin nhanh</h4>
            <dl className="mt-2 space-y-1.5 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Mức lương</dt>
                <dd>{job.salaryDisplay || "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Deadline</dt>
                <dd>{formatDate(job.deadline)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Link JD gốc</dt>
                <dd>
                  {job.jdLink && job.source !== "MANUAL" ? (
                    <a href={job.jdLink} target="_blank" rel="noopener noreferrer" className="underline">
                      Xem JD
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Ngày thu thập</dt>
                <dd>{formatDate(job.dateCollected)}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
