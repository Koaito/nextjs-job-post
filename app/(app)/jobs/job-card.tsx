// app/(app)/jobs/job-card.tsx
// Tương đương _job_card.html (Flask, class .ticket). Server Component
// thuần — chưa có nút "Lưu job" (<SaveJobButton>, useOptimistic) ở
// round này, xem checklist Nhóm 1 mục kế tiếp.
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

function formatDeadline(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("vi-VN");
}

export function JobCard({ job }: { job: JobCardData }) {
  const industryStyle = INDUSTRY_BADGE_STYLES[job.industry] ?? INDUSTRY_BADGE_FALLBACK;
  const deadline = formatDeadline(job.deadline);
  const isManual = job.source === "MANUAL" || !job.source;

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
        <span
          className={
            "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium " +
            (job.statusRaw === "OPEN"
              ? "bg-[var(--brand-teal-soft)] text-[var(--brand-teal)]"
              : "bg-muted text-muted-foreground")
          }
        >
          {job.statusLabel}
        </span>
      </div>

      <p className="text-sm text-muted-foreground">
        {job.company} · {job.location || "Chưa rõ địa điểm"}
      </p>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span>💰 {job.salaryDisplay}</span>
        {deadline && <span>⏳ Hạn: {deadline}</span>}
        {!isManual && <span>Nguồn: {job.source}</span>}
      </div>

      {!isManual && job.jdLink && (
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
