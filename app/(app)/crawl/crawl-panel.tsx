"use client";
// app/(app)/crawl/crawl-panel.tsx
// Khung tương tác của tab Crawl: form chạy (admin) + khối theo dõi (checklist batch, log live, kết quả).
// `target` = lượt/batch đang theo dõi. Ban đầu là lượt gần nhất (server truyền xuống), bấm chạy xong chuyển sang
// batch mới. Đổi `target` remount khối theo dõi (key) nên không lẫn log/tiến độ của batch cũ.

import { useState } from "react";
import type { SourcesMap } from "@/lib/data-ops/sources";
import { CrawlTriggerForm } from "./crawl-trigger-form";
import { BatchView, SingleRunView } from "./crawl-live-views";

export interface CrawlTarget {
  runId: string;
  batchId: string | null;
}

export function CrawlPanel({
  isAdmin,
  sources,
  initialTarget,
  latestLoadFailed,
}: {
  isAdmin: boolean;
  sources: SourcesMap | null;
  initialTarget: CrawlTarget | null;
  latestLoadFailed: boolean;
}) {
  const [target, setTarget] = useState<CrawlTarget | null>(initialTarget);

  return (
    <div className="space-y-6">
      {isAdmin ? (
        sources ? (
          <CrawlTriggerForm
            sources={sources}
            onStarted={({ batchId, firstRunId }) => setTarget({ batchId, runId: firstRunId })}
          />
        ) : (
          <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            Không tải được danh sách nguồn crawl. Tải lại trang để thử lại.
          </p>
        )
      ) : (
        <p data-testid="crawl-readonly-note" className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Bạn có thể xem tiến độ và log crawl. Chỉ admin mới được bấm chạy crawl.
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Hệ thống chỉ chạy tối đa 2 job nền cùng lúc (crawl và bảo trì cộng chung), nên một lượt mới có thể ở trạng thái
        &quot;Đang chờ&quot; một lúc. Khi hai nguồn crawl chạy song song, log của hai lượt có thể lẫn vào nhau; tên nguồn
        nằm trong nội dung từng dòng.
      </p>

      {target ? (
        target.batchId ? (
          <BatchView key={target.batchId} batchId={target.batchId} />
        ) : (
          <SingleRunView key={target.runId} runId={target.runId} />
        )
      ) : (
        <p
          data-testid="crawl-empty"
          className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground"
        >
          {latestLoadFailed ? "Chưa lấy được lượt crawl gần nhất." : "Chưa có lượt crawl nào."}
        </p>
      )}
    </div>
  );
}
