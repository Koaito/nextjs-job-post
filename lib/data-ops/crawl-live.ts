// lib/data-ops/crawl-live.ts
// Phần THUẦN của khối "đang chạy / log live / kết quả" ở tab Crawl (Nhóm 6 phần 3c). Không gọi mạng.

import {
  buildBatchChecklist,
  isCrawlRunActive,
  readCrawlStats,
  type BatchChecklistItem,
  type CrawlBatchStatus,
  type CrawlLogLine,
  type CrawlRun,
} from "@/lib/data-ops/crawl";

/** Số dòng log giữ trong bộ nhớ/DOM; quá thì bỏ dòng CŨ nhất (log một lượt có thể hàng nghìn dòng). */
export const LOG_LINE_CAP = 500;

/**
 * Gộp dòng log mới vào danh sách đang hiện. Khử trùng theo `id` (hai lượt poll chồng nhau không nhân đôi dòng),
 * giữ thứ tự tăng dần theo id, cắt còn `cap` dòng MỚI nhất.
 */
export function appendLogs(existing: CrawlLogLine[], incoming: CrawlLogLine[], cap: number = LOG_LINE_CAP): CrawlLogLine[] {
  if (incoming.length === 0) return existing;
  const lastId = existing.length ? existing[existing.length - 1].id : -1;
  const fresh = incoming.filter((l) => l.id > lastId);
  if (fresh.length === 0) return existing;
  const merged = [...existing, ...fresh];
  return merged.length > cap ? merged.slice(merged.length - cap) : merged;
}

/**
 * Lượt cần xem log live trong một batch: lượt ĐANG chạy (queued/running); không có thì lượt bắt đầu SAU CÙNG
 * (batch vừa xong xem lại lượt cuối). Chưa lượt nào bắt đầu -> null. Khớp theo checklist (tên category), không
 * theo vị trí mảng.
 */
export function pickFollowedRun(batch: Pick<CrawlBatchStatus, "categories" | "items">): CrawlRun | null {
  const runs = buildBatchChecklist(batch)
    .map((i) => i.run)
    .filter((r): r is CrawlRun => Boolean(r));
  if (runs.length === 0) return null;
  const active = runs.find((r) => isCrawlRunActive(r.status));
  if (active) return active;
  return runs.reduce((a, b) => (Date.parse(b.started_at) >= Date.parse(a.started_at) ? b : a));
}

/** "2/6 category xong". `completed` không tính lượt đang chạy/chờ (backend đã tính sẵn). */
export function batchProgressText(batch: Pick<CrawlBatchStatus, "completed" | "total">): string {
  return `${batch.completed}/${batch.total} category xong`;
}

export const CHECKLIST_STATE_LABELS: Record<BatchChecklistItem["state"], string> = {
  waiting: "Đang chờ",
  queued: "Đang chờ",
  running: "Đang chạy",
  done: "Hoàn tất",
  error: "Lỗi",
};

export interface ResultTile {
  key: string;
  label: string;
  value: number;
}

/**
 * 8 số liệu chính của một lượt crawl xong. Khoá thiếu/không phải số -> 0 (backend chỉ ghi khoá optional khi > 0,
 * nhưng các khoá lõi luôn có; vẫn phòng thủ để không hiện "undefined"/NaN). Chưa có stats -> [].
 */
export function crawlResultTiles(run: Pick<CrawlRun, "stats">): ResultTile[] {
  const stats = readCrawlStats(run);
  if (!stats) return [];
  const n = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return [
    { key: "fetched", label: "Đã tải", value: n(stats.fetched) },
    { key: "inserted", label: "Thêm mới", value: n(stats.inserted) },
    { key: "updated_existing", label: "Cập nhật", value: n(stats.updated_existing) },
    { key: "skipped_duplicate", label: "Trùng URL", value: n(stats.skipped_duplicate) },
    { key: "skipped_duplicate_repost", label: "Tin đăng lại", value: n(stats.skipped_duplicate_repost) },
    { key: "skipped_fetch_failed", label: "Tải chi tiết lỗi", value: n(stats.skipped_fetch_failed) },
    { key: "skipped_anonymous_employer", label: "Bỏ (ẩn danh)", value: n(stats.skipped_anonymous_employer) },
    { key: "errors", label: "Lỗi", value: n(stats.errors) },
  ];
}

/** Cảnh báo cần nêu rõ cạnh kết quả: bị chặn, hoặc xong nhưng dữ liệu nghi hỏng (kèm lý do nếu có). */
export function crawlResultWarnings(run: Pick<CrawlRun, "stats">): string[] {
  const stats = readCrawlStats(run);
  if (!stats) return [];
  const out: string[] = [];
  if (stats.blocked) out.push("Nguồn đã chặn lượt crawl này (trang đầu thất bại hoặc ngắt mạch giữa chừng).");
  if (stats.degraded) {
    const reasons = Array.isArray(stats.degraded.reasons) ? stats.degraded.reasons.filter((r) => typeof r === "string") : [];
    out.push(
      reasons.length
        ? `Dữ liệu lượt này nghi hỏng: ${reasons.join("; ")}.`
        : "Dữ liệu lượt này nghi hỏng, nên kiểm tra lại trước khi dùng.",
    );
  }
  return out;
}

/** HH:mm:ss theo giờ Việt Nam; không parse được -> "". */
export function formatLogTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(d);
}

/** Heartbeat khi đang chạy: "Đã tải 12 · Thêm mới 3"; chưa có -> null. */
export function progressText(run: Pick<CrawlRun, "progress">): string | null {
  const p = run.progress as { fetched?: unknown; inserted?: unknown } | null | undefined;
  if (!p || typeof p !== "object") return null;
  if (typeof p.fetched !== "number" || typeof p.inserted !== "number") return null;
  return `Đã tải ${p.fetched} · Thêm mới ${p.inserted}`;
}
