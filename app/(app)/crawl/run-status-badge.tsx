// app/(app)/crawl/run-status-badge.tsx
// Huy hiệu trạng thái run (crawl và bảo trì dùng chung). Không dựa vào màu một mình: luôn kèm chữ.

import { cn } from "@/lib/utils";
import { runStatusLabel } from "@/lib/data-ops/crawl-ui";

const TONE: Record<string, string> = {
  queued: "bg-muted text-muted-foreground",
  running: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  done: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  error: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
};

export function RunStatusBadge({ status }: { status: string }) {
  return (
    <span
      data-status={status}
      className={cn(
        "inline-block rounded-full px-2 py-[2px] text-xs font-medium",
        TONE[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {runStatusLabel(status)}
    </span>
  );
}
