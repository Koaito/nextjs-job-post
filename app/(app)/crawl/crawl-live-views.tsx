"use client";
// app/(app)/crawl/crawl-live-views.tsx
// Khối theo dõi của tab Crawl: BatchView (checklist category + lượt đang chạy) và SingleRunView (lượt lẻ cũ, không
// thuộc batch). Cả hai dùng RunLive: trạng thái/tiến độ/kết quả của MỘT lượt + khung log live.
//
// Poll chỉ chạy khi còn thứ để chờ: batch còn `running`, lượt còn queued/running. Xong là tự dừng (chu kỳ trả 0).

import { RunStatusBadge } from "./run-status-badge";
import { CrawlLogViewer } from "./crawl-log-viewer";
import { usePolledJson } from "./use-polled-json";
import {
  buildBatchChecklist,
  isCrawlRunActive,
  type CrawlBatchStatus,
  type CrawlRun,
} from "@/lib/data-ops/crawl";
import {
  CHECKLIST_STATE_LABELS,
  batchProgressText,
  crawlResultTiles,
  crawlResultWarnings,
  pickFollowedRun,
  progressText,
} from "@/lib/data-ops/crawl-live";
import { formatDuration } from "@/lib/data-ops/crawl-ui";
import { formatShortDateTimeVN } from "@/lib/date";

const POLL_MS = 3_000;

function PollNote({ stopped, error, hasData }: { stopped: boolean; error: unknown; hasData: boolean }) {
  if (stopped) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Không còn cập nhật tiến độ (phiên hết hạn hoặc không đủ quyền). Tải lại trang để thử lại.
      </p>
    );
  }
  if (error && !hasData) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Chưa lấy được tiến độ, đang thử lại…
      </p>
    );
  }
  return null;
}

/** Trạng thái, tiến độ, kết quả của MỘT lượt + log live. */
function RunLive({ run }: { run: CrawlRun }) {
  const live = isCrawlRunActive(run.status);
  const tiles = live ? [] : crawlResultTiles(run);
  const warnings = live ? [] : crawlResultWarnings(run);
  const progress = live ? progressText(run) : null;
  const duration = live ? null : formatDuration(run.started_at, run.finished_at);

  return (
    <div className="space-y-4" data-testid="crawl-run" data-run-id={run.run_id}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <RunStatusBadge status={run.status} />
        <span className="font-medium">
          {run.source} · {run.category}
        </span>
        <span className="text-muted-foreground">
          · bắt đầu {formatShortDateTimeVN(run.started_at)}
          {duration ? ` · ${duration}` : ""}
          {run.triggered_by_name ? ` · ${run.triggered_by_name}` : ""}
        </span>
      </div>

      {progress ? <p className="text-sm text-muted-foreground">{progress}</p> : null}

      {run.status === "error" && run.error ? (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {run.error}
        </p>
      ) : null}

      {warnings.map((w) => (
        <p key={w} role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {w}
        </p>
      ))}

      {tiles.length > 0 ? (
        <dl data-testid="crawl-result" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.key} className="rounded-md border p-3">
              <dt className="text-xs text-muted-foreground">{t.label}</dt>
              <dd className="font-mono text-xl font-semibold">{t.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <CrawlLogViewer runId={run.run_id} live={live} />
    </div>
  );
}

/** Lượt lẻ (không thuộc batch): poll tới khi xong. */
export function SingleRunView({ runId }: { runId: string }) {
  const { data, error, stopped } = usePolledJson<CrawlRun>(`/api/crawl/runs/${runId}`, {
    intervalMs: (latest) => (latest && !isCrawlRunActive(latest.status) ? 0 : POLL_MS),
  });
  return (
    <section aria-label="Lượt crawl" className="space-y-3">
      <h2 className="font-heading text-lg font-semibold">Lượt crawl gần nhất</h2>
      <PollNote stopped={stopped} error={error} hasData={Boolean(data)} />
      {data ? <RunLive run={data} /> : <p className="text-sm text-muted-foreground">Đang tải…</p>}
    </section>
  );
}

/** Batch: checklist theo TÊN category (chưa tới lượt -> "Đang chờ") + lượt đang chạy. */
export function BatchView({ batchId }: { batchId: string }) {
  const { data, error, stopped } = usePolledJson<CrawlBatchStatus>(`/api/crawl/batches/${batchId}`, {
    intervalMs: (latest) => (latest && latest.status !== "running" ? 0 : POLL_MS),
  });

  const checklist = data ? buildBatchChecklist(data) : [];
  const followed = data ? pickFollowedRun(data) : null;

  return (
    <section aria-label="Batch crawl" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-lg font-semibold">
          Batch crawl {data ? `· ${data.source}` : ""}
        </h2>
        {data ? (
          <span data-testid="batch-progress" className="text-sm text-muted-foreground">
            {batchProgressText(data)}
          </span>
        ) : null}
      </div>
      <PollNote stopped={stopped} error={error} hasData={Boolean(data)} />
      {!data ? <p className="text-sm text-muted-foreground">Đang tải…</p> : null}

      {data?.status === "error" && data.error ? (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {data.error}
        </p>
      ) : null}

      {checklist.length > 0 ? (
        <ul data-testid="batch-checklist" className="divide-y rounded-md border text-sm">
          {checklist.map((item) => (
            <li key={item.category} className="flex items-center justify-between gap-3 px-3 py-2" data-state={item.state}>
              <span>{item.category}</span>
              <span className="flex items-center gap-2">
                {item.state === "waiting" ? (
                  <span className="rounded-full bg-muted px-2 py-[2px] text-xs font-medium text-muted-foreground">
                    {CHECKLIST_STATE_LABELS.waiting}
                  </span>
                ) : (
                  <RunStatusBadge status={item.state} />
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {followed ? <RunLive key={followed.run_id} run={followed} /> : data ? (
        <p className="text-sm text-muted-foreground">Chưa có lượt nào bắt đầu chạy.</p>
      ) : null}
    </section>
  );
}
