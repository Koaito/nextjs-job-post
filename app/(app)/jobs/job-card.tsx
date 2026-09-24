// app/(app)/jobs/job-card.tsx
// Tương đương _job_card.html (Flask, class .ticket). Có nút "Lưu job"
// (<SaveJobButton variant="card">) — hiện cho MỌI role kể cả staff,
// khớp đúng _job_card.html gốc (backend tự chặn + trả lỗi tại chỗ nếu
// staff bấm, không phải Next.js tự ẩn nút ở biến thể "card" — khác
// biến thể "detail" ở trang chi tiết, nơi staff không thấy aside này).
//
// Không hiện skill-tag: GET /jobs mặc định KHÔNG trả parsed_content
// (include_content=false, xem lib/api/jobs.ts) nên "skills" luôn rỗng
// ở chế độ list — khớp đúng hành vi Flask hiện tại (job.skills trong
// _job_card.html thực tế cũng luôn rỗng ở trang chủ vì
// list_jobs()/list_jobs_cursor() không truyền include_content=True),
// không phải thiếu sót khi build lại ở Next.js.

import Link from "next/link";
import { INDUSTRY_BADGE_STYLES, INDUSTRY_BADGE_FALLBACK } from "@/lib/constants";
import type { JobCardData } from "@/lib/api/jobs";
import { SaveJobButton } from "@/components/save-job-button";

function formatDeadline(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("vi-VN");
}

export function JobCard({
  job,
  isAuthenticated,
  isSaved,
}: {
  job: JobCardData;
  /** Chưa đăng nhập -> không hiện nút Lưu job (khớp _job_card.html:
   *  action "Lưu job" chỉ hiện khi current_user đã đăng nhập). */
  isAuthenticated: boolean;
  /** Trạng thái đã lưu ban đầu (SSR, từ listMySavedJobIds() ở
   *  page.tsx) — mặc định false khi không đăng nhập/không truyền. */
  isSaved?: boolean;
}) {
  const industryStyle = INDUSTRY_BADGE_STYLES[job.industry] ?? INDUSTRY_BADGE_FALLBACK;
  const deadline = formatDeadline(job.deadline);
  // Khớp ĐÚNG _job_card.html: 2 điều kiện tách biệt, không gộp chung
  // 1 biến "isManual" duy nhất như bản trước — Flask không hề coi
  // "source rỗng" là "MANUAL", 2 khái niệm khác nhau:
  //   - "Nguồn: …" chỉ hiện khi job.source VÀ job.source != 'MANUAL'
  //   - "Xem JD gốc" chỉ hiện khi job.jd_link VÀ job.source != 'MANUAL'
  //     (không đòi source phải có giá trị)
  // Gộp chung "!job.source" vào "isManual" trước đây làm ẩn nhầm nút
  // "Xem JD gốc" cho job có jdLink nhưng source rỗng — trường hợp có
  // thật với job crawl cũ (source_name null trước 08/2026, xem comment
  // ở lib/api/jobs.ts::toJobCardData nguồn JobOut.source_name).
  const sourceIsManual = job.source === "MANUAL";

  return (
    <article className="flex flex-col gap-3 rounded-[var(--radius)] border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-mono uppercase text-muted-foreground">
          JOB-{job.id.slice(0, 8).toUpperCase()}
        </span>
        <span
          className="rounded-full px-2 py-0.5 font-medium"
          style={{ background: industryStyle.bg, color: industryStyle.fg }}
        >
          {job.industry || "Chưa xác định"}
        </span>
        {job.level && <span className="text-muted-foreground">{job.level}</span>}
      </div>

      <div className="flex items-start justify-between gap-2">
        <h3 className="font-heading text-lg font-semibold leading-snug">
          <Link href={`/jobs/${job.id}`} className="hover:underline">
            {job.position}
          </Link>
        </h3>
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className={
              "rounded-full px-2 py-0.5 text-xs font-medium " +
              (job.statusRaw === "OPEN"
                ? "bg-[var(--brand-teal-soft)] text-[var(--brand-teal)]"
                : "bg-muted text-muted-foreground")
            }
          >
            {job.statusLabel}
          </span>
          {isAuthenticated && (
            <SaveJobButton jobId={job.id} initialSaved={!!isSaved} variant="card" />
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {job.company} · {job.location || "Chưa rõ địa điểm"}
      </p>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span>💰 {job.salaryDisplay}</span>
        {deadline && <span>⏳ Hạn: {deadline}</span>}
        {job.source && !sourceIsManual && <span>Nguồn: {job.source}</span>}
      </div>

      {job.jdLink && !sourceIsManual && (
        <a
          href={job.jdLink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary underline"
        >
          Xem JD gốc ↗
        </a>
      )}
    </article>
  );
}
