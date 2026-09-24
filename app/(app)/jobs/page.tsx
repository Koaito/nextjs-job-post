// app/(app)/jobs/page.tsx
// Tương đương index.html + _index_filters() bên Flask (blueprints/
// jobs.py::index()). Route PUBLIC — xem được khi chưa đăng nhập (plan
// dòng 359, 855) — KHÔNG gọi requireUser()/requireStaff() ở đây.
//
// CHỈ làm chế độ "Phân trang" ở round này (đã chốt phạm vi khi bắt đầu
// Nhóm 1) — chế độ "Cuộn liên tục" (view=infinite, Route Handler
// /jobs/more, <InfiniteJobList>) và thanh gạt đổi 2 chế độ CHƯA làm,
// để round sau. Không hiện thanh gạt (view-toggle) vì chỉ có đúng 1
// chế độ hoạt động — hiện ra sẽ là 1 link chết.

import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getLevelCodes } from "@/lib/api/enums";
import { listJobs, toJobCardData } from "@/lib/api/jobs";
import { listMySavedJobIds } from "@/lib/api/applications";
import { INDUSTRIES, JOBS_PER_PAGE, INDUSTRY_BADGE_STYLES, INDUSTRY_BADGE_FALLBACK } from "@/lib/constants";
import { JobFilterBar } from "./filter-bar";
import { JobCard } from "./job-card";
import { Pagination } from "./pagination";

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

  const [user, levels] = await Promise.all([getCurrentUser(), getLevelCodes()]);

  let page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  let offset = (page - 1) * JOBS_PER_PAGE;
  let data = await listJobs(filters, { limit: JOBS_PER_PAGE, offset });
  const totalPages = Math.max(1, Math.ceil(data.total / JOBS_PER_PAGE));

  // Khớp Flask: page vượt quá tổng số trang (vd sửa tay URL) -> ghim
  // lại về trang cuối cùng còn dữ liệu, gọi lại đúng 1 lần.
  if (page > totalPages) {
    page = totalPages;
    offset = (page - 1) * JOBS_PER_PAGE;
    data = await listJobs(filters, { limit: JOBS_PER_PAGE, offset });
  }

  const jobs = data.items.map(toJobCardData);

  // Chỉ gọi khi đã đăng nhập — người chưa đăng nhập không có gì để lưu,
  // gọi thêm 1 API vô ích. KHÔNG lọc theo !isStaff ở đây (khác
  // app/(app)/jobs/[jobId]/page.tsx): _job_card.html hiện nút Lưu job
  // cho MỌI role kể cả staff, nên cần đúng trạng thái đã lưu cho staff
  // luôn, không riêng học viên.
  const savedJobIds = user ? await listMySavedJobIds().catch(() => new Set<string>()) : new Set<string>();

  const currentParams = new URLSearchParams();
  if (filters.q) currentParams.set("q", filters.q);
  if (filters.industry) currentParams.set("industry", filters.industry);
  if (filters.level) currentParams.set("level", filters.level);
  if (filters.location) currentParams.set("location", filters.location);
  if (filters.status) currentParams.set("status", filters.status);

  const from = jobs.length ? offset + 1 : 0;
  const to = offset + jobs.length;

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
            href="/jobs/add"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            ＋ Thêm job mới
          </Link>
        )}
      </header>

      <JobFilterBar levels={levels} />

      <p className="text-sm text-muted-foreground">
        {jobs.length > 0
          ? `Hiển thị ${from}–${to} / ${data.total} job phù hợp`
          : `${data.total} job phù hợp`}
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
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                isAuthenticated={!!user}
                isSaved={savedJobIds.has(job.id)}
              />
            ))}
          </div>
          <Pagination
            basePath="/jobs"
            currentParams={currentParams}
            page={page}
            totalPages={totalPages}
          />
        </>
      ) : (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="mb-4 text-muted-foreground">Chưa có job nào khớp bộ lọc.</p>
          {user?.is_staff && (
            <Link
              href="/jobs/add"
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
