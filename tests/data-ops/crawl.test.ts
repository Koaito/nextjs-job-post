import { describe, expect, it } from "vitest";
import {
  buildBatchChecklist,
  isCrawlRunActive,
  readCrawlProgress,
  readCrawlStats,
  type CrawlRun,
} from "@/lib/data-ops/crawl";

/** Run tối thiểu cho test; ép kiểu vì chỉ category/status được đọc. */
function run(category: string, status: string, extra: Record<string, unknown> = {}): CrawlRun {
  return { category, status, ...extra } as unknown as CrawlRun;
}

describe("isCrawlRunActive", () => {
  it("queued và running là đang chạy", () => {
    expect(isCrawlRunActive("queued")).toBe(true);
    expect(isCrawlRunActive("running")).toBe(true);
  });
  it("done / error / giá trị lạ là đã kết thúc (dừng polling)", () => {
    expect(isCrawlRunActive("done")).toBe(false);
    expect(isCrawlRunActive("error")).toBe(false);
    expect(isCrawlRunActive("")).toBe(false);
    expect(isCrawlRunActive("RUNNING")).toBe(false);
  });
});

describe("readCrawlStats / readCrawlProgress", () => {
  it("trả object khi hợp lệ", () => {
    expect(readCrawlStats({ stats: { fetched: 5 } } as never)).toEqual({ fetched: 5 });
    expect(readCrawlProgress({ progress: { fetched: 1, inserted: 0, last_update: "t" } } as never)).toEqual({
      fetched: 1,
      inserted: 0,
      last_update: "t",
    });
  });

  it("null / undefined / không phải object -> null", () => {
    expect(readCrawlStats({ stats: null } as never)).toBeNull();
    expect(readCrawlStats({ stats: undefined } as never)).toBeNull();
    expect(readCrawlStats({ stats: "x" } as never)).toBeNull();
    expect(readCrawlProgress({ progress: null } as never)).toBeNull();
    expect(readCrawlProgress({ progress: 5 } as never)).toBeNull();
  });
});

describe("buildBatchChecklist", () => {
  it("giữ thứ tự batch.categories, khớp items theo TÊN (không theo vị trí)", () => {
    const items = [run("c", "done"), run("a", "running")]; // thứ tự items khác categories
    const out = buildBatchChecklist({ categories: ["a", "b", "c"], items });
    expect(out.map((i) => i.category)).toEqual(["a", "b", "c"]);
    expect(out.map((i) => i.state)).toEqual(["running", "waiting", "done"]);
  });

  it("category chưa có record -> waiting, không có run", () => {
    const [item] = buildBatchChecklist({ categories: ["x"], items: [] });
    expect(item).toEqual({ category: "x", state: "waiting" });
    expect(item.run).toBeUndefined();
  });

  it("gắn đúng run vào item", () => {
    const r = run("a", "error");
    const [item] = buildBatchChecklist({ categories: ["a"], items: [r] });
    expect(item.run).toBe(r);
    expect(item.state).toBe("error");
  });

  it("run của category không nằm trong categories bị bỏ qua", () => {
    const out = buildBatchChecklist({ categories: ["a"], items: [run("zzz", "done")] });
    expect(out).toHaveLength(1);
    expect(out[0].state).toBe("waiting");
  });

  it("categories rỗng -> mảng rỗng", () => {
    expect(buildBatchChecklist({ categories: [], items: [run("a", "done")] })).toEqual([]);
  });

  it("trùng tên category trong items: bản ghi SAU thắng", () => {
    const first = run("a", "error");
    const second = run("a", "done");
    const [item] = buildBatchChecklist({ categories: ["a"], items: [first, second] });
    expect(item.run).toBe(second);
  });
});
