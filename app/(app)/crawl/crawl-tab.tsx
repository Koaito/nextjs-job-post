// app/(app)/crawl/crawl-tab.tsx
// Tab "Crawl" (Server Component): dựng NGAY trong lần tải đầu (không có trạng thái loading thừa cho tab mặc định) —
// danh sách nguồn/category (GET /sources, public) và lượt crawl gần nhất (để khung Log live có run_id ngay cả khi
// chưa bấm gì). Phần tương tác + polling nằm ở CrawlPanel (Client Component).
//
// Quyền: staff xem toàn bộ; form bấm chạy chỉ hiện cho admin (cả route POST cũng chặn lần nữa).

import { ApiError } from "@/lib/api/client";
import { getLatestCrawlLogRun } from "@/lib/api/crawl";
import { getSources } from "@/lib/api/sources";
import type { SourcesMap } from "@/lib/data-ops/sources";
import { CrawlPanel, type CrawlTarget } from "./crawl-panel";

async function safe<T>(fn: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false }> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    // Hết phiên / bị đăng nhập nơi khác: để cơ chế chung xử lý, đừng nuốt thành "lỗi tải".
    if (err instanceof ApiError && err.status === 401) throw err;
    return { ok: false };
  }
}

export async function CrawlTab({ isAdmin }: { isAdmin: boolean }) {
  const [sources, latest] = await Promise.all([safe(() => getSources()), safe(() => getLatestCrawlLogRun())]);

  const initialTarget: CrawlTarget | null =
    latest.ok && latest.data
      ? { runId: latest.data.run_id, batchId: latest.data.batch_id ?? null }
      : null;

  return (
    <CrawlPanel
      isAdmin={isAdmin}
      sources={sources.ok ? (sources.data as SourcesMap) : null}
      initialTarget={initialTarget}
      latestLoadFailed={!latest.ok}
    />
  );
}
