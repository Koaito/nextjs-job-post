import { describe, expect, it } from "vitest";
import {
  appendLogs,
  batchProgressText,
  crawlResultTiles,
  crawlResultWarnings,
  formatLogTime,
  LOG_LINE_CAP,
  pickFollowedRun,
  progressText,
} from "@/lib/data-ops/crawl-live";

const line = (id: number, message = `m${id}`) => ({ id, level: "INFO", message, created_at: "2026-11-16T00:00:00Z" });
const run = (category: string, status: string, startedAt: string, extra: Record<string, unknown> = {}) =>
  ({ run_id: `r-${category}`, source: "topcv", category, status, started_at: startedAt, ...extra }) as never;

describe("appendLogs", () => {
  it("nối dòng mới, giữ thứ tự", () => {
    expect(appendLogs([line(1), line(2)], [line(3)]).map((l) => l.id)).toEqual([1, 2, 3]);
  });
  it("khử trùng khi hai lượt poll chồng nhau", () => {
    const merged = appendLogs([line(1), line(2)], [line(2), line(3)]);
    expect(merged.map((l) => l.id)).toEqual([1, 2, 3]);
  });
  it("không có dòng mới -> trả đúng mảng cũ (không render lại vô ích)", () => {
    const cur = [line(1)];
    expect(appendLogs(cur, [])).toBe(cur);
    expect(appendLogs(cur, [line(1)])).toBe(cur);
  });
  it("cắt còn cap dòng MỚI nhất", () => {
    const cur = Array.from({ length: 5 }, (_, i) => line(i + 1));
    const merged = appendLogs(cur, [line(6), line(7)], 4);
    expect(merged.map((l) => l.id)).toEqual([4, 5, 6, 7]);
    expect(LOG_LINE_CAP).toBeGreaterThan(100);
  });
});

describe("pickFollowedRun", () => {
  const cats = ["a", "b", "c"];
  it("ưu tiên lượt đang chạy; khớp theo tên, không theo vị trí mảng", () => {
    const batch = {
      categories: cats,
      items: [run("b", "running", "2026-11-16T02:00:00Z"), run("a", "done", "2026-11-16T01:00:00Z")],
    };
    expect(pickFollowedRun(batch)?.category).toBe("b");
  });
  it("không còn lượt chạy -> lượt bắt đầu SAU CÙNG", () => {
    const batch = {
      categories: cats,
      items: [run("a", "done", "2026-11-16T01:00:00Z"), run("c", "error", "2026-11-16T03:00:00Z"), run("b", "done", "2026-11-16T02:00:00Z")],
    };
    expect(pickFollowedRun(batch)?.category).toBe("c");
  });
  it("chưa lượt nào bắt đầu -> null", () => {
    expect(pickFollowedRun({ categories: cats, items: [] })).toBeNull();
  });
  it("lượt đang chạy thắng kể cả khi một lượt đã xong có giờ bắt đầu MUỘN hơn", () => {
    const batch = { categories: cats, items: [run("a", "running", "2026-11-16T01:00:00Z"), run("b", "done", "2026-11-16T05:00:00Z")] };
    expect(pickFollowedRun(batch)?.category).toBe("a");
  });
  it("lượt queued cũng được coi là đang chờ chạy", () => {
    const batch = { categories: cats, items: [run("a", "done", "2026-11-16T01:00:00Z"), run("b", "queued", "2026-11-16T02:00:00Z")] };
    expect(pickFollowedRun(batch)?.category).toBe("b");
  });
});

describe("batchProgressText", () => {
  it("2/6 category xong", () => {
    expect(batchProgressText({ completed: 2, total: 6 })).toBe("2/6 category xong");
  });
});

describe("crawlResultTiles", () => {
  it("8 số liệu theo thứ tự; khoá thiếu thành 0, không NaN/undefined", () => {
    const tiles = crawlResultTiles({ stats: { fetched: 40, inserted: 12, errors: 1 } });
    expect(tiles).toHaveLength(8);
    expect(tiles.map((t) => t.key)).toEqual([
      "fetched", "inserted", "updated_existing", "skipped_duplicate",
      "skipped_duplicate_repost", "skipped_fetch_failed", "skipped_anonymous_employer", "errors",
    ]);
    expect(tiles.find((t) => t.key === "fetched")?.value).toBe(40);
    expect(tiles.find((t) => t.key === "updated_existing")?.value).toBe(0);
    for (const t of tiles) expect(Number.isFinite(t.value)).toBe(true);
  });
  it("giá trị không phải số -> 0; chưa có stats -> []", () => {
    expect(crawlResultTiles({ stats: { fetched: "40" } })[0].value).toBe(0);
    expect(crawlResultTiles({ stats: null })).toEqual([]);
    expect(crawlResultTiles({})).toEqual([]);
  });
});

describe("crawlResultWarnings", () => {
  it("bị chặn và nghi hỏng đều được nêu; nghi hỏng kèm lý do", () => {
    expect(crawlResultWarnings({ stats: { blocked: true } })[0]).toMatch(/chặn/);
    const w = crawlResultWarnings({ stats: { degraded: { reasons: ["tỷ lệ trống cao", "thiếu mô tả"] } } });
    expect(w[0]).toContain("tỷ lệ trống cao; thiếu mô tả");
  });
  it("nghi hỏng không có lý do vẫn có cảnh báo chung; bình thường -> không cảnh báo", () => {
    expect(crawlResultWarnings({ stats: { degraded: {} } })[0]).toMatch(/nghi hỏng/);
    expect(crawlResultWarnings({ stats: { fetched: 3 } })).toEqual([]);
    expect(crawlResultWarnings({ stats: null })).toEqual([]);
  });
});

describe("progressText / formatLogTime", () => {
  it("heartbeat hợp lệ; thiếu hoặc sai kiểu -> null", () => {
    expect(progressText({ progress: { fetched: 12, inserted: 3, last_update: "x" } })).toBe("Đã tải 12 · Thêm mới 3");
    expect(progressText({ progress: null })).toBeNull();
    expect(progressText({ progress: { fetched: "12" } as never })).toBeNull();
  });
  it("giờ Việt Nam HH:mm:ss; sai định dạng -> rỗng", () => {
    expect(formatLogTime("2026-11-16T00:00:05Z")).toBe("07:00:05");
    expect(formatLogTime("không phải ngày")).toBe("");
  });
});
