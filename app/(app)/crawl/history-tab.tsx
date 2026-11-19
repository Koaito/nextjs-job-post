// app/(app)/crawl/history-tab.tsx
// Tab "Lịch sử" (Server Component): HAI bảng độc lập trên cùng trang — lịch sử crawl và lịch sử bảo trì —
// mỗi bảng lọc và phân trang riêng bằng query param tách biệt (xem lib/data-ops/crawl-history.ts).
//
// Tab này KHÔNG có polling và không dựng widget "Đang chạy": lịch sử chỉ đọc khi mở/đổi trang/lọc. Gọi backend
// nhiều lần liên tiếp nhưng song song (4 lệnh là 2 bảng + danh sách nguồn); một bảng lỗi không kéo bảng kia sập.

import { redirect } from "next/navigation";
import { listCrawlRuns } from "@/lib/api/crawl";
import { listMaintenanceRuns } from "@/lib/api/maintenance";
import { getSources } from "@/lib/api/sources";
import {
  HISTORY_PAGE_SIZE,
  buildHistoryParams,
  clampedPage,
  crawlPageHref,
  historyHref,
  maintPageHref,
  offsetOf,
  totalPagesOf,
  type HistoryQuery,
} from "@/lib/data-ops/crawl-history";
import { MAINTENANCE_JOB_LABELS } from "@/lib/data-ops/crawl-ui";
import { loadSection as load } from "@/lib/load-section";
import { MAINTENANCE_JOB_TYPES } from "@/lib/data-ops/maintenance";
import { listSourceNames } from "@/lib/data-ops/sources";
import { HistoryFilterForm } from "./history-filter-form";
import { HistoryPager } from "./history-pager";
import { CrawlRunsTable, MaintenanceRunsTable } from "./history-tables";

function TableError({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
      {message}
    </p>
  );
}

/** Query của bảng KIA cần giữ nguyên trong form lọc của bảng này (bỏ `tab`, form tự thêm). */
function preservedFor(q: HistoryQuery, table: "crawl" | "maint"): Array<[string, string]> {
  const own = table === "crawl" ? ["crawl_page", "c_source", "c_status"] : ["maint_page", "m_job_type", "m_status"];
  return [...buildHistoryParams(q).entries()].filter(([name]) => name !== "tab" && !own.includes(name));
}

export async function HistoryTab({ query }: { query: HistoryQuery }) {
  const [crawl, maint, sources] = await Promise.all([
    load(() =>
      listCrawlRuns({
        source: query.crawlSource || undefined,
        status: query.crawlStatus || undefined,
        limit: HISTORY_PAGE_SIZE,
        offset: offsetOf(query.crawlPage),
      }),
    ),
    load(() =>
      listMaintenanceRuns({
        job_type: query.maintJobType || undefined,
        status: query.maintStatus || undefined,
        limit: HISTORY_PAGE_SIZE,
        offset: offsetOf(query.maintPage),
      }),
    ),
    // Danh sách nguồn chỉ để dựng ô lọc; lỗi thì ô lọc nguồn biến mất, bảng vẫn dùng được.
    load(() => getSources()),
  ]);

  // Trang xin vượt số trang thực có (lọc thu hẹp kết quả, bookmark cũ): chuyển về trang cuối hợp lệ,
  // chỉ đổi trang của bảng đó.
  if (crawl.ok) {
    const last = clampedPage(query.crawlPage, crawl.data.total);
    if (last !== null) redirect(crawlPageHref(query, last));
  }
  if (maint.ok) {
    const last = clampedPage(query.maintPage, maint.data.total);
    if (last !== null) redirect(maintPageHref(query, last));
  }

  const sourceOptions = sources.ok ? listSourceNames(sources.data).map((s) => ({ value: s, label: s })) : [];
  // Nguồn đang lọc nhưng không còn trong danh sách backend: vẫn hiện để ô chọn không im lặng đổi sang "Tất cả".
  if (query.crawlSource && !sourceOptions.some((o) => o.value === query.crawlSource)) {
    sourceOptions.push({ value: query.crawlSource, label: query.crawlSource });
  }
  const jobOptions = MAINTENANCE_JOB_TYPES.map((t) => ({ value: t, label: MAINTENANCE_JOB_LABELS[t] }));
  const crawlHasFilter = Boolean(query.crawlSource || query.crawlStatus);
  const maintHasFilter = Boolean(query.maintJobType || query.maintStatus);

  return (
    <div className="space-y-10">
      <section aria-labelledby="history-crawl-heading" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="history-crawl-heading" className="font-heading text-xl font-semibold">
            Lịch sử crawl
          </h2>
          {crawl.ok ? <span className="text-sm text-muted-foreground">{crawl.data.total} lượt</span> : null}
        </div>
        <HistoryFilterForm
          label="lịch sử crawl"
          primary={
            sourceOptions.length > 0
              ? { name: "c_source", label: "Nguồn", value: query.crawlSource, options: sourceOptions }
              : null
          }
          statusName="c_status"
          status={query.crawlStatus}
          preserved={preservedFor(query, "crawl")}
          clearHref={historyHref({ ...query, crawlPage: 1, crawlSource: "", crawlStatus: "" })}
          hasFilter={crawlHasFilter}
        />
        {crawl.ok ? (
          <>
            <CrawlRunsTable
              runs={crawl.data.items}
              emptyText={crawlHasFilter ? "Không có lượt crawl nào khớp bộ lọc." : "Chưa có lượt crawl nào."}
            />
            <HistoryPager
              label="lịch sử crawl"
              page={query.crawlPage}
              totalPages={totalPagesOf(crawl.data.total)}
              hrefFor={(p) => crawlPageHref(query, p)}
            />
          </>
        ) : (
          <TableError message={crawl.message} />
        )}
      </section>

      <section aria-labelledby="history-maint-heading" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="history-maint-heading" className="font-heading text-xl font-semibold">
            Lịch sử bảo trì
          </h2>
          {maint.ok ? <span className="text-sm text-muted-foreground">{maint.data.total} lượt</span> : null}
        </div>
        <HistoryFilterForm
          label="lịch sử bảo trì"
          primary={{ name: "m_job_type", label: "Công việc", value: query.maintJobType, options: jobOptions }}
          statusName="m_status"
          status={query.maintStatus}
          preserved={preservedFor(query, "maint")}
          clearHref={historyHref({ ...query, maintPage: 1, maintJobType: "", maintStatus: "" })}
          hasFilter={maintHasFilter}
        />
        {maint.ok ? (
          <>
            <MaintenanceRunsTable
              runs={maint.data.items}
              emptyText={maintHasFilter ? "Không có lượt bảo trì nào khớp bộ lọc." : "Chưa có lượt bảo trì nào."}
            />
            <HistoryPager
              label="lịch sử bảo trì"
              page={query.maintPage}
              totalPages={totalPagesOf(maint.data.total)}
              hrefFor={(p) => maintPageHref(query, p)}
            />
          </>
        ) : (
          <TableError message={maint.message} />
        )}
      </section>
    </div>
  );
}
