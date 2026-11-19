// app/(app)/crawl/status-tab.tsx
// Tab "Tình trạng dữ liệu" (Server Component, không polling): số liệu thiếu field của Job và Company, nhóm job nghi
// trùng và job đã hết hạn nhưng vẫn Đang tuyển. Hai nguồn có QUYỀN KHÁC NHAU (lib/api/data-health.ts): job health là
// public (chỉ API key), company health cần ss_team; trang đã requireStaff() nên cả hai gọi được, nhưng mỗi nguồn lỗi
// riêng thì chỉ phần của nó báo lỗi, phần kia vẫn hiện (cùng tinh thần "một bảng lỗi không kéo bảng kia sập" ở 3b).
//
// Hai bảng có nút đóng job phân trang riêng bằng query param tách biệt (dup_page, exp_page). Backend trả toàn bộ nhóm/job
// nên cắt trang ở đây. Trang vượt phạm vi -> chuyển về trang cuối (như tab Lịch sử).

import { redirect } from "next/navigation";
import { getCompanyDataHealth, getJobDataHealth } from "@/lib/api/data-health";
import {
  DUP_PAGE_SIZE,
  EXPIRED_PAGE_SIZE,
  dupPageHref,
  expPageHref,
  overflowPage,
  slicePage,
  type StatusQuery,
} from "@/lib/data-ops/data-health";
import { loadSection as load } from "@/lib/load-section";
import { DuplicateGroups } from "./duplicate-groups";
import { ExpiredOpenJobsTable } from "./expired-open-jobs";
import { HealthRowsTable } from "./health-rows-table";
import { HistoryPager } from "./history-pager";

function LoadError({ what }: { what: string }) {
  return (
    <p
      role="alert"
      className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
    >
      Không tải được {what}. Tải lại trang để thử lại.
    </p>
  );
}

function Section({
  id,
  title,
  aside,
  children,
}: {
  id: string;
  title: string;
  aside?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={id} className="font-heading text-xl font-semibold">
          {title}
        </h2>
        {aside ? <span className="text-sm text-muted-foreground">{aside}</span> : null}
      </div>
      {children}
    </section>
  );
}

export async function StatusTab({ query }: { query: StatusQuery }) {
  const [jobs, companies] = await Promise.all([load(() => getJobDataHealth()), load(() => getCompanyDataHealth())]);

  let dupSlice = null;
  let expSlice = null;
  if (jobs.ok) {
    const groups = jobs.data.duplicate_job_groups;
    const expired = jobs.data.expired_open_jobs;
    const dupLast = overflowPage(query.dupPage, groups.length, DUP_PAGE_SIZE);
    if (dupLast !== null) redirect(dupPageHref(query, dupLast));
    const expLast = overflowPage(query.expPage, expired.length, EXPIRED_PAGE_SIZE);
    if (expLast !== null) redirect(expPageHref(query, expLast));
    dupSlice = slicePage(groups, query.dupPage, DUP_PAGE_SIZE);
    expSlice = slicePage(expired, query.expPage, EXPIRED_PAGE_SIZE);
  }

  return (
    <div className="space-y-10" data-testid="status-tab">
      <Section
        id="status-jobs-heading"
        title="Thiếu thông tin ở job"
        aside={jobs.ok ? `${jobs.data.job_health_total} job` : undefined}
      >
        {jobs.ok ? (
          <div className="space-y-3">
            <div data-testid="job-health">
              <HealthRowsTable rows={jobs.data.job_health_rows} caption="Thiếu thông tin ở job" />
            </div>
            {jobs.data.job_health_by_source.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Theo nguồn</h3>
                {jobs.data.job_health_by_source.map((s) => (
                  <details key={s.source} className="rounded-md border p-3" data-source={s.source}>
                    <summary className="cursor-pointer text-sm font-medium">
                      {s.source} <span className="font-normal text-muted-foreground">· {s.total} job</span>
                    </summary>
                    <div className="mt-3">
                      <HealthRowsTable rows={s.rows} caption={`Thiếu thông tin ở job của nguồn ${s.source}`} />
                    </div>
                  </details>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <LoadError what="số liệu thiếu thông tin của job" />
        )}
      </Section>

      <Section
        id="status-companies-heading"
        title="Thiếu thông tin ở công ty"
        aside={companies.ok ? `${companies.data.company_health_total} công ty` : undefined}
      >
        {companies.ok ? (
          <div className="space-y-3">
            <div data-testid="company-health">
              <HealthRowsTable rows={companies.data.company_health_rows} caption="Thiếu thông tin ở công ty" />
            </div>
            {/* Chỉ số RIÊNG của tab này (công ty đang hoạt động chưa có contact), độc lập với `companies_no_contact` của Dashboard. */}
            <p data-testid="company-no-contact" className="text-sm">
              Công ty đang hoạt động chưa có contact:{" "}
              <span className="font-mono font-semibold">
                {companies.data.company_no_contact_missing}/{companies.data.company_no_contact_total}
              </span>
            </p>
          </div>
        ) : (
          <LoadError what="số liệu thiếu thông tin của công ty" />
        )}
      </Section>

      <Section
        id="status-duplicates-heading"
        title="Job nghi trùng"
        aside={dupSlice ? `${dupSlice.total} nhóm` : undefined}
      >
        {!jobs.ok || !dupSlice ? (
          <LoadError what="danh sách job nghi trùng" />
        ) : dupSlice.total === 0 ? (
          <p data-testid="duplicates-empty" className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Không có nhóm job nghi trùng nào.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Cùng công ty và cùng vị trí, đang mở tuyển. &ldquo;Nên giữ&rdquo; là gợi ý theo hạn nộp xa nhất, chỉ để tham khảo.
            </p>
            <DuplicateGroups groups={dupSlice.items} />
            <HistoryPager
              label="job nghi trùng"
              page={dupSlice.page}
              totalPages={dupSlice.totalPages}
              hrefFor={(p) => dupPageHref(query, p)}
            />
          </>
        )}
      </Section>

      <Section
        id="status-expired-heading"
        title="Job đã hết hạn nhưng vẫn Đang tuyển"
        aside={expSlice ? `${expSlice.total} job` : undefined}
      >
        {!jobs.ok || !expSlice ? (
          <LoadError what="danh sách job đã hết hạn" />
        ) : expSlice.total === 0 ? (
          <p data-testid="expired-empty" className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Không có job nào hết hạn mà vẫn Đang tuyển.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Có thể đóng tại chỗ, hoặc chạy job &ldquo;Kiểm tra job hết hạn&rdquo; ở tab Bảo trì để đóng hàng loạt.
            </p>
            <ExpiredOpenJobsTable jobs={expSlice.items} />
            <HistoryPager
              label="job hết hạn"
              page={expSlice.page}
              totalPages={expSlice.totalPages}
              hrefFor={(p) => expPageHref(query, p)}
            />
          </>
        )}
      </Section>
    </div>
  );
}
