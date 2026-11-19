"use client";
// app/(app)/crawl/log-box.tsx
// Ô hiển thị log DÙNG CHUNG của tab Crawl (1 ô) và tab Bảo trì (5 ô). Chỉ lo phần HIỂN THỊ: danh sách dòng đã gộp sẵn,
// màu theo mức log, tự cuộn xuống cuối trừ khi người xem đã cuộn lên đọc. Việc poll/gộp dòng do nơi dùng đảm nhiệm.

import { useLayoutEffect, useRef } from "react";
import { formatLogTime } from "@/lib/data-ops/crawl-live";

export interface LogLineView {
  id: number;
  level: string;
  message: string;
  created_at: string;
}

const LEVEL_TONE: Record<string, string> = {
  ERROR: "text-red-600 dark:text-red-400",
  CRITICAL: "text-red-600 dark:text-red-400",
  WARNING: "text-amber-600 dark:text-amber-400",
};

export function LogBox({
  lines,
  emptyText,
  testId = "crawl-log",
  label,
  heightClass = "h-72",
}: {
  lines: LogLineView[];
  /** Nội dung khi chưa có dòng nào (tuỳ lượt đang chạy hay không). */
  emptyText: string;
  testId?: string;
  /** Tên truy cập được của vùng log (mỗi thẻ bảo trì một tên riêng). */
  label?: string;
  heightClass?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  useLayoutEffect(() => {
    const el = box.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    <div
      ref={box}
      data-testid={testId}
      role="log"
      aria-label={label}
      tabIndex={0}
      onScroll={(e) => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
      }}
      className={`${heightClass} overflow-y-auto rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed`}
    >
      {lines.length === 0 ? (
        <p className="text-muted-foreground">{emptyText}</p>
      ) : (
        lines.map((l) => (
          <div key={l.id} className={LEVEL_TONE[l.level.toUpperCase()] ?? ""}>
            <span className="text-muted-foreground">{formatLogTime(l.created_at)}</span> {l.message}
          </div>
        ))
      )}
    </div>
  );
}
