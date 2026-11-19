import { describe, expect, it } from "vitest";
import {
  mergeActiveCrawl,
  mergeActiveMaintenance,
  selectActiveRuns,
  type ActiveRunsPayload,
} from "@/lib/data-ops/active-runs";

const crawlRun = (over: Record<string, unknown>) =>
  ({
    run_id: "c1",
    status: "running",
    source: "topcv",
    category: "data-analyst",
    pages: 1,
    started_at: "2026-11-16T01:00:00Z",
    triggered_by_name: "Admin",
    batch_position: null,
    ...over,
  }) as never;

const maintRun = (over: Record<string, unknown>) =>
  ({
    run_id: "m1",
    job_type: "check_expired_jobs",
    status: "running",
    params: {},
    started_at: "2026-11-16T02:00:00Z",
    triggered_by_name: null,
    ...over,
  }) as never;

describe("mergeActiveCrawl", () => {
  it("gộp queued + running, khử trùng theo run_id, cũ nhất trước", () => {
    const merged = mergeActiveCrawl(
      [crawlRun({ run_id: "b", status: "queued", started_at: "2026-11-16T03:00:00Z" })],
      [
        crawlRun({ run_id: "a", started_at: "2026-11-16T01:00:00Z" }),
        crawlRun({ run_id: "b", status: "running", started_at: "2026-11-16T03:00:00Z" }),
      ],
    );
    expect(merged.map((m) => m.runId)).toEqual(["a", "b"]);
    expect(merged[1].status).toBe("running"); // bản sau thắng khi trùng
  });
  it("trùng giờ bắt đầu: ổn định theo run_id", () => {
    const t = "2026-11-16T01:00:00Z";
    const merged = mergeActiveCrawl([crawlRun({ run_id: "z", started_at: t }), crawlRun({ run_id: "m", started_at: t })]);
    expect(merged.map((m) => m.runId)).toEqual(["m", "z"]);
  });
  it("giữ batch_position và tên người chạy (thiếu -> null)", () => {
    const [item] = mergeActiveCrawl([crawlRun({ batch_position: 2, triggered_by_name: undefined })]);
    expect(item.batchPosition).toBe(2);
    expect(item.triggeredByName).toBeNull();
  });
  it("rỗng -> []", () => {
    expect(mergeActiveCrawl([], [])).toEqual([]);
  });
});

describe("mergeActiveMaintenance", () => {
  it("bỏ run có job_type lạ thay vì làm hỏng widget", () => {
    const merged = mergeActiveMaintenance([maintRun({}), maintRun({ run_id: "m2", job_type: "job_moi_cua_backend" })]);
    expect(merged.map((m) => m.runId)).toEqual(["m1"]);
  });
  it("gộp và sắp xếp như crawl", () => {
    const merged = mergeActiveMaintenance(
      [maintRun({ run_id: "late", started_at: "2026-11-16T05:00:00Z", status: "queued" })],
      [maintRun({ run_id: "early", started_at: "2026-11-16T01:00:00Z" })],
    );
    expect(merged.map((m) => m.runId)).toEqual(["early", "late"]);
  });
});

describe("selectActiveRuns", () => {
  const payload: ActiveRunsPayload = {
    crawl: mergeActiveCrawl([crawlRun({ run_id: "c" })]),
    maintenance: mergeActiveMaintenance([maintRun({ run_id: "m" })]),
  };
  it("chọn theo phạm vi", () => {
    expect(selectActiveRuns(payload, "crawl").map((i) => i.runId)).toEqual(["c"]);
    expect(selectActiveRuns(payload, "maintenance").map((i) => i.runId)).toEqual(["m"]);
    expect(selectActiveRuns(payload, "both").map((i) => i.runId)).toEqual(["c", "m"]);
  });
  it("chưa có dữ liệu -> []", () => {
    expect(selectActiveRuns(undefined, "both")).toEqual([]);
  });
});
