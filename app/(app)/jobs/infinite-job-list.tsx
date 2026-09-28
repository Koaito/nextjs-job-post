"use client";
// app/(app)/jobs/infinite-job-list.tsx
// Round 6 (nửa 2/2) — Client Component cho chế độ "Cuộn liên tục"
// (view=infinite), tương đương khối grid + nút "Tải thêm" + <script>
// trong index.html (Flask). Nhận batch job ĐẦU TIÊN làm props (đã
// fetch sẵn ở Server Component page.tsx, y hệt cách Flask render batch
// đầu tiên thẳng trong index.html thay vì để JS tự gọi more() ngay khi
// trang vừa load) — chỉ tự gọi Route Handler /api/jobs/more cho các
// lần "Tải thêm" SAU đó.
//
// CHỦ Ý dùng nút bấm thủ công (giữ nguyên hành vi Flask), CHƯA đổi
// sang IntersectionObserver — plan liệt kê việc này ở nhóm "🟢 Có thể
// để sau, không chặn go-live" (Nhóm 1), không bắt buộc ở round này.
// Nâng cấp sau nếu cần, chỉ cần đổi cách trigger loadMore(), không đổi
// phần fetch/state bên dưới.

import { useState } from "react";
import { JOB_GRID_CLASS, JobCard } from "./job-card";
import type { JobCardData, JobFilters } from "@/lib/api/jobs";

export function InfiniteJobList({
  initialJobs,
  initialNextCursor,
  filters,
  isAuthenticated,
}: {
  initialJobs: JobCardData[];
  initialNextCursor: string | null;
  /** Bộ filter hiện tại (q/industry/level/location/status) — dùng lại
   *  y hệt để mọi lần "Tải thêm" luôn khớp bộ lọc của batch đầu tiên,
   *  khớp _index_filters() dùng chung cho index()/more() bên Flask. */
  filters: JobFilters;
  isAuthenticated: boolean;
}) {
  const [jobs, setJobs] = useState(initialJobs);
  const [cursor, setCursor] = useState(initialNextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.industry) params.set("industry", filters.industry);
    if (filters.level) params.set("level", filters.level);
    if (filters.location) params.set("location", filters.location);
    if (filters.status) params.set("status", filters.status);
    params.set("cursor", cursor);

    try {
      const res = await fetch(`/api/jobs/more?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setJobs((prev) => [...prev, ...((data.jobs ?? []) as JobCardData[])]);
      setCursor((data.next_cursor as string | null) ?? null);
    } catch (err) {
      // Lỗi mạng/429 rate limit — hiện lỗi ngắn gọn, cho bấm lại, KHÔNG
      // tự retry vòng lặp (khớp catch() trong index.html bên Flask).
      setError(
        `Không tải được job mới (${
          err instanceof Error ? err.message : "lỗi không xác định"
        }). Vui lòng thử lại.`,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className={JOB_GRID_CLASS}>
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} isAuthenticated={isAuthenticated} />
        ))}
      </div>

      {/* .load-more-wrap — cùng khoảng cách trên với .pagination để 2 chế độ
          có "chiều cao đáy trang" gần bằng nhau khi chuyển qua lại. */}
      <div className="mt-7 flex flex-col items-center gap-2 border-t border-border pt-[18px]">
        {cursor ? (
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="min-w-40 cursor-pointer rounded-[9px] border border-border bg-card px-[18px] py-2.5 text-sm font-semibold whitespace-nowrap text-foreground hover:border-foreground disabled:cursor-default disabled:opacity-60"
          >
            {loading ? "Đang tải..." : "Tải thêm"}
          </button>
        ) : (
          <p className="m-0 text-[13.5px] text-muted-foreground">Đã hết job phù hợp.</p>
        )}
        {error && <p className="m-0 text-[13px] text-[#b91c1c]">{error}</p>}
      </div>
    </>
  );
}
