// app/(app)/dashboard/overview-tab.tsx
// Tab "Tổng quan" của /dashboard — tương đương khối #tab-tong-quan ở
// dashboard.html + phần tính jobs_by_*/companies_by_city/monthly_* ở
// blueprints/dashboard.py::index() (Flask). Nhóm 3, Đợt 3.1 (phần 1/4).
//
// Server Component bất đồng bộ, CHỈ tải dữ liệu tab này (plan Nhóm 3: tách
// tải theo tab thay vì tính cả 4 tab như Flask) — tab Tổng quan không cần
// engagement/contacts nên không gọi 2 API đó. 4 lệnh gọi độc lập chạy song
// song bằng Promise.allSettled (thay ThreadPoolExecutor bên Flask), 1 lệnh
// lỗi không kéo sập 3 lệnh còn lại: jobs/companies lỗi -> hiện banner (như
// flash(...) ở Flask); stats lỗi -> 3 KPI phụ thuộc /stats hiện "—".

import Link from "next/link";
import { listAllJobs } from "@/lib/api/jobs";
import { listAllCompanyRecords } from "@/lib/api/companies";
import { getStats } from "@/lib/api/stats";
import { getLevelCodes } from "@/lib/api/enums";
import { INDUSTRIES, JOB_STATUS_LABELS } from "@/lib/constants";
import { countByDesc, countByFixedKeys, jobsByMonth } from "@/lib/dashboard/overview";
import { BarRow } from "./bar-row";
import { PaginatedBarList } from "./bar-list";
import { MonthlyJdChart } from "./monthly-jd-chart";

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Đã có lỗi khi tải dữ liệu.";
}

function KpiCard({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-[var(--radius)] border border-border bg-card px-5 py-[18px]">
      <span className="font-heading text-[30px] leading-tight text-primary">{value}</span>
      <span className="text-[12.5px] text-[var(--brand-ink-soft)]">{label}</span>
    </div>
  );
}

function StatCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius)] border border-border bg-card p-5">
      <h4 className="mb-3 font-heading text-base font-semibold">{title}</h4>
      {children}
    </section>
  );
}

export async function OverviewTab() {
  const [jobsRes, companiesRes, statsRes, levelRes] = await Promise.allSettled([
    listAllJobs(),
    listAllCompanyRecords(),
    getStats(),
    getLevelCodes(),
  ]);

  const errors: string[] = [];
  const jobs = jobsRes.status === "fulfilled" ? jobsRes.value : [];
  if (jobsRes.status === "rejected") errors.push(errorMessage(jobsRes.reason));
  const companies = companiesRes.status === "fulfilled" ? companiesRes.value : [];
  if (companiesRes.status === "rejected") errors.push(errorMessage(companiesRes.reason));
  // /stats lỗi -> im lặng như Flask (except CrawlerAPIError: pass), 3 KPI
  // phụ thuộc nó hiện "—" thay vì số 0 sai.
  const stats = statsRes.status === "fulfilled" ? statsRes.value : null;
  const levelCodes = levelRes.status === "fulfilled" ? levelRes.value : [];

  const totalJobs = jobs.length;
  const totalCompanies = companies.length;

  const byIndustry = countByFixedKeys(jobs, INDUSTRIES, (j) => j.matching_industry);
  const byLevel = countByFixedKeys(jobs, levelCodes, (j) => j.level_code);
  const byLocation = countByDesc(jobs, (j) => j.province_name);
  const byCity = countByDesc(companies, (c) => c.province_name);
  // Khoá jobs_by_status là mã backend thô (OPEN/CLOSED) -> đổi sang nhãn
  // tiếng Việt, xem ghi chú ở lib/api/stats.ts.
  const byStatus = stats
    ? Object.entries(stats.jobs_by_status).map(([code, value]) => ({
        label: JOB_STATUS_LABELS[code] ?? code,
        value,
      }))
    : [];

  const monthlyNew = jobsByMonth(jobs, (j) => j.created_at);
  const monthlyExpired = jobsByMonth(jobs, (j) => j.deadline, { onlyPast: true });

  const openJobs = stats ? (stats.jobs_by_status.OPEN ?? 0) : "—";

  return (
    <div className="space-y-6">
      {errors.map((msg, i) => (
        <p key={i} role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {msg}
        </p>
      ))}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3.5">
        <KpiCard value={totalJobs} label="Job trong database" />
        <KpiCard value={totalCompanies} label="Công ty trong database" />
        <KpiCard value={openJobs} label="Job đang còn tuyển" />
        <KpiCard value={stats ? stats.total_students : "—"} label="Học viên đã đăng ký" />
        <KpiCard value={stats ? stats.total_applications : "—"} label="Lượt ứng tuyển" />
        <KpiCard value={stats ? stats.total_saved_jobs : "—"} label="Lượt lưu job" />
      </div>

      <p className="text-[12.5px] text-muted-foreground">
        Xem chi tiết ứng tuyển/lưu job theo từng học viên tại{" "}
        <Link href="/student-activity" className="text-primary hover:underline">
          Hoạt động học viên →
        </Link>
      </p>

      <StatCard title="JD theo tháng — mới thêm vs đã hết hạn (6 tháng gần nhất)">
        <p className="-mt-1 mb-3.5 text-xs text-muted-foreground">
          &quot;Đã hết hạn&quot; chỉ tính job có hạn nộp đã qua tính đến hôm nay — job còn hạn (kể cả hạn rơi vào các
          tháng sắp tới) không được tính vào đây.
        </p>
        <MonthlyJdChart labels={monthlyNew.labels} added={monthlyNew.counts} expired={monthlyExpired.counts} />
      </StatCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <StatCard title="Job theo ngành">
          {byIndustry.map((row) => (
            <BarRow key={row.label} label={row.label} value={row.value} total={totalJobs} />
          ))}
        </StatCard>

        <StatCard title="Job theo level">
          {byLevel.map((row) => (
            <BarRow key={row.label} label={row.label} value={row.value} total={totalJobs} variant="teal" />
          ))}
        </StatCard>

        <StatCard title="Job theo địa điểm">
          <PaginatedBarList items={byLocation} total={totalJobs} />
        </StatCard>

        <StatCard title="Job theo trạng thái">
          {byStatus.map((row) => (
            <BarRow key={row.label} label={row.label} value={row.value} total={totalJobs} variant="teal" />
          ))}
        </StatCard>

        <StatCard title="Công ty theo thành phố">
          <PaginatedBarList items={byCity} total={totalCompanies} variant="teal" />
        </StatCard>
      </div>
    </div>
  );
}
