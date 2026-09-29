// app/(app)/dashboard/page.tsx
// Tương đương dashboard.html + blueprints/dashboard.py::index() (Flask) —
// "Tổng quan thị trường job & database doanh nghiệp". Nhóm 3, Đợt 3.1 của
// plan, LÀM THEO TỪNG PHẦN (mỗi phần 1 tab):
//   [x] Phần 1/4 — khung trang + tab "Tổng quan"   (file này + overview-tab.tsx)
//   [x] Phần 2/4 — tab "Gợi ý học viên"          (students-tab.tsx)
//   [x] Phần 3/4 — tab "Doanh nghiệp" (kèm `?followup_days=7|14|30`) (companies-tab.tsx)
//   [x] Phần 4/4 — tab "Báo cáo tháng"          (monthly-tab.tsx)
//
// CHỈ STAFF (staff_required bên Flask): requireStaff() ở đầu trang. Học
// viên vào thẳng URL -> 404 (nav cũng không hiện mục này cho họ).
//
// Cách tải (plan Nhóm 3): `?tab=` do SERVER đọc rồi chỉ render + tải dữ
// liệu của ĐÚNG tab đó, trong <Suspense key={tab}> riêng — khung trang +
// thanh tab hiện ngay, nội dung tab stream sau. Khác Flask (tính đủ cả 4
// tab dù staff chỉ xem 1). Bấm tab đổi `?tab=` bằng router.replace() ở
// dashboard-tab-bar.tsx.
//
// force-dynamic (no-store): "Dashboard, staff-activity, crawl status" ở
// bảng cache Phần 4 mục 4 của plan — cần số liệu mới nhất, đúng như Flask
// luôn gọi API mới mỗi lần.

import { Suspense } from "react";
import { requireStaff } from "@/lib/auth-guard";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardTabBar } from "./dashboard-tab-bar";
import { parseFollowupDays } from "@/lib/dashboard/companies";
import { parseDashboardTab, type DashboardTabId } from "./dashboard-tabs";
import { CompaniesTab } from "./companies-tab";
import { MonthlyTab } from "./monthly-tab";
import { OverviewTab } from "./overview-tab";
import { StudentsTab } from "./students-tab";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard — MindX Career Hub",
};

function TabSkeleton({ tab }: { tab: DashboardTabId }) {
  // Tab Tổng quan có hàng KPI + biểu đồ; tab Báo cáo tháng có hàng 5 thẻ số
  // + 2 thẻ top; các tab còn lại chỉ gồm các thẻ bảng/danh sách -> mỗi loại
  // 1 skeleton riêng để không nháy ra "6 thẻ KPI" rồi mới đổi thành bảng.
  if (tab === "bao-cao") {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Đang tải dữ liệu">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-[92px]" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-[180px]" />
          ))}
        </div>
      </div>
    );
  }
  if (tab !== "tong-quan") {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Đang tải dữ liệu">
        <Skeleton className="h-[260px]" />
        <Skeleton className="h-[260px]" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-[260px]" />
          <Skeleton className="h-[260px]" />
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Đang tải dữ liệu">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3.5">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[92px]" />
        ))}
      </div>
      <Skeleton className="h-[400px]" />
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[220px]" />
        ))}
      </div>
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[]; followup_days?: string | string[] }>;
}) {
  await requireStaff();
  const { tab: rawTab, followup_days: rawFollowupDays } = await searchParams;
  const tab = parseDashboardTab(rawTab);
  // Whitelist 7|14|30 validate Ở SERVER trước khi gọi API (plan Nhóm 3): giá
  // trị lạ/thiếu -> 14, không tin thẳng query string người dùng gõ tay.
  const followupDays = parseFollowupDays(rawFollowupDays);

  return (
    <div className="space-y-6">
      <header>
        <span className="text-sm text-muted-foreground">Career Hub / Báo cáo</span>
        <h1 className="font-heading text-3xl font-semibold">Tổng quan thị trường job &amp; database doanh nghiệp</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">Số liệu cập nhật theo dữ liệu hiện có trong hệ thống.</p>
      </header>

      <DashboardTabBar active={tab} />

      <Suspense key={tab === "doanh-nghiep" ? `${tab}-${followupDays}` : tab} fallback={<TabSkeleton tab={tab} />}>
        {tab === "tong-quan" ? (
          <OverviewTab />
        ) : tab === "hoc-vien" ? (
          <StudentsTab />
        ) : tab === "doanh-nghiep" ? (
          <CompaniesTab followupDays={followupDays} />
        ) : (
          <MonthlyTab />
        )}
      </Suspense>
    </div>
  );
}
