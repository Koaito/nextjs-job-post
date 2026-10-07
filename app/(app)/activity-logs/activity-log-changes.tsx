// app/(app)/activity-logs/activity-log-changes.tsx
// Nội dung dòng con "Xem thay đổi" — mỗi dòng "tên trường: cũ -> mới" — Nhóm
// 3, Đợt 3.4, Phần 5/5. Dòng kind="info" (log MERGE_JOB) chỉ hiện một giá trị,
// không có mũi tên. Server Component thuần; dữ liệu đã chuẩn hoá ở
// lib/audit-changes.ts. Toàn bộ giá trị là text thuần (JSX tự escape), tuyệt
// đối không dangerouslySetInnerHTML (plan Nhóm 4).

import { cn } from "@/lib/utils";
import type { ChangeRow, ChangeValue } from "@/lib/audit-changes";

function Value({ value, tone }: { value: ChangeValue; tone: "old" | "new" }) {
  if (value.empty) return <span className="text-muted-foreground italic">(trống)</span>;
  return (
    <span
      className={cn(
        "break-words whitespace-pre-wrap",
        tone === "old" && "text-muted-foreground line-through decoration-muted-foreground/40",
        // Khối nhiều dòng/JSON: khung cuộn để 1 mô tả dài không đẩy dãn cả bảng.
        value.block && "block max-h-40 overflow-auto rounded bg-background/60 p-2",
      )}
    >
      {value.text}
    </span>
  );
}

export function ActivityLogChanges({ rows }: { rows: ChangeRow[] }) {
  return (
    <dl className="space-y-2 text-sm">
      {rows.map((row) => (
        <div key={row.field} className="grid gap-1 sm:grid-cols-[160px_1fr_auto_1fr] sm:items-start sm:gap-3">
          <dt className={cn("font-medium", !row.labelKnown && "font-mono text-xs text-muted-foreground")}>
            {row.label}
          </dt>
          {row.kind === "info" ? (
            // Dòng thông tin (log MERGE_JOB): chỉ một giá trị, không có "cũ -> mới".
            <dd className="min-w-0 sm:col-span-3">
              <Value value={row.new} tone="new" />
            </dd>
          ) : (
            <>
              <dd className="min-w-0">
                <Value value={row.old} tone="old" />
              </dd>
              <dd aria-hidden className="hidden text-muted-foreground sm:block">
                →
              </dd>
              <dd className="min-w-0">
                <Value value={row.new} tone="new" />
              </dd>
            </>
          )}
        </div>
      ))}
    </dl>
  );
}
