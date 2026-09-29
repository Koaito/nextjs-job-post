// app/(app)/dashboard/students-tab.tsx
// Tab "Gợi ý học viên" của /dashboard — tương đương khối #tab-hoc-vien ở
// dashboard.html + 4 hàm _jd_needing_push/_jd_stale/_top_skills/
// _salary_ranges_by_industry_level ở blueprints/dashboard.py (Flask). Nhóm 3,
// Đợt 3.1 (phần 2/4).
//
// Server Component bất đồng bộ, CHỈ tải dữ liệu tab này bằng 1 lệnh gọi
// GET /dashboard/insights/students (backend Scrap_JD đã tính sẵn cả 4 khối
// bằng SQL theo giờ VN — Phần 5 mục 8 của plan). Khác Flask, KHÔNG kéo toàn
// bộ job + engagement về rồi tự lọc ở đây (kể cả ngưỡng "đăng > 30 ngày và
// 0 lượt lưu/ứng tuyển" mà plan từng ghi là frontend tự lọc — nay backend
// làm hộ, xem lib/api/dashboard.ts).
//
// Lỗi tải -> chỉ hiện banner, KHÔNG rơi về các dòng "Không có JD nào ... —
// ổn": thông báo "ổn" khi thật ra không tải được dữ liệu sẽ gây hiểu lầm.

import Link from "next/link";
import { getStudentInsights, type StudentInsightsOut } from "@/lib/api/dashboard";
import { formatDateVN } from "@/lib/date";
import { formatSalaryRange } from "@/lib/dashboard/students";
import { BarRow } from "./bar-row";
import { PaginatedTable } from "./paginated-table";

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Đã có lỗi khi tải dữ liệu.";
}

function Section({
  title,
  count,
  description,
  children,
}: {
  title: string;
  count?: number;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius)] border border-border bg-card p-5">
      <h4 className="font-heading text-base font-semibold">
        {title}
        {count !== undefined && <span className="font-normal text-muted-foreground"> ({count})</span>}
      </h4>
      {description && <p className="mb-3.5 mt-1 text-xs text-muted-foreground">{description}</p>}
      {children}
    </section>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="py-3.5 text-[13px] text-muted-foreground">{children}</p>;
}

/** Nhãn "N ngày" (cam nhạt) — tương đương .reason-tag bên Flask. */
function DaysTag({ days }: { days: number }) {
  return (
    <span className="inline-block whitespace-nowrap rounded-full bg-[var(--brand-amber-soft)] px-[9px] py-[3px] text-[11px] font-semibold text-[var(--brand-amber)]">
      {days} ngày
    </span>
  );
}

function JobLink({ jobId, title }: { jobId: string; title: string }) {
  return (
    <Link href={`/jobs/${jobId}`} className="text-primary hover:underline">
      {title}
    </Link>
  );
}

export async function StudentsTab() {
  let data: StudentInsightsOut | null = null;
  let error: string | null = null;
  try {
    data = await getStudentInsights();
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

  const { jd_needing_push: pushJobs, jd_stale: staleJobs, top_skills: topSkills, salary_ranges: salaryRanges } = data;
  // Thanh kỹ năng: độ rộng theo kỹ năng nhiều nhất (Flask: count / max_count).
  const maxSkillCount = topSkills[0]?.count ?? 0;

  return (
    <div className="space-y-6">
      <Section
        title="JD sắp hết hạn cần đẩy gấp"
        count={pushJobs.length}
        description="Job còn 7–14 ngày là hết hạn, nhưng CHƯA có học viên nào lưu hoặc ứng tuyển — gợi ý cho học viên phù hợp trước khi hết cơ hội."
      >
        {pushJobs.length > 0 ? (
          <PaginatedTable
            head={
              <tr>
                <th className="w-[34%] px-3 py-2 font-medium">Vị trí</th>
                <th className="w-[30%] px-3 py-2 font-medium">Công ty</th>
                <th className="w-[18%] px-3 py-2 font-medium">Deadline</th>
                <th className="w-[18%] px-3 py-2 font-medium">Còn lại</th>
              </tr>
            }
            rows={pushJobs.map((j) => (
              <tr key={j.job_id} className="border-b last:border-0">
                <td className="px-3 py-2">
                  <JobLink jobId={j.job_id} title={j.job_title} />
                </td>
                <td className="px-3 py-2">{j.company_name}</td>
                <td className="px-3 py-2">{formatDateVN(j.deadline)}</td>
                <td className="px-3 py-2">
                  <DaysTag days={j.days_left} />
                </td>
              </tr>
            ))}
          />
        ) : (
          <EmptyNote>Không có JD nào sắp hết hạn mà chưa có ai quan tâm — ổn.</EmptyNote>
        )}
      </Section>

      <Section
        title={'JD "ế" — đăng lâu, chưa ai lưu/ứng tuyển'}
        count={staleJobs.length}
        description="Job đang tuyển đã đăng > 30 ngày nhưng vẫn 0 lượt lưu/ứng tuyển — có thể JD có vấn đề (lương, mô tả, sai ngành) hoặc chưa quảng bá tới đúng học viên."
      >
        {staleJobs.length > 0 ? (
          <PaginatedTable
            head={
              <tr>
                <th className="w-[34%] px-3 py-2 font-medium">Vị trí</th>
                <th className="w-[30%] px-3 py-2 font-medium">Công ty</th>
                <th className="w-[18%] px-3 py-2 font-medium">Ngày đăng</th>
                <th className="w-[18%] px-3 py-2 font-medium">Đã đăng</th>
              </tr>
            }
            rows={staleJobs.map((j) => (
              <tr key={j.job_id} className="border-b last:border-0">
                <td className="px-3 py-2">
                  <JobLink jobId={j.job_id} title={j.job_title} />
                </td>
                <td className="px-3 py-2">{j.company_name}</td>
                <td className="px-3 py-2">{formatDateVN(j.created_at)}</td>
                <td className="px-3 py-2">
                  <DaysTag days={j.age_days} />
                </td>
              </tr>
            ))}
          />
        ) : (
          <EmptyNote>Không có JD nào bị &quot;ế&quot; — mọi job đang tuyển đều đã có người quan tâm.</EmptyNote>
        )}
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Top skill hot" description="JD mới thêm 30 ngày qua">
          {topSkills.length > 0 ? (
            topSkills.map((s) => <BarRow key={s.skill} label={s.skill} value={s.count} total={maxSkillCount} />)
          ) : (
            <EmptyNote>Chưa có đủ dữ liệu skill từ JD mới thêm gần đây.</EmptyNote>
          )}
        </Section>

        <Section title="Khoảng lương theo ngành / level" description="VNĐ/tháng">
          {salaryRanges.length > 0 ? (
            <PaginatedTable
              head={
                <tr>
                  <th className="w-[30%] px-3 py-2 font-medium">Ngành</th>
                  <th className="w-[20%] px-3 py-2 font-medium">Level</th>
                  <th className="w-[32%] px-3 py-2 font-medium">Lương TB</th>
                  <th className="w-[18%] px-3 py-2 font-medium">Số mẫu</th>
                </tr>
              }
              rows={salaryRanges.map((r) => (
                <tr key={`${r.industry}|${r.level}`} className="border-b last:border-0">
                  <td className="px-3 py-2">{r.industry}</td>
                  <td className="px-3 py-2">{r.level}</td>
                  <td className="px-3 py-2">{formatSalaryRange(r)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.sample_size}</td>
                </tr>
              ))}
            />
          ) : (
            <EmptyNote>Chưa có đủ job có lương cụ thể (VNĐ/tháng) để tính trung bình.</EmptyNote>
          )}
        </Section>
      </div>
    </div>
  );
}
