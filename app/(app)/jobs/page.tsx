// app/(app)/jobs/page.tsx
// Tương đương index.html + _index_filters() bên Flask (blueprints/
// jobs.py::index()). Route PUBLIC — xem được khi chưa đăng nhập (plan
// dòng 359, 855) — KHÔNG gọi requireUser()/requireStaff() ở đây.
//
// Round 6 (nửa 2/2): thêm chế độ "Cuộn liên tục" (view=infinite,
// <InfiniteJobList> gọi Route Handler /api/jobs/more) + thanh gạt
// <ViewToggle> đổi qua lại 2 chế độ — cả 2 đã CHƯA làm ở round trước
// (chỉ có phần data layer + API, xem app/api/jobs/more/route.ts).
// Giữ đúng 2 quyết định UX có chủ đích của Flask (plan Nhóm 1, dòng
// 971): đổi chế độ là 1 điều hướng thật (<Link>, không phải state
// client), và luôn về đầu danh sách (không "page"/"cursor" nào trong
// href) khi đổi — <ViewToggle> tự lo phần này.

import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getLevelCodes, getProvinceNames } from "@/lib/api/enums";
import { listJobs, listJobsCursor, toJobCardData } from "@/lib/api/jobs";
import { INDUSTRIES, JOBS_PER_PAGE, INDUSTRY_BADGE_STYLES, INDUSTRY_BADGE_FALLBACK } from "@/lib/constants";
import { JobFilterBar } from "./filter-bar";
import { JobCard } from "./job-card";
import { Pagination } from "./pagination";
import { ViewToggle } from "./view-toggle";
import { InfiniteJobList } from "./infinite-job-list";

export const metadata = {
  title: "Việc làm — MindX Career Hub",
  description:
    "Tổng hợp job Code, Data Analysis, Business Analysis từ TopCV, LinkedIn, ITviec, VietnamWorks, website công ty và các nguồn công khai khác.",
};

interface JobsPageSearchParams {
  q?: string;
  industry?: string;
  level?: string;
  location?: string;
  status?: string;
  page?: string;
  view?: string;
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<JobsPageSearchParams>;
}) {
  const params = await searchParams;
  const filters = {
    q: (params.q ?? "").trim(),
    industry: params.industry ?? "",
    level: params.level ?? "",
    location: params.location ?? "",
    status: params.status ?? "",
  };

  // Khớp index() bên Flask: giá trị `view` lạ -> fallback "page" (chế
  // độ mặc định), không phải lỗi.
  const view = params.view === "infinite" ? "infinite" : "page";

  const [user, levels, provinces] = await Promise.all([
    getCurrentUser(),
    getLevelCodes(),
    getProvinceNames(),
  ]);

  // pagination_filters bên Flask: chỉ filter có giá trị, KHÔNG chứa
  // "page"/"view" — dùng cho <ViewToggle> (đổi mode) lẫn <Pagination>
  // (đổi trang, chế độ "page").
  const currentParams = new URLSearchParams();
  if (filters.q) currentParams.set("q", filters.q);
  if (filters.industry) currentParams.set("industry", filters.industry);
  if (filters.level) currentParams.set("level", filters.level);
  if (filters.location) currentParams.set("location", filters.location);
  if (filters.status) currentParams.set("status", filters.status);

  let jobs;
  let totalJobs: number;
  let page = 1;
  let totalPages = 1;
  let from = 0;
  let to = 0;
  let infiniteNextCursor: string | null = null;

  if (view === "infinite") {
    // Batch đầu tiên render thẳng ở Server Component (không cursor) —
    // y hệt index.html Flask render sẵn batch đầu, <InfiniteJobList>
    // chỉ tự gọi API cho các lần "Tải thêm" sau đó.
    const data = await listJobsCursor(filters, { limit: JOBS_PER_PAGE });
    jobs = data.items.map(toJobCardData);
    totalJobs = data.total;
    infiniteNextCursor = data.next_cursor ?? null;
  } else {
    page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
    let offset = (page - 1) * JOBS_PER_PAGE;
    let data = await listJobs(filters, { limit: JOBS_PER_PAGE, offset });
    totalPages = Math.max(1, Math.ceil(data.total / JOBS_PER_PAGE));

    // Khớp Flask: page vượt quá tổng số trang (vd sửa tay URL) -> ghim
    // lại về trang cuối cùng còn dữ liệu, gọi lại đúng 1 lần.
    if (page > totalPages) {
      page = totalPages;
      offset = (page - 1) * JOBS_PER_PAGE;
      data = await listJobs(filters, { limit: JOBS_PER_PAGE, offset });
    }

    jobs = data.items.map(toJobCardData);
    totalJobs = data.total;
    from = jobs.length ? offset + 1 : 0;
    to = offset + jobs.length;
  }

  // Trạng thái "đã lưu" của từng card KHÔNG fetch ở đây nữa: layout
  // (app/(app)/layout.tsx, Round 5) fetch 1 lần cho cả (app) và đưa qua
  // <SavedJobsProvider>, <SaveJobButton> tự đọc — không gọi trùng
  // GET /me/saved-jobs mỗi lần đổi trang/filter.

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="text-sm text-muted-foreground">Career Hub / Việc làm</span>
          <h1 className="font-heading text-3xl font-semibold">
            Job Intern &amp; Fresher cho học viên MindX
          </h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Tổng hợp job Code, Data Analysis, Business Analysis từ TopCV,
            LinkedIn, ITviec, VietnamWorks, website công ty và các nguồn công
            khai khác.
          </p>
        </div>
        {user?.is_staff && (
          <Link
            href="/them-moi?tab=job"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            ＋ Thêm job mới
          </Link>
        )}
      </header>

      <JobFilterBar levels={levels} provinces={provinces} />

      <ViewToggle currentParams={currentParams} view={view} />

      {/* Chế độ "page" có page/per_page để tính khoảng "Hiển thị X–Y / Z"
          — chế độ "infinite" KHÔNG có 2 biến này (không phân trang cố
          định, số dòng thực tế tăng dần theo mỗi lần "Tải thêm"), nên
          chỉ hiện tổng số job phù hợp, không hiện khoảng X–Y (khớp
          index.html Flask, khối `{% if jobs and view != 'infinite' %}`). */}
      <p className="text-sm text-muted-foreground">
        {jobs.length > 0 && view !== "infinite"
          ? `Hiển thị ${from}–${to} / ${totalJobs} job phù hợp`
          : `${totalJobs} job phù hợp`}
      </p>

      {jobs.length > 0 && (
        <p className="text-sm">
          💡 Bấm vào <strong>tên vị trí</strong> của mỗi job để xem chi tiết
          đầy đủ và nộp CV ứng tuyển ngay trong hệ thống.
        </p>
      )}

      {jobs.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>Màu ngành:</span>
          {INDUSTRIES.map((i) => {
            const style = INDUSTRY_BADGE_STYLES[i] ?? INDUSTRY_BADGE_FALLBACK;
            return (
              <span key={i} className="flex items-center gap-1">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: style.fg }}
                />
                {i}
              </span>
            );
          })}
        </div>
      )}

      {jobs.length > 0 ? (
        view === "infinite" ? (
          <InfiniteJobList
            initialJobs={jobs}
            initialNextCursor={infiniteNextCursor}
            filters={filters}
            isAuthenticated={!!user}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} isAuthenticated={!!user} />
              ))}
            </div>
            <Pagination
              basePath="/jobs"
              currentParams={currentParams}
              page={page}
              totalPages={totalPages}
            />
          </>
        )
      ) : (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="mb-4 text-muted-foreground">Chưa có job nào khớp bộ lọc.</p>
          {user?.is_staff && (
            <Link
              href="/them-moi?tab=job"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Thêm job đầu tiên
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
