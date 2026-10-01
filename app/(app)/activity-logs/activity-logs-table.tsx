// app/(app)/activity-logs/activity-logs-table.tsx
// Bảng 7 cột của /activity-logs — tương đương <table class="activity-table">
// ở _activity_logs_body.html (Flask). Nhóm 3, Đợt 3.4, Phần 1/5.
// Server Component thuần. Cột cuối: nút "Sửa note" (phần 4/5, Client
// Component <EditNoteButton>) CHỈ hiện ở log do chính người đang đăng nhập
// tạo — backend trả 403 với mọi người khác kể cả admin (plan Nhóm 3), nên
// ẩn hẳn thay vì hiện ra rồi nhận lỗi. Hiện ở MỌI log của mình, kể cả log
// note_required (Flask ẩn ở đó): backend vẫn cho chỉnh lại câu chữ, chỉ chặn
// xoá trống, nên ô note trong dialog bắt buộc nhập.
//
// Khác Flask, có chủ đích (đã chốt với người dùng):
//  - Màu badge theo action_type (lib/constants.ts::auditActionTone).
//  - actor_id trống -> "Hệ thống (tự động)"; có actor_id mà tên trống ->
//    "Tài khoản đã bị xoá" (backend ghi rõ tên trống có thể do tài khoản đã
//    xoá). Flask gộp 2 trường hợp làm một.
//  - Log DELETE_JOB / DELETE_COMPANY VẪN link tới đối tượng (Phần 2/5 đổi
//    từ "không link" của Phần 1): backend không xoá thật mà xoá mềm — JD
//    chỉ đóng (PATCH job_status=CLOSED, không có endpoint DELETE), công ty
//    đặt is_active=false — nên đối tượng vẫn còn, kèm nhãn nhỏ "(đã đóng)"
//    / "(đã xoá)" để biết ngay đây là log xoá. Nhãn phản ánh THAO TÁC của
//    log, không phải trạng thái hiện tại (job có thể đã mở lại sau đó).
//    DELETE_CONTACT không có trang chi tiết riêng nên chỉ hiện chữ.
//  - Không tô nổi dòng "note_required mà thiếu note" (highlight-required):
//    backend chặn cứng từ lúc ghi nên log bắt buộc luôn có note.
//  - Giờ qua formatDateTimeVN (giờ VN, không phụ thuộc múi giờ máy chạy).
// Phần 5/5: log có `changes` có nút "Xem thay đổi" mở dòng con "tên trường:
// cũ -> mới" (ExpandableLogRow + ActivityLogChanges). Hiện theo "có changes"
// chứ không theo action_type: backend ghi changes cả ở ASSIGN_CONTACT và
// DELETE_JOB (đóng JD kèm sửa field), không riêng UPDATE_*.
// Note do người dùng nhập: chỉ render text thuần (JSX tự escape), tuyệt
// đối không dangerouslySetInnerHTML (plan Nhóm 4).

import Link from "next/link";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ACTION_TONE_CLASSES,
  AUDIT_ENTITY_LABELS,
  auditActionTone,
} from "@/lib/constants";
import { formatDateTimeVN } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { AuditLogOut } from "@/lib/api/audit-logs";
import { parseChanges } from "@/lib/audit-changes";
import { ActivityLogChanges } from "./activity-log-changes";
import { EditNoteButton } from "./edit-note-button";
import { ExpandableLogRow } from "./expandable-log-row";

function actorName(log: AuditLogOut): { text: string; muted: boolean } {
  if (!log.actor_id) return { text: "Hệ thống (tự động)", muted: true };
  if (!log.actor_name) return { text: "Tài khoản đã bị xoá", muted: true };
  return { text: log.actor_name, muted: false };
}

/** Nhãn nhỏ sau tên đối tượng cho log xoá/đóng (chỉ JOB/COMPANY — 2 loại
 *  có link). */
const DELETED_HINT: Record<string, string> = {
  DELETE_JOB: "(đã đóng)",
  DELETE_COMPANY: "(đã xoá)",
};

function EntityCell({ log }: { log: AuditLogOut }) {
  const typeLabel = AUDIT_ENTITY_LABELS[log.entity_type] ?? log.entity_type;
  // Chỉ JOB/COMPANY có trang chi tiết để link (Flask: CONTACT/APPLICATION
  // chỉ hiện chữ).
  // BULK_IMPORT_*: entity_id là id phiên preview import (không phải id JD/
  // công ty/contact) nên link sẽ trỏ tới trang không tồn tại -> chỉ hiện chữ.
  // EMAIL_TEMPLATE: không có trang chi tiết riêng (xoá là xoá cứng) -> chỉ chữ.
  const linkable = log.entity_id && !log.action_type.startsWith("BULK_IMPORT_");
  const href = linkable
    ? log.entity_type === "JOB"
      ? `/jobs/${log.entity_id}`
      : log.entity_type === "COMPANY"
        ? `/companies/${log.entity_id}`
        : null
    : null;
  const hint = href ? DELETED_HINT[log.action_type] : undefined;

  return (
    <>
      <strong>{typeLabel}:</strong>{" "}
      {href ? (
        <Link href={href} className="underline">
          {log.entity_label || log.entity_id}
        </Link>
      ) : (
        <span className="text-muted-foreground">{log.entity_label || "—"}</span>
      )}
      {hint && <span className="ml-1 text-xs text-muted-foreground">{hint}</span>}
    </>
  );
}

function CompanyCell({ log }: { log: AuditLogOut }) {
  if (!log.company_id) return <span className="text-muted-foreground">—</span>;
  // DELETE_COMPANY: công ty chỉ bị xoá mềm nên vẫn link; nếu tên hiện tại
  // (join sống) trống thì dùng nhãn snapshot lúc ghi log.
  const name = log.company_name || (log.action_type === "DELETE_COMPANY" ? log.entity_label : "") || "—";
  return (
    <Link href={`/companies/${log.company_id}`} className="underline">
      {name}
    </Link>
  );
}

const COLUMN_COUNT = 7;

export function ActivityLogsTable({
  logs,
  currentUserId,
  staffNames,
}: {
  logs: AuditLogOut[];
  currentUserId: string;
  /** ss_user_id -> họ tên, để hiện tên thay vì UUID ở "Người phụ trách". */
  staffNames: Record<string, string>;
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50 text-left">
          <tr>
            <th className="w-[140px] px-3 py-2 font-medium">Thời gian</th>
            <th className="w-[150px] px-3 py-2 font-medium">Người thực hiện</th>
            <th className="w-[120px] px-3 py-2 font-medium">Hành động</th>
            <th className="px-3 py-2 font-medium">Đối tượng</th>
            <th className="w-[200px] px-3 py-2 font-medium">Công ty liên quan</th>
            {/* Ghi chú LUÔN hiện (không chỉ tab Thủ công): vài action tự
                động như WITHDRAW_JOB_APPLICATION vẫn có note của chính
                học viên, ẩn cột này ở tab "Tự động" sẽ làm mất note đó. */}
            <th className="min-w-[250px] px-3 py-2 font-medium">Ghi chú</th>
            <th className="w-[130px] px-3 py-2 font-medium">
              <span className="sr-only">Thao tác</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => {
            const actor = actorName(log);
            const tone = auditActionTone(log.action_type);
            const changeRows = parseChanges(log.entity_type, log.changes, { staffNames });
            return (
              <ExpandableLogRow
                key={log.log_id}
                logId={log.log_id}
                colSpan={COLUMN_COUNT}
                cells={
                  <>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                      {formatDateTimeVN(log.created_at)}
                    </td>
                    <td className={cn("px-3 py-2", actor.muted && "text-muted-foreground")}>{actor.text}</td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "inline-block rounded-full px-[9px] py-1 text-[11px] font-semibold whitespace-nowrap",
                          AUDIT_ACTION_TONE_CLASSES[tone],
                        )}
                      >
                        {AUDIT_ACTION_LABELS[log.action_type] ?? log.action_type}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <EntityCell log={log} />
                    </td>
                    <td className="px-3 py-2">
                      <CompanyCell log={log} />
                    </td>
                    <td className="px-3 py-2">
                      {log.note ? (
                        <>
                          <div className="whitespace-pre-wrap">{log.note}</div>
                          {log.note_updated_at && (
                            <small className="text-muted-foreground">
                              (Sửa: {formatDateTimeVN(log.note_updated_at)})
                            </small>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </>
                }
                actions={
                  log.actor_id && log.actor_id === currentUserId ? (
                    <EditNoteButton
                      // Đổi key khi note đổi -> dialog dựng lại với note mới.
                      key={`${log.note_updated_at ?? ""}|${log.note ?? ""}`}
                      logId={log.log_id}
                      currentNote={log.note ?? ""}
                      logSummary={`${AUDIT_ACTION_LABELS[log.action_type] ?? log.action_type} — ${log.entity_label || log.entity_id}`}
                    />
                  ) : null
                }
                detail={changeRows.length > 0 ? <ActivityLogChanges rows={changeRows} /> : null}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
