// app/(app)/crawl/page.tsx
// Tương đương crawl.html + blueprints/crawl*.py (Flask) — "Vận hành dữ liệu". Nhóm 6, phần 3/3, LÀM THEO CÁC PHẦN NHỎ:
//   [x] 3a — nền: trang, 4 tab, polling dừng khi không hiển thị, widget "Đang chạy" dùng chung, route đọc
//   [x] 3b — tab Lịch sử
//   [x] 3c — tab Crawl          [x] 3d — tab Bảo trì          [x] 3e — tab Tình trạng dữ liệu
//
// QUYỀN: xem trang chỉ cần requireStaff() (ss_team). Các route BẤM CHẠY (crawl/bảo trì, phần 3c/3d) sẽ phải
// requireAdmin() — KHÔNG dùng chung một guard, đừng nâng cả trang lên admin.
// ?tab= thiếu/lạ -> tab Crawl như Flask, không 404. Chỉ dựng ĐÚNG tab đang mở (đổi tab là điều hướng thật) nên polling
// của tab ẩn không tồn tại. Tab Lịch sử không polling.

import { requireStaff } from "@/lib/auth-guard";
import { parseHistoryQuery } from "@/lib/data-ops/crawl-history";
import { parseStatusQuery } from "@/lib/data-ops/data-health";
import { activeRunsScopeForTab, parseCrawlTab } from "@/lib/data-ops/crawl-tabs";
import { ActiveRunsWidget } from "./active-runs-widget";
import { CrawlTabNav } from "./crawl-tab-nav";
import { CrawlTab } from "./crawl-tab";
import { HistoryTab } from "./history-tab";
import { MaintenanceTab } from "./maintenance-tab";
import { StatusTab } from "./status-tab";

export const dynamic = "force-dynamic";

export default async function CrawlPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireStaff();
  const params = await searchParams;
  const tab = parseCrawlTab(params.tab);
  const scope = activeRunsScopeForTab(tab);

  return (
    <div className="space-y-6">
      <header>
        <span className="text-sm text-muted-foreground">Career Hub / Quản trị</span>
        <h1 className="font-heading text-3xl font-semibold">Vận hành dữ liệu</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Chạy crawl JD, các việc bảo trì dữ liệu, xem tình trạng dữ liệu và lịch sử các lượt chạy.
        </p>
      </header>

      <CrawlTabNav active={tab} />
      {scope ? <ActiveRunsWidget scope={scope} /> : null}

      {tab === "history" ? (
        <HistoryTab query={parseHistoryQuery(params)} />
      ) : tab === "crawl" ? (
        <CrawlTab isAdmin={user.role === "admin"} />
      ) : tab === "maintenance" ? (
        <MaintenanceTab isAdmin={user.role === "admin"} />
      ) : (
        <StatusTab query={parseStatusQuery(params)} />
      )}
    </div>
  );
}
