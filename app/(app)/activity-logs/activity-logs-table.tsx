// app/(app)/activity-logs/activity-logs-table.tsx
// Bảng 7 cột của /activity-logs — tương đương <table class="activity-table">
// ở _activity_logs_body.html (Flask). Nhóm 3, Đợt 3.4, Phần 1/5.
// Server Component thuần. Cột cuối (nút "Sửa note") để trống ở phần này,
// thêm ở phần 4/5 (server action + Dialog).
//
// Khác Flask, có chủ đích (đã chốt với người dùng):
//  - Màu badge theo action_type (lib/constants.ts::auditActionTone).
//  - actor_id trống -> "Hệ thống (tự động)"; có actor_id mà tên trống ->
//    "Tài khoản đã bị xoá" (backend ghi rõ tên trống có thể do tài khoản đã
//    xoá). Flask gộp 2 trường hợp làm một.
//  - Log DELETE_*: KHÔNG gắn link tới đối tượng (đã xoá -> link ra 404),
//    chỉ hiện entity_label snapshot dạng chữ. Cột "Công ty liên quan" của
//    DELETE_COMPANY cũng không link vì company_id chính là công ty đã xoá.
//  - Không tô nổi dòng "note_required mà thiếu note" (highlight-required):
//    backend chặn cứng từ lúc ghi nên log bắt buộc luôn có note.
//  - Giờ qua formatDateTimeVN (giờ VN, không phụ thuộc múi giờ máy chạy).
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

function actorName(log: AuditLogOut): { text: string; muted: boolean } {
  if (!log.actor_id) return { text: "Hệ thống (tự động)", muted: true };
  if (!log.actor_name) return { text: "Tài khoản đã bị xoá", muted: true };
  return { text: log.actor_name, muted: false };
}

function EntityCell({ log }: { log: AuditLogOut }) {
  const typeLabel = AUDIT_ENTITY_LABELS[log.entity_type] ?? log.entity_type;
  const isDelete = log.action_type.startsWith("DELETE_");
  // Chỉ JOB/COMPANY có trang chi tiết để link (Flask: CONTACT/APPLICATION
  // chỉ hiện chữ). Đối tượng đã xoá thì không link.
  const href =
    !isDelete && log.entity_id
      ? log.entity_type === "JOB"
        ? `/jobs/${log.entity_id}`
        : log.entity_type === "COMPANY"
          ? `/companies/${log.entity_id}`
          : null
      : null;

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
    </>
  );
}

function CompanyCell({ log }: { log: AuditLogOut }) {
  if (!log.company_id) return <span className="text-muted-foreground">—</span>;
  // DELETE_COMPANY: company_id là công ty vừa bị xoá -> không link; tên
  // hiện tại (join sống) đã trống nên dùng nhãn snapshot lúc ghi log.
  if (log.action_type === "DELETE_COMPANY") {
    return <span className="text-muted-foreground">{log.company_name || log.entity_label || "—"}</span>;
  }
  return (
    <Link href={`/companies/${log.company_id}`} className="underline">
      {log.company_name || "—"}
    </Link>
  );
}

export function ActivityLogsTable({ logs }: { logs: AuditLogOut[] }) {
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
            <th className="w-[100px] px-3 py-2 font-medium">
              <span className="sr-only">Thao tác</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => {
            const actor = actorName(log);
            const tone = auditActionTone(log.action_type);
            return (
              <tr key={log.log_id} className="border-b align-top last:border-0">
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
                        <small className="text-muted-foreground">(Sửa: {formatDateTimeVN(log.note_updated_at)})</small>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2">{/* Nút "Sửa note": phần 4/5. */}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
