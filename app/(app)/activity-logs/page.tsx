// app/(app)/activity-logs/page.tsx
// Tương đương activity_logs.html + _activity_logs_body.html +
// blueprints/activity_logs.py::logs() (Flask) — "Lịch sử thao tác".
// Nhóm 3, Đợt 3.4, LÀM THEO TỪNG PHẦN:
//   [x] Phần 1/5 — lib/api/audit-logs.ts, bảng nhãn/màu (lib/constants.ts),
//                  trang này với 2 tab + bảng 7 cột
//   [ ] Phần 2/5 — thanh lọc (đối tượng, công ty, người thực hiện)
//   [ ] Phần 3/5 — phân trang ?page= 50 log/trang, trạng thái rỗng, loading.tsx
//   [ ] Phần 4/5 — sửa note (server action + Dialog)
//   [ ] Phần 5/5 — hiện `changes` (cũ -> mới) ở log UPDATE_*
//
// CHỈ STAFF (@staff_required): requireStaff(). Nhật ký chi tiết TỪNG thao
// tác theo thời gian — khác /staff-activity (tổng hợp theo người tạo).
//
// 2 tab = query `?view=auto|manual` trên cùng 1 page (plan Nhóm 3), giá
// trị lạ/thiếu -> "auto" như Flask. KHÔNG cache giữa các lần đổi tab:
// force-dynamic + callAuthed no-store (plan Nhóm 2-3).
//
// Phần 1 CHƯA phân trang: chỉ tải 50 log mới nhất của view đang chọn; nếu
// tổng lớn hơn thì có dòng báo. Phần 3/5 thay bằng phân trang thật.

import { requireStaff } from "@/lib/auth-guard";
import { listAuditLogs, type AuditLogOut, type AuditLogView } from "@/lib/api/audit-logs";
import { ActivityLogsTabNav } from "./activity-logs-tab-nav";
import { ActivityLogsTable } from "./activity-logs-table";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Lịch sử thao tác — MindX Career Hub",
};

const PAGE_SIZE = 50;

function parseView(raw: string | string[] | undefined): AuditLogView {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "manual" ? "manual" : "auto";
}

export default async function ActivityLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const view = parseView(sp.view);

  let logs: AuditLogOut[] = [];
  let total = 0;
  let error: string | null = null;
  try {
    const res = await listAuditLogs({ view, limit: PAGE_SIZE, offset: 0 });
    logs = res.items;
    total = res.total;
  } catch (err) {
    error = err instanceof Error ? err.message : "Đã có lỗi khi tải lịch sử thao tác.";
  }

  return (
    <div className="space-y-6">
      <header>
        <span className="text-sm text-muted-foreground">Career Hub / Quản trị</span>
        <h1 className="font-heading text-3xl font-semibold">Lịch sử thao tác</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Nhật ký chi tiết từng thao tác theo thời gian — xem ai làm gì, khi nào, với ghi chú đi kèm.
        </p>
      </header>

      <ActivityLogsTabNav view={view} />

      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {!error && logs.length === 0 && (
        <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
          Chưa có log nào.
        </div>
      )}

      {logs.length > 0 && (
        <>
          {total > logs.length && (
            <p className="text-sm text-muted-foreground">
              Đang hiện {logs.length} log mới nhất trong tổng số {total} log.
            </p>
          )}
          <ActivityLogsTable logs={logs} />
        </>
      )}
    </div>
  );
}
