"use client";
// app/(app)/crawl/use-maintenance-logs.ts
// MỘT hook lấy log cho cả 5 khung của tab Bảo trì bằng MỘT request logs-batch (thay vì 5 vòng poll riêng, bản Flask
// từng bắn 5 request mỗi 2 giây). Hỏi những run chưa "settled" (planLogCursors), gộp phản hồi vào state (applyLogsBatch).
//
// Poll tăng dần: afterId của run nào tăng thì URL đổi -> SWR gọi ngay một lượt; lượt trả rỗng thì URL không đổi nên dừng
// (chỉ còn chu kỳ 2 giây khi vẫn có job đang chạy). Khi job cuối cùng xong, gọi thêm một lần để lấy nốt dòng cuối; run đã
// settled rời khỏi danh sách hỏi nên không còn request nào.

import { useEffect, useRef, useState } from "react";
import type { MaintenanceLogs } from "@/lib/data-ops/maintenance";
import {
  applyLogsBatch,
  logsBatchUrl,
  planLogCursors,
  type LatestMaintenanceRuns,
  type LogsByRun,
} from "@/lib/data-ops/maintenance-live";
import { usePolledJson } from "./use-polled-json";

const LOG_INTERVAL_MS = 2_000;

export function useMaintenanceLogs(runs: Partial<LatestMaintenanceRuns>, anyActive: boolean) {
  const [logs, setLogs] = useState<LogsByRun>({});
  const url = logsBatchUrl(planLogCursors(runs, logs));

  const { data, error, stopped, refresh } = usePolledJson<Record<string, MaintenanceLogs>>(url, {
    intervalMs: anyActive ? LOG_INTERVAL_MS : 0,
  });

  // Gộp phản hồi mới ngay lúc render (mẫu "điều chỉnh state theo dữ liệu mới" của React), không qua effect.
  // applyLogsBatch khử trùng theo id nên xử lý lại cùng một phản hồi cũng vô hại.
  const [seen, setSeen] = useState<Record<string, MaintenanceLogs> | undefined>(undefined);
  if (data && data !== seen) {
    setSeen(data);
    setLogs((cur) => applyLogsBatch(cur, runs, data));
  }

  // Job cuối cùng vừa xong: lấy nốt các dòng log cuối rồi thôi (chu kỳ đã về 0 nên không tự gọi nữa).
  const wasActive = useRef(anyActive);
  useEffect(() => {
    if (wasActive.current && !anyActive) refresh();
    wasActive.current = anyActive;
  }, [anyActive, refresh]);

  return { logs, error, stopped };
}
