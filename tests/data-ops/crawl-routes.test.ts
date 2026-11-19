import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionToken = vi.fn();
const listCrawlRuns = vi.fn();
const getCrawlRun = vi.fn();
const getCrawlLogs = vi.fn();
const getCrawlBatch = vi.fn();
const getLatestCrawlLogRun = vi.fn();
const listMaintenanceRuns = vi.fn();
const getMaintenanceRun = vi.fn();
const getMaintenanceLogs = vi.fn();
const getMaintenanceLogsBatch = vi.fn();
const getLatestMaintenanceRuns = vi.fn();

vi.mock("@/lib/session", () => ({ getSessionToken: () => getSessionToken() }));
vi.mock("@/lib/api/crawl", async (orig) => ({
  ...(await orig<typeof import("@/lib/api/crawl")>()),
  listCrawlRuns: (...a: unknown[]) => listCrawlRuns(...a),
  getCrawlRun: (...a: unknown[]) => getCrawlRun(...a),
  getCrawlLogs: (...a: unknown[]) => getCrawlLogs(...a),
  getCrawlBatch: (...a: unknown[]) => getCrawlBatch(...a),
  getLatestCrawlLogRun: (...a: unknown[]) => getLatestCrawlLogRun(...a),
}));
vi.mock("@/lib/api/maintenance", async (orig) => ({
  ...(await orig<typeof import("@/lib/api/maintenance")>()),
  listMaintenanceRuns: (...a: unknown[]) => listMaintenanceRuns(...a),
  getMaintenanceRun: (...a: unknown[]) => getMaintenanceRun(...a),
  getMaintenanceLogs: (...a: unknown[]) => getMaintenanceLogs(...a),
  getMaintenanceLogsBatch: (...a: unknown[]) => getMaintenanceLogsBatch(...a),
  getLatestMaintenanceRuns: (...a: unknown[]) => getLatestMaintenanceRuns(...a),
}));

import { ApiError } from "@/lib/api/client";
import { GET as activeGET } from "@/app/api/crawl/active/route";
import { GET as latestCrawlGET } from "@/app/api/crawl/latest-run/route";
import { GET as crawlRunGET } from "@/app/api/crawl/runs/[runId]/route";
import { GET as crawlLogsGET } from "@/app/api/crawl/runs/[runId]/logs/route";
import { GET as crawlBatchGET } from "@/app/api/crawl/batches/[batchId]/route";
import { GET as latestMaintGET } from "@/app/api/maintenance/latest-runs/route";
import { GET as maintRunGET } from "@/app/api/maintenance/runs/[runId]/route";
import { GET as maintLogsGET } from "@/app/api/maintenance/runs/[runId]/logs/route";
import { GET as logsBatchGET } from "@/app/api/maintenance/logs-batch/route";

const R1 = "11111111-1111-4111-8111-111111111111";
const R2 = "22222222-2222-4222-8222-222222222222";
const get = (path: string) => new Request(`http://localhost${path}`) as never;
const ctx = (p: Record<string, string>) => ({ params: Promise.resolve(p) }) as never;

const ALL = [
  listCrawlRuns, getCrawlRun, getCrawlLogs, getCrawlBatch, getLatestCrawlLogRun,
  listMaintenanceRuns, getMaintenanceRun, getMaintenanceLogs, getMaintenanceLogsBatch, getLatestMaintenanceRuns,
];

beforeEach(() => {
  getSessionToken.mockReset();
  for (const m of ALL) m.mockReset();
  getSessionToken.mockResolvedValue("tok");
});

describe("mọi route đọc: phiên và no-store", () => {
  it("không có cookie phiên -> 401 JSON, không gọi backend", async () => {
    getSessionToken.mockResolvedValue(null);
    const responses = [
      await activeGET(),
      await latestCrawlGET(),
      await crawlRunGET(get("/x"), ctx({ runId: R1 })),
      await crawlLogsGET(get("/x"), ctx({ runId: R1 })),
      await crawlBatchGET(get("/x"), ctx({ batchId: R1 })),
      await latestMaintGET(),
      await maintRunGET(get("/x"), ctx({ runId: R1 })),
      await maintLogsGET(get("/x"), ctx({ runId: R1 })),
      await logsBatchGET(get(`/x?run_ids=${R1}&after_ids=0`)),
    ];
    for (const res of responses) {
      expect(res.status).toBe(401);
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(await res.json()).toMatchObject({ ok: false });
    }
    for (const m of ALL) expect(m).not.toHaveBeenCalled();
  });

  it("thành công cũng no-store", async () => {
    getCrawlRun.mockResolvedValue({ run_id: R1, status: "running" });
    const res = await crawlRunGET(get("/x"), ctx({ runId: R1 }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("lỗi backend giữ nguyên mã thật", () => {
  it("401 kèm errorCode (để client xử lý 'đăng nhập nơi khác'), 403 học viên, 404, 429 được giữ", async () => {
    getCrawlRun.mockRejectedValueOnce(new ApiError("bị thay phiên", 401, "session_replaced"));
    const res = await crawlRunGET(get("/x"), ctx({ runId: R1 }));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ ok: false, errorCode: "session_replaced" });

    getCrawlRun.mockRejectedValueOnce(new ApiError("cấm", 403, "auth_forbidden"));
    expect((await crawlRunGET(get("/x"), ctx({ runId: R1 }))).status).toBe(403);
    getCrawlRun.mockRejectedValueOnce(new ApiError("không có", 404));
    expect((await crawlRunGET(get("/x"), ctx({ runId: R1 }))).status).toBe(404);
    getCrawlRun.mockRejectedValueOnce(new ApiError("quá nhanh", 429));
    expect((await crawlRunGET(get("/x"), ctx({ runId: R1 }))).status).toBe(429);
  });
  it("lỗi mạng / status thiếu -> 502", async () => {
    getCrawlRun.mockRejectedValueOnce(new Error("ECONNRESET"));
    expect((await crawlRunGET(get("/x"), ctx({ runId: R1 }))).status).toBe(502);
    getCrawlRun.mockRejectedValueOnce(new ApiError("không rõ"));
    expect((await crawlRunGET(get("/x"), ctx({ runId: R1 }))).status).toBe(502);
  });
});

describe("GET /api/crawl/active", () => {
  it("gọi 4 lệnh song song (queued+running của crawl và bảo trì) rồi gộp", async () => {
    const t = "2026-11-16T01:00:00Z";
    listCrawlRuns.mockImplementation(async ({ status }: { status: string }) => ({
      items: status === "running" ? [{ run_id: R1, status, source: "topcv", category: "da", started_at: t }] : [],
    }));
    listMaintenanceRuns.mockImplementation(async ({ status }: { status: string }) => ({
      items: status === "queued" ? [{ run_id: R2, status, job_type: "check_expired_jobs", params: {}, started_at: t }] : [],
    }));
    const res = await activeGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.crawl.map((i: { runId: string }) => i.runId)).toEqual([R1]);
    expect(body.maintenance.map((i: { runId: string }) => i.runId)).toEqual([R2]);
    expect(listCrawlRuns.mock.calls.map((c) => c[0].status).sort()).toEqual(["queued", "running"]);
    expect(listMaintenanceRuns.mock.calls.map((c) => c[0].status).sort()).toEqual(["queued", "running"]);
  });
  it("một lệnh 401 -> cả lượt 401 (không trả dữ liệu nửa vời)", async () => {
    listCrawlRuns.mockResolvedValue({ items: [] });
    listMaintenanceRuns.mockRejectedValueOnce(new ApiError("hết phiên", 401));
    listMaintenanceRuns.mockResolvedValue({ items: [] });
    expect((await activeGET()).status).toBe(401);
  });
});

describe("latest-run: null là hợp lệ", () => {
  it("chưa từng crawl -> 200 { run: null }", async () => {
    getLatestCrawlLogRun.mockResolvedValue(null);
    const res = await latestCrawlGET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ run: null });
  });
  it("bảo trì: trả map job_type", async () => {
    getLatestMaintenanceRuns.mockResolvedValue({ check_expired_jobs: null });
    expect(await (await latestMaintGET()).json()).toEqual({ runs: { check_expired_jobs: null } });
  });
});

describe("kiểm tham số", () => {
  it("run_id / batch_id không phải UUID -> 400, không gọi backend", async () => {
    expect((await crawlRunGET(get("/x"), ctx({ runId: "abc" }))).status).toBe(400);
    expect((await crawlLogsGET(get("/x"), ctx({ runId: "../etc" }))).status).toBe(400);
    expect((await crawlBatchGET(get("/x"), ctx({ batchId: "1" }))).status).toBe(400);
    expect((await maintRunGET(get("/x"), ctx({ runId: "x" }))).status).toBe(400);
    expect((await maintLogsGET(get("/x"), ctx({ runId: "x" }))).status).toBe(400);
    for (const m of ALL) expect(m).not.toHaveBeenCalled();
  });

  it("logs: after_id/limit mặc định và truyền xuống đúng", async () => {
    getCrawlLogs.mockResolvedValue({ last_id: 9, items: [] });
    await crawlLogsGET(get("/x"), ctx({ runId: R1 }));
    expect(getCrawlLogs).toHaveBeenLastCalledWith(R1, { afterId: 0, limit: undefined });
    await crawlLogsGET(get("/x?after_id=42&limit=100"), ctx({ runId: R1 }));
    expect(getCrawlLogs).toHaveBeenLastCalledWith(R1, { afterId: 42, limit: 100 });
    getMaintenanceLogs.mockResolvedValue({ last_id: 0, items: [] });
    await maintLogsGET(get("/x?after_id=7"), ctx({ runId: R1 }));
    expect(getMaintenanceLogs).toHaveBeenLastCalledWith(R1, { afterId: 7, limit: undefined });
  });

  it("logs: after_id âm/chữ, limit 0 hoặc > 2000 -> 400", async () => {
    for (const q of ["after_id=-1", "after_id=abc", "after_id=1.5", "limit=0", "limit=2001", "limit=abc"]) {
      expect((await crawlLogsGET(get(`/x?${q}`), ctx({ runId: R1 }))).status).toBe(400);
    }
    expect(getCrawlLogs).not.toHaveBeenCalled();
  });
});

describe("GET /api/maintenance/logs-batch", () => {
  it("dựng cursor theo VỊ TRÍ từ hai chuỗi và gọi MỘT lần", async () => {
    getMaintenanceLogsBatch.mockResolvedValue({ [R1]: { last_id: 3, items: [] } });
    const res = await logsBatchGET(get(`/x?run_ids=${R1},${R2}&after_ids=5,0&limit=50`));
    expect(res.status).toBe(200);
    expect(getMaintenanceLogsBatch).toHaveBeenCalledTimes(1);
    expect(getMaintenanceLogsBatch).toHaveBeenCalledWith(
      [
        { runId: R1, afterId: 5 },
        { runId: R2, afterId: 0 },
      ],
      50,
    );
  });
  it("thiếu run_ids, lệch số lượng, UUID xấu, after_id xấu, quá nhiều run -> 400", async () => {
    const many = Array.from({ length: 11 }, () => R1).join(",");
    const manyAfter = Array.from({ length: 11 }, () => "0").join(",");
    const bad = [
      "/x",
      `/x?run_ids=${R1}&after_ids=0,1`,
      `/x?run_ids=${R1},${R2}&after_ids=0`,
      `/x?run_ids=abc&after_ids=0`,
      `/x?run_ids=${R1}&after_ids=-1`,
      `/x?run_ids=${R1}&after_ids=`,
      `/x?run_ids=${many}&after_ids=${manyAfter}`,
      `/x?run_ids=${R1}&after_ids=0&limit=0`,
    ];
    for (const url of bad) expect((await logsBatchGET(get(url))).status).toBe(400);
    expect(getMaintenanceLogsBatch).not.toHaveBeenCalled();
  });
});
