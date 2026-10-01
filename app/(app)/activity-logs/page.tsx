// app/(app)/activity-logs/page.tsx
// Tương đương activity_logs.html + _activity_logs_body.html +
// blueprints/activity_logs.py::logs() (Flask) — "Lịch sử thao tác".
// Nhóm 3, Đợt 3.4, LÀM THEO TỪNG PHẦN:
//   [x] Phần 1/5 — lib/api/audit-logs.ts, bảng nhãn/màu (lib/constants.ts),
//                  trang này với 2 tab + bảng 7 cột
//   [x] Phần 2/5 — thanh lọc (đối tượng, công ty, người thực hiện)
//   [x] Phần 3/5 — phân trang ?page= 50 log/trang, trạng thái rỗng, loading.tsx
//   [x] Phần 4/5 — sửa note (server action + Dialog)
//   [x] Phần 5/5 — hiện `changes` (cũ -> mới): nút "Xem thay đổi" ở log có changes
//
// Quyết định có chủ ý: KHÔNG làm badge "còn N log thiếu note" (plan Nhóm 3 có
// nhắc `pending_note`). Backend chặn cứng note ở action note_required nên
// badge luôn bằng 0; Flask cũng không có. Chỉ cần làm nếu DB còn log cũ
// ghi trước khi có chặn cứng — kiểm tra bằng:
//   SELECT count(*) FROM audit_logs WHERE note_required AND note IS NULL;
// (lib/api/audit-logs.ts vẫn giữ tham số pending_note để thêm lại là 1 dòng).
//
// CHỈ STAFF (@staff_required): requireStaff(). Nhật ký chi tiết TỪNG thao
// tác theo thời gian — khác /staff-activity (tổng hợp theo người tạo).
//
// 2 tab = query `?view=auto|manual` trên cùng 1 page (plan Nhóm 3), giá
// trị lạ/thiếu -> "auto" như Flask. KHÔNG cache giữa các lần đổi tab/lọc:
// force-dynamic + callAuthed no-store (plan Nhóm 2-3).
//
// Bộ lọc: entity_type (KEY viết hoa), company_id, actor_id đọc từ query
// string và VALIDATE lại ở đây (plan: không tin thẳng query string người
// dùng có thể tự gõ vào URL) — giá trị sai bị bỏ qua thay vì để backend trả
// 400/422. 2 lệnh gọi ĐỘC LẬP chạy song song bằng Promise.allSettled (khớp
// ThreadPoolExecutor bên Flask) — 1 lệnh lỗi không kéo sập lệnh còn lại:
//   1. listAuditLogs (đã lọc)      2. listStaffUsers (dropdown người thực hiện)
// + lệnh thứ 3 CHỈ KHI đang lọc theo công ty: getCompany() lấy tên công ty
// hiển thị trên ô lọc. Khác Flask: không tải danh sách toàn bộ công ty cho
// dropdown (ô tìm công ty tự gọi /api/companies/search khi staff gõ).
//
// Phân trang (phần 3/5): `?page=` (50 log/trang, offset ở backend — log tăng
// không giới hạn nên không tải hết). `page` lạ/thiếu -> 1. Nếu `page` vượt
// tổng số trang (log bị bớt, link cũ) thì redirect về trang cuối đúng như
// Flask kẹp `min(page, total_pages)`, để URL luôn khớp nội dung. Dùng lại
// <Pagination> của /jobs (Trước/Sau là <Link> thật + ô "Tới trang" là form GET).

import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth-guard";
import { listAuditLogs, type AuditLogOut, type AuditLogView } from "@/lib/api/audit-logs";
import { listStaffUsers, type StaffUser } from "@/lib/api/auth";
import { getCompany } from "@/lib/api/companies";
import { AUDIT_ENTITY_LABELS } from "@/lib/constants";
import { ActivityLogsTabNav } from "./activity-logs-tab-nav";
import { ActivityLogsFilterBar } from "./activity-logs-filter-bar";
import { ActivityLogsTable } from "./activity-logs-table";
import { Pagination } from "../jobs/pagination";
import {
  buildActivityLogsHref,
  buildActivityLogsParams,
  hasActiveFilter,
  type ActivityLogFilterValues,
} from "./activity-logs-url";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Lịch sử thao tác — MindX Career Hub",
};

const PAGE_SIZE = 50;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SearchParams = { [key: string]: string | string[] | undefined };

function first(raw: string | string[] | undefined): string {
  return (Array.isArray(raw) ? raw[0] : raw) ?? "";
}

function parseView(raw: string | string[] | undefined): AuditLogView {
  return first(raw) === "manual" ? "manual" : "auto";
}

/** Số nguyên dương hợp lệ, còn lại -> 1. Chặn số quá lớn làm offset tràn. */
function parsePage(raw: string | string[] | undefined): number {
  const n = Number(first(raw));
  return Number.isInteger(n) && n >= 1 && n <= 100_000 ? n : 1;
}

function parseFilters(sp: SearchParams): ActivityLogFilterValues {
  const entityType = first(sp.entity_type);
  const companyId = first(sp.company_id);
  const actorId = first(sp.actor_id);
  return {
    entityType: Object.hasOwn(AUDIT_ENTITY_LABELS, entityType) ? entityType : "",
    companyId: UUID_RE.test(companyId) ? companyId : "",
    actorId: UUID_RE.test(actorId) ? actorId : "",
  };
}

function errorMessage(reason: unknown, fallback: string): string {
  return reason instanceof Error ? reason.message : fallback;
}

export default async function ActivityLogsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireStaff();
  const sp = await searchParams;
  const view = parseView(sp.view);
  const filters = parseFilters(sp);
  const page = parsePage(sp.page);

  const [logsRes, staffRes, companyRes] = await Promise.allSettled([
    listAuditLogs({
      view,
      entity_type: filters.entityType,
      company_id: filters.companyId,
      actor_id: filters.actorId,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    listStaffUsers(),
    filters.companyId ? getCompany(filters.companyId) : Promise.resolve(null),
  ]);

  // Vượt tổng số trang -> về trang cuối (redirect phải ở NGOÀI try/catch).
  if (logsRes.status === "fulfilled") {
    const lastPage = Math.max(1, Math.ceil(logsRes.value.total / PAGE_SIZE));
    if (page > lastPage) redirect(buildActivityLogsHref(view, filters, lastPage));
  }

  const errors: string[] = [];

  let logs: AuditLogOut[] = [];
  let total = 0;
  if (logsRes.status === "fulfilled") {
    logs = logsRes.value.items;
    total = logsRes.value.total;
  } else {
    errors.push(errorMessage(logsRes.reason, "Đã có lỗi khi tải lịch sử thao tác."));
  }

  let staffUsers: StaffUser[] = [];
  if (staffRes.status === "fulfilled") {
    staffUsers = staffRes.value;
  } else {
    errors.push(errorMessage(staffRes.reason, "Đã có lỗi khi tải danh sách người thực hiện."));
  }
  const staff = staffUsers.map((u) => ({ id: u.ss_user_id, name: u.full_name }));
  // Cho phần 5/5: đổi ss_user_id trong `changes` (người phụ trách) sang tên.
  const staffNames = Object.fromEntries(staff.map((s) => [s.id, s.name]));

  // getCompany() tự nuốt lỗi -> null; tên rỗng thì ô lọc hiện "Công ty đã chọn".
  const companyName = companyRes.status === "fulfilled" ? (companyRes.value?.company_name ?? "") : "";

  const filtered = hasActiveFilter(filters);
  const logsOk = logsRes.status === "fulfilled";
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <header>
        <span className="text-sm text-muted-foreground">Career Hub / Quản trị</span>
        <h1 className="font-heading text-3xl font-semibold">Lịch sử thao tác</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Nhật ký chi tiết từng thao tác theo thời gian — xem ai làm gì, khi nào, với ghi chú đi kèm.
        </p>
      </header>

      <ActivityLogsTabNav view={view} filters={filters} />

      <ActivityLogsFilterBar view={view} filters={filters} companyName={companyName} staff={staff} />

      {errors.map((msg, i) => (
        <p key={i} role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {msg}
        </p>
      ))}

      {logsOk && <p className="text-sm text-muted-foreground">{total} log phù hợp</p>}

      {logsOk && logs.length === 0 && (
        <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
          {filtered ? "Chưa có log nào khớp bộ lọc." : "Chưa có log nào."}
        </div>
      )}

      {logs.length > 0 && (
        <>
          <ActivityLogsTable logs={logs} currentUserId={user.ss_user_id} staffNames={staffNames} />
          <Pagination
            basePath="/activity-logs"
            currentParams={buildActivityLogsParams(view, filters)}
            page={page}
            totalPages={totalPages}
          />
        </>
      )}
    </div>
  );
}
