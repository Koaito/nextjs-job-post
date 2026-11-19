"use client";
// app/(app)/crawl/crawl-log-viewer.tsx
// Khung "Log live" của MỘT lượt crawl. Poll TĂNG DẦN: giữ `afterId` = last_id lần trước, chỉ nhận dòng mới, gộp vào
// danh sách (khử trùng theo id, cắt còn LOG_LINE_CAP dòng mới nhất). Chỉ poll khi lượt còn chạy; khi lượt vừa
// kết thúc gọi thêm đúng một lần để lấy nốt các dòng cuối. Phần hiển thị/tự cuộn nằm ở LogBox (dùng chung với tab Bảo trì).

import { useEffect, useRef, useState } from "react";
import type { CrawlLogLine, CrawlLogs } from "@/lib/data-ops/crawl";
import { appendLogs } from "@/lib/data-ops/crawl-live";
import { LogBox } from "./log-box";
import { usePolledJson } from "./use-polled-json";

const LOG_INTERVAL_MS = 2_000;

export function CrawlLogViewer({ runId, live }: { runId: string; live: boolean }) {
  const [lines, setLines] = useState<CrawlLogLine[]>([]);
  const [afterId, setAfterId] = useState(0);

  const { data, error, stopped, refresh } = usePolledJson<CrawlLogs>(
    `/api/crawl/runs/${runId}/logs?after_id=${afterId}`,
    { intervalMs: live ? LOG_INTERVAL_MS : 0 },
  );

  // Gộp dòng mới ngay lúc render (mẫu "điều chỉnh state theo dữ liệu mới" của React), không qua effect:
  // appendLogs khử trùng theo id nên xử lý lại cùng một phản hồi cũng vô hại.
  const [seen, setSeen] = useState<CrawlLogs | undefined>(undefined);
  if (data && data !== seen) {
    setSeen(data);
    if (data.items.length > 0) setLines((cur) => appendLogs(cur, data.items));
    // Đổi afterId đổi key SWR -> tự gọi ngay một lượt; lượt đó trả rỗng thì dừng (last_id không đổi).
    if (data.last_id > afterId) setAfterId(data.last_id);
  }

  // Lượt vừa kết thúc: lấy nốt các dòng log cuối rồi thôi.
  const wasLive = useRef(live);
  useEffect(() => {
    if (wasLive.current && !live) refresh();
    wasLive.current = live;
  }, [live, refresh]);

  return (
    <section aria-label="Log live" className="space-y-2">
      <h3 className="text-sm font-semibold">Log live</h3>
      <LogBox lines={lines} emptyText={live ? "Đang chờ log đầu tiên…" : "Lượt này chưa có log."} />
      {stopped ? (
        <p role="status" className="text-xs text-muted-foreground">
          Không còn cập nhật log (phiên hết hạn hoặc không đủ quyền). Tải lại trang để thử lại.
        </p>
      ) : error && lines.length === 0 ? (
        <p role="status" className="text-xs text-muted-foreground">
          Chưa lấy được log, đang thử lại…
        </p>
      ) : null}
    </section>
  );
}
