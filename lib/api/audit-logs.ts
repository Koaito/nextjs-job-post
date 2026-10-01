// lib/api/audit-logs.ts
// Tương đương crawler_client/audit_logs.py bên Flask (phần ĐỌC). Nhóm 3,
// Đợt 3.4, Phần 1/5. Sửa note (PATCH /audit-logs/{id}/note) thuộc phần
// 4/5, thêm vào file này sau.
//
// GET /audit-logs yêu cầu require_role("ss_team") qua JWT (không chỉ API
// key như /jobs, /companies công khai) -> callAuthed(), KHÔNG callPublic().
// callAuthed mặc định no-store: lịch sử thao tác không được cache giữa
// các lần đổi tab/lọc/trang (plan Nhóm 2-3).
//
// KHÁC Flask: Flask chuẩn hoá response sang field riêng (id, action_label,
// entity_label_type, actor_name có sẵn "Hệ thống (tự động)"...). Ở đây giữ
// NGUYÊN AuditLogOut của backend, nhãn tra ở nơi hiển thị qua bảng trong
// lib/constants.ts — riêng trường hợp actor_id trống vs tài khoản đã xoá
// cần phân biệt (Flask gộp làm một), nên không thể chuẩn hoá sớm ở đây.

import { callAuthed } from "./client";
import type { components } from "./types";

export type AuditLogOut = components["schemas"]["AuditLogOut"];
export type PaginatedAuditLogs = components["schemas"]["PaginatedAuditLogs"];

/** 2 CÁCH LỌC trên CÙNG 1 bảng (plan Nhóm 3): `auto` = mọi thao tác,
 *  `manual` = tập con thao tác nhạy cảm kèm note. Không phải 2 nguồn riêng. */
export type AuditLogView = "auto" | "manual";

export interface AuditLogFilters {
  view?: AuditLogView;
  /** KEY viết hoa backend (JOB/COMPANY/CONTACT/APPLICATION), không phải nhãn. */
  entity_type?: string;
  company_id?: string;
  actor_id?: string;
  action_type?: string;
  /** Chỉ có nghĩa khi view=manual. Hiện chưa dùng (đã bỏ badge "thiếu note"
   *  vì log note_required luôn có note từ lúc ghi) — giữ tham số để thêm
   *  lại chỉ mất một dòng nếu sau này có dữ liệu cũ thiếu note. */
  pending_note?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * GET /audit-logs — 1 trang log, đã lọc + phân trang ở backend (log tăng
 * không giới hạn nên KHÔNG tải hết về rồi cắt ở client). Chỉ gửi tham số
 * có giá trị (chuỗi rỗng bị bỏ), khớp list_audit_logs() bên Flask.
 */
export async function listAuditLogs(filters: AuditLogFilters = {}): Promise<PaginatedAuditLogs> {
  const params = new URLSearchParams();
  params.set("view", filters.view ?? "auto");
  params.set("limit", String(filters.limit ?? 50));
  params.set("offset", String(filters.offset ?? 0));
  if (filters.entity_type) params.set("entity_type", filters.entity_type);
  if (filters.company_id) params.set("company_id", filters.company_id);
  if (filters.actor_id) params.set("actor_id", filters.actor_id);
  if (filters.action_type) params.set("action_type", filters.action_type);
  if (filters.pending_note !== undefined) params.set("pending_note", filters.pending_note ? "true" : "false");
  return callAuthed<PaginatedAuditLogs>(`/audit-logs?${params.toString()}`);
}
