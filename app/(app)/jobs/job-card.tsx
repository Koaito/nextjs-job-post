// app/(app)/jobs/job-card.tsx
// Tương đương _job_card.html (Flask, class .ticket) — bố cục và số đo
// bám 04-job-cards.css: dải "stub" trên cùng (mã job + badge ngành +
// level, viền đứt phía dưới), thân card, dòng meta có đường kẻ trên, và
// hàng thao tác ở đáy ("Xem JD gốc ↗" + nút lưu).
//
// Nút lưu: mọi role đã đăng nhập thấy "🔖 Lưu job" (<SaveJobButton
// variant="card">), khớp _job_card.html gốc — backend tự chặn + trả lỗi
// tại chỗ nếu staff bấm. KHÁCH thấy "🔖 Đăng nhập để lưu" trỏ /login (bản
// trước ẩn hẳn nút này cho khách, lệch Flask: `{% else %}<a class="save-btn"
// href="auth.login">🔖 Đăng nhập để lưu</a>`).
// Trạng thái "đã lưu" do <SaveJobButton> tự đọc từ SavedJobsProvider
// (app/(app)/layout.tsx) — card không nhận prop trạng thái lưu.
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
import { SAVE_BTN_CLASS } from "@/components/save-btn-style";

/** `.job-grid.job-grid-3col` — flexbox wrap, mỗi card `flex: 1 1 300px`
 *  (không dùng CSS Grid: hàng cuối ít card vẫn tự giãn hết chiều ngang,
 *  không để ô trống bên phải — lý do đầy đủ ở 04-job-cards.css). Dùng chung
 *  cho danh sách phân trang lẫn cuộn liên tục. */
export const JOB_GRID_CLASS = "flex flex-wrap gap-4 [&>*]:flex-[1_1_300px]";

function formatDeadline(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("vi-VN");
}

export function JobCard({
  job,
  isAuthenticated,
  saveVariant = "card",
}: {
  job: JobCardData;
  isAuthenticated: boolean;
  /** "saved-list" chỉ dùng ở /profile/saved-jobs (nút "Bỏ lưu"). */
  saveVariant?: "card" | "saved-list";
}) {
  const industryStyle = INDUSTRY_BADGE_STYLES[job.industry] ?? INDUSTRY_BADGE_FALLBACK;
  const deadline = formatDeadline(job.deadline);
  // Khớp ĐÚNG _job_card.html: 2 điều kiện tách biệt, không gộp chung
  // 1 biến "isManual" duy nhất — Flask không hề coi "source rỗng" là
  // "MANUAL", 2 khái niệm khác nhau:
  //   - "Nguồn: …" chỉ hiện khi job.source VÀ job.source != 'MANUAL'
  //   - "Xem JD gốc" chỉ hiện khi job.jd_link VÀ job.source != 'MANUAL'
  //     (không đòi source phải có giá trị)
  // Gộp chung "!job.source" vào "isManual" trước đây làm ẩn nhầm nút
  // "Xem JD gốc" cho job có jdLink nhưng source rỗng — trường hợp có
  // thật với job crawl cũ (source_name null trước 08/2026, xem comment
  // ở lib/api/jobs.ts::toJobCardData nguồn JobOut.source_name).
  const sourceIsManual = job.source === "MANUAL";

  return (
    // .ticket (+ :hover nhấc lên 2px và đổ bóng)
    <article className="flex flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-card transition-[transform,box-shadow] duration-[120ms] ease-in-out hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(16,32,26,0.08)]">
      {/* .ticket-stub */}
      <div className="flex items-center gap-2.5 border-b border-dashed border-border bg-[#FAFBFA] px-4 py-2.5">
        <span className="mr-auto font-mono text-[11.5px] text-muted-foreground">
          JOB-{job.id.slice(0, 8).toUpperCase()}
        </span>
        <span
          className="shrink-0 rounded-full px-2 py-[3px] font-mono text-[11px] font-semibold whitespace-nowrap"
          style={{ background: industryStyle.bg, color: industryStyle.fg }}
        >
          {job.industry || "Chưa xác định"}
        </span>
        {job.level && (
          <span className="shrink-0 rounded-full border border-border px-2 py-[3px] text-[11px] whitespace-nowrap text-[var(--brand-ink-soft)]">
            {job.level}
          </span>
        )}
      </div>

      {/* .ticket-body */}
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        {/* .ticket-top */}
        <div className="flex items-start justify-between gap-2.5">
          <h3 className="m-0 font-heading text-[16.5px] leading-[1.3] font-bold">
            <Link href={`/jobs/${job.id}`} className="hover:text-primary">
              {job.position}
            </Link>
          </h3>
          {/* .status-chip */}
          <span
            className={
              "shrink-0 rounded-full px-[9px] py-1 text-[11px] font-semibold whitespace-nowrap " +
              (job.statusRaw === "OPEN"
                ? "bg-[var(--brand-teal-soft)] text-[var(--brand-teal)]"
                : "bg-[#EDEFEC] text-muted-foreground")
            }
          >
            {job.statusLabel}
          </span>
        </div>

        {/* .ticket-company */}
        <p className="m-0 text-[13.5px] text-[var(--brand-ink-soft)]">
          {job.company} · {job.location || "Chưa rõ địa điểm"}
        </p>

        {/* .ticket-meta */}
        <div className="mt-auto flex flex-wrap gap-2.5 border-t border-border pt-2 text-xs text-muted-foreground">
          <span>💰 {job.salaryDisplay}</span>
          {deadline && <span>⏳ Hạn: {deadline}</span>}
          {job.source && !sourceIsManual && <span>Nguồn: {job.source}</span>}
        </div>

        {/* .ticket-actions */}
        <div className="mt-auto flex flex-wrap items-center gap-2">
          {job.jdLink && !sourceIsManual && (
            <a
              href={job.jdLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-1.5 py-2.5 text-sm font-semibold whitespace-nowrap text-[var(--brand-ink-soft)] hover:text-primary"
            >
              Xem JD gốc ↗
            </a>
          )}
          {isAuthenticated ? (
            <SaveJobButton jobId={job.id} variant={saveVariant} />
          ) : (
            <Link href="/login" className={SAVE_BTN_CLASS}>
              🔖 Đăng nhập để lưu
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
