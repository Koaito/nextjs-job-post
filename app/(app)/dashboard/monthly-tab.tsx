// app/(app)/dashboard/monthly-tab.tsx
// Tab "Báo cáo tháng" của /dashboard — tương đương khối #tab-bao-cao ở
// dashboard.html + _monthly_recap() ở blueprints/dashboard.py (Flask). Nhóm 3,
// Đợt 3.1 (phần 4/4).
//
// Server Component bất đồng bộ, CHỈ tải dữ liệu tab này bằng 1 lệnh gọi
// GET /dashboard/insights/monthly (backend Scrap_JD đã tính sẵn bằng SQL theo
// giờ VN, KỂ CẢ % chênh lệch so với tháng trước). Khác Flask, không kéo toàn
// bộ job/công ty về rồi tự đếm; khác plan (mục GET /stats/engagement), không
// tự tính % từ số tháng này/tháng trước — dùng thẳng `*_pct` của backend.
//
// Biểu đồ cột "JD theo tháng" KHÔNG nằm ở tab này: bên Flask canvas
// #monthlyJdChart thuộc tab Tổng quan (đã làm ở phần 1/4, monthly-jd-chart.tsx).
//
// Lỗi tải -> chỉ hiện banner, KHÔNG hiện các dòng "Chưa có job nào đăng trong
// tháng này" và 5 thẻ số "0": khi thật ra chưa tải được dữ liệu thì đó là
// thông tin sai lệch. `*_pct` = null (tháng trước = 0) -> ẩn huy hiệu.

import { getMonthlyInsights, type MonthlyInsightsOut } from "@/lib/api/dashboard";
import { formatMonthYear } from "@/lib/dashboard/monthly";
import { BarRow } from "./bar-row";
import { PctBadge } from "./pct-badge";

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Đã có lỗi khi tải dữ liệu.";
}

function KpiCard({ value, label, pct }: { value: number; label: string; pct?: number | null }) {
  return (
    <div className="flex flex-col gap-1 rounded-[var(--radius)] border border-border bg-card px-5 py-[18px]">
      <span className="font-heading text-[30px] leading-tight text-primary">{value}</span>
      <span className="text-[12.5px] text-[var(--brand-ink-soft)]">
        {label}
        <PctBadge pct={pct} className="ml-1.5" />
      </span>
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

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="py-3.5 text-[13px] text-muted-foreground">{children}</p>;
}

export async function MonthlyTab() {
  let data: MonthlyInsightsOut | null = null;
  let error: string | null = null;
  try {
    data = await getMonthlyInsights();
  } catch (err) {
    error = errorMessage(err);
  }

  if (!data) {
    return (
      <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {error}
      </p>
    );
  }

  // Mẫu số của thanh = số lớn nhất trong khối (backend đã sắp giảm dần nên
  // đây chính là dòng đầu, như max_ind_count/max_co_count bên Flask).
  const maxIndustry = Math.max(0, ...data.top_industries.map((r) => r.count));
  const maxCompany = Math.max(0, ...data.top_companies.map((r) => r.count));

  return (
    <div className="space-y-6">
      <p className="text-[12.5px] text-muted-foreground">
        Tháng {formatMonthYear(data.this_month_start)}, so với tháng {formatMonthYear(data.last_month_start)}{" "}
        (theo giờ Việt Nam).
      </p>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5">
        <KpiCard value={data.jobs_new} label="Job mới tháng này" pct={data.jobs_new_pct} />
        <KpiCard value={data.jobs_expired} label="Job hết hạn tháng này" />
        <KpiCard value={data.companies_new} label="Công ty mới tháng này" pct={data.companies_new_pct} />
        <KpiCard value={data.applications_this_month} label="Lượt ứng tuyển tháng này" pct={data.applications_pct} />
        <KpiCard value={data.saved_jobs_this_month} label="Lượt lưu job tháng này" pct={data.saved_jobs_pct} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <StatCard title="Top 3 ngành nhiều job nhất tháng này">
          {data.top_industries.length > 0 ? (
            data.top_industries.map((row) => (
              <BarRow
                key={row.industry}
                label={row.industry}
                value={row.count}
                total={maxIndustry}
                // Giữ chỗ cố định cho huy hiệu (kể cả khi pct = null, không có gì
                // để hiện) để cột số cùng rộng ở cả 3 dòng -> 3 thanh thẳng hàng.
                extra={
                  <span className="ml-1 inline-block min-w-[48px] text-left">
                    <PctBadge pct={row.pct_change} />
                  </span>
                }
              />
            ))
          ) : (
            <EmptyNote>Chưa có job nào đăng trong tháng này.</EmptyNote>
          )}
        </StatCard>

        <StatCard title="Top 5 công ty đăng nhiều job nhất tháng này">
          {data.top_companies.length > 0 ? (
            data.top_companies.map((row) => (
              <BarRow
                key={row.company_id}
                label={row.company_name}
                value={row.count}
                total={maxCompany}
                variant="teal"
                href={`/companies/${row.company_id}`}
              />
            ))
          ) : (
            <EmptyNote>Chưa có job nào đăng trong tháng này.</EmptyNote>
          )}
        </StatCard>
      </div>
    </div>
  );
}
