import { describe, expect, it } from "vitest";
import { MAINTENANCE_JOB_TYPES, type AnyMaintenanceRun, type MaintenanceJobType } from "@/lib/data-ops/maintenance";
import {
  anyMaintenanceActive,
  applyLogsBatch,
  isCostlyMaintenanceJob,
  logsBatchUrl,
  maintenanceResultNotes,
  maintenanceResultTiles,
  planLogCursors,
  MAINTENANCE_JOB_DESCRIPTIONS,
  type LatestMaintenanceRuns,
  type LogsByRun,
} from "@/lib/data-ops/maintenance-live";

const RID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function run(jobType: MaintenanceJobType, n: number, over: Record<string, unknown> = {}): AnyMaintenanceRun {
  return {
    run_id: RID(n),
    job_type: jobType,
    params: {},
    status: "done",
    stats: null,
    error: null,
    triggered_by: null,
    triggered_by_name: null,
    started_at: "2026-11-17T00:00:00Z",
    finished_at: "2026-11-17T00:01:00Z",
    ...over,
  } as AnyMaintenanceRun;
}

function runs(over: Partial<Record<MaintenanceJobType, AnyMaintenanceRun | null>> = {}): LatestMaintenanceRuns {
  const base = Object.fromEntries(MAINTENANCE_JOB_TYPES.map((t) => [t, null])) as LatestMaintenanceRuns;
  return { ...base, ...over } as LatestMaintenanceRuns;
}

const line = (id: number, message = `dòng ${id}`) => ({ id, level: "INFO", message, created_at: "2026-11-17T00:00:00Z" });

describe("maintenanceResultTiles — 5 shape khác nhau", () => {
  it("chưa có stats (đang chạy / lỗi sớm) -> không có ô nào", () => {
    expect(maintenanceResultTiles(run("check_expired_jobs", 1, { stats: null }))).toEqual([]);
  });

  it("mỗi job hiện đúng bộ ô của nó, khoá của job khác không lẫn sang", () => {
    const expected: Record<MaintenanceJobType, string[]> = {
      backfill_company_profiles: ["checked", "updated", "unchanged", "unknown_domain", "errors"],
      enrich_profile_from_website: [
        "checked", "updated", "industry_updated", "products_services_updated", "no_page_content", "low_confidence", "fetch_failed", "errors",
      ],
      enrich_web_info: ["checked", "updated", "no_result", "website_name_mismatch", "merged_duplicate_company", "errors"],
      get_fb_linkedin: [
        "checked", "updated", "found_via_subpage", "no_link_found", "likely_js_rendered", "challenge_page", "fetch_failed",
        "linkedin_personal_only_skipped", "website_is_social_domain",
      ],
      check_expired_jobs: [
        "checked", "expired_by_source_dead", "expired_by_deadline", "listings_expired_by_source_dead",
        "listings_expired_by_deadline", "still_alive", "needs_manual_check", "cv_cleaned", "cv_cleanup_errors",
      ],
    };
    for (const jobType of MAINTENANCE_JOB_TYPES) {
      const tiles = maintenanceResultTiles(run(jobType, 1, { stats: { checked: 3 } }));
      expect(tiles.map((t) => t.key), jobType).toEqual(expected[jobType]);
      expect(tiles[0]).toMatchObject({ key: "checked", value: 3 });
    }
  });

  it("giá trị lấy đúng từ stats của job đó", () => {
    const tiles = maintenanceResultTiles(
      run("check_expired_jobs", 1, {
        stats: { checked: 10, expired_by_source_dead: 2, expired_by_deadline: 3, still_alive: 4, needs_manual_check: 1, cv_cleaned: 0, cv_cleanup_errors: 0, listings_expired_by_deadline: 5, listings_expired_by_source_dead: 6 },
      }),
    );
    const by = Object.fromEntries(tiles.map((t) => [t.key, t.value]));
    expect(by).toMatchObject({ checked: 10, expired_by_source_dead: 2, expired_by_deadline: 3, listings_expired_by_deadline: 5, listings_expired_by_source_dead: 6, still_alive: 4, needs_manual_check: 1 });
  });

  it("khoá thiếu hoặc không phải số -> 0, không bao giờ undefined/NaN", () => {
    const tiles = maintenanceResultTiles(run("backfill_company_profiles", 1, { stats: { checked: "7", updated: null, unchanged: Number.NaN } }));
    expect(tiles.every((t) => t.value === 0)).toBe(true);
    expect(tiles).toHaveLength(5);
  });
});

describe("maintenanceResultNotes", () => {
  it("lượt chạy thử đã xong có ghi chú chưa ghi DB", () => {
    const n = maintenanceResultNotes(run("check_expired_jobs", 1, { params: { dry_run: true } }));
    expect(n).toHaveLength(1);
    expect(n[0]).toMatch(/chưa ghi/);
  });
  it("lượt thật, hoặc lượt chạy thử còn đang chạy/lỗi -> không có ghi chú", () => {
    expect(maintenanceResultNotes(run("check_expired_jobs", 1, { params: {} }))).toEqual([]);
    expect(maintenanceResultNotes(run("check_expired_jobs", 1, { params: { dry_run: false } }))).toEqual([]);
    expect(maintenanceResultNotes(run("check_expired_jobs", 1, { params: { dry_run: true }, status: "running" }))).toEqual([]);
    expect(maintenanceResultNotes(run("check_expired_jobs", 1, { params: { dry_run: true }, status: "error" }))).toEqual([]);
  });
});

describe("mô tả và cờ tốn phí", () => {
  it("mỗi job có mô tả; chỉ job bắt buộc limit mới bị gắn nhãn tốn phí", () => {
    for (const t of MAINTENANCE_JOB_TYPES) expect(MAINTENANCE_JOB_DESCRIPTIONS[t].length).toBeGreaterThan(10);
    expect(isCostlyMaintenanceJob("enrich_web_info")).toBe(true);
    expect(isCostlyMaintenanceJob("get_fb_linkedin")).toBe(false);
    expect(isCostlyMaintenanceJob("check_expired_jobs")).toBe(false);
  });
});

describe("anyMaintenanceActive", () => {
  it("true khi có job queued hoặc running; false khi toàn xong/chưa chạy/không có dữ liệu", () => {
    expect(anyMaintenanceActive(runs({ enrich_web_info: run("enrich_web_info", 1, { status: "queued" }) }))).toBe(true);
    expect(anyMaintenanceActive(runs({ check_expired_jobs: run("check_expired_jobs", 2, { status: "running" }) }))).toBe(true);
    expect(anyMaintenanceActive(runs({ check_expired_jobs: run("check_expired_jobs", 2, { status: "done" }), get_fb_linkedin: run("get_fb_linkedin", 3, { status: "error" }) }))).toBe(false);
    expect(anyMaintenanceActive(runs())).toBe(false);
    expect(anyMaintenanceActive(undefined)).toBe(false);
    expect(anyMaintenanceActive(null)).toBe(false);
  });
});

describe("planLogCursors + logsBatchUrl", () => {
  const r = runs({
    backfill_company_profiles: run("backfill_company_profiles", 1),
    check_expired_jobs: run("check_expired_jobs", 2, { status: "running" }),
  });

  it("chưa tải gì: hỏi mọi run đang có từ id 0, theo thứ tự job cố định; job chưa từng chạy bị bỏ", () => {
    expect(planLogCursors(r, {})).toEqual([
      { runId: RID(1), afterId: 0 },
      { runId: RID(2), afterId: 0 },
    ]);
  });

  it("run đã settled thôi bị hỏi; run đang chạy vẫn hỏi tiếp từ id đã đọc", () => {
    const logs: LogsByRun = {
      [RID(1)]: { lines: [line(5)], afterId: 5, settled: true },
      [RID(2)]: { lines: [line(9)], afterId: 9, settled: false },
    };
    expect(planLogCursors(r, logs)).toEqual([{ runId: RID(2), afterId: 9 }]);
  });

  it("mọi run settled -> không còn cursor, URL là null (không request nào)", () => {
    const logs: LogsByRun = {
      [RID(1)]: { lines: [], afterId: 0, settled: true },
      [RID(2)]: { lines: [], afterId: 0, settled: true },
    };
    expect(planLogCursors(r, logs)).toEqual([]);
    expect(logsBatchUrl([])).toBeNull();
  });

  it("URL: run_ids và after_ids sinh cùng lúc từ một mảng nên khớp vị trí; id âm/lẻ được chuẩn hoá", () => {
    expect(
      logsBatchUrl([
        { runId: RID(1), afterId: 0 },
        { runId: RID(2), afterId: 12 },
        { runId: RID(3), afterId: -4 },
        { runId: RID(4), afterId: 7.9 },
      ]),
    ).toBe(`/api/maintenance/logs-batch?run_ids=${RID(1)},${RID(2)},${RID(3)},${RID(4)}&after_ids=0,12,0,7`);
  });

  it("job vừa có lượt mới thì cursor dùng run_id mới từ id 0, không thừa hưởng log của lượt cũ", () => {
    const old: LogsByRun = { [RID(1)]: { lines: [line(50)], afterId: 50, settled: true } };
    const fresh = runs({ backfill_company_profiles: run("backfill_company_profiles", 7, { status: "queued" }) });
    expect(planLogCursors(fresh, old)).toEqual([{ runId: RID(7), afterId: 0 }]);
  });
});

describe("applyLogsBatch", () => {
  const active = runs({ check_expired_jobs: run("check_expired_jobs", 2, { status: "running" }) });

  it("gộp dòng mới, cập nhật afterId, run đang chạy chưa settled", () => {
    const next = applyLogsBatch({}, active, { [RID(2)]: { last_id: 3, items: [line(1), line(2), line(3)] } });
    expect(next[RID(2)].lines.map((l) => l.id)).toEqual([1, 2, 3]);
    expect(next[RID(2)].afterId).toBe(3);
    expect(next[RID(2)].settled).toBe(false);
  });

  it("khử trùng theo id khi cùng phản hồi tới hai lần", () => {
    const resp = { [RID(2)]: { last_id: 2, items: [line(1), line(2)] } };
    const once = applyLogsBatch({}, active, resp);
    const twice = applyLogsBatch(once, active, resp);
    expect(twice[RID(2)].lines).toHaveLength(2);
  });

  it("lượt đã xong mà phản hồi còn dòng mới: CHƯA settled (còn phải hỏi thêm một lần)", () => {
    const done = runs({ check_expired_jobs: run("check_expired_jobs", 2, { status: "done" }) });
    const next = applyLogsBatch({}, done, { [RID(2)]: { last_id: 4, items: [line(4)] } });
    expect(next[RID(2)].settled).toBe(false);
    expect(planLogCursors(done, next)).toEqual([{ runId: RID(2), afterId: 4 }]);
  });

  it("lượt đã xong và phản hồi rỗng: settled, không hỏi nữa", () => {
    const done = runs({ check_expired_jobs: run("check_expired_jobs", 2, { status: "done" }) });
    const first = applyLogsBatch({}, done, { [RID(2)]: { last_id: 4, items: [line(4)] } });
    const second = applyLogsBatch(first, done, { [RID(2)]: { last_id: 4, items: [] } });
    expect(second[RID(2)].settled).toBe(true);
    expect(second[RID(2)].lines).toHaveLength(1);
    expect(planLogCursors(done, second)).toEqual([]);
  });

  it("lượt chưa từng có log: một phản hồi rỗng là settled ngay (không poll mãi)", () => {
    const done = runs({ backfill_company_profiles: run("backfill_company_profiles", 1) });
    const next = applyLogsBatch({}, done, { [RID(1)]: { last_id: 0, items: [] } });
    expect(next[RID(1)]).toEqual({ lines: [], afterId: 0, settled: true });
  });

  it("lượt đang chạy trả rỗng thì KHÔNG settled (còn chờ log)", () => {
    const next = applyLogsBatch({}, active, { [RID(2)]: { last_id: 0, items: [] } });
    expect(next[RID(2)].settled).toBe(false);
  });

  it("afterId không bao giờ lùi", () => {
    const prev: LogsByRun = { [RID(2)]: { lines: [line(9)], afterId: 9, settled: false } };
    const next = applyLogsBatch(prev, active, { [RID(2)]: { last_id: 3, items: [] } });
    expect(next[RID(2)].afterId).toBe(9);
  });

  it("giữ tối đa 500 dòng mới nhất mỗi run", () => {
    const many = Array.from({ length: 700 }, (_, i) => line(i + 1));
    const next = applyLogsBatch({}, active, { [RID(2)]: { last_id: 700, items: many } });
    expect(next[RID(2)].lines).toHaveLength(500);
    expect(next[RID(2)].lines[0].id).toBe(201);
    expect(next[RID(2)].lines.at(-1)?.id).toBe(700);
  });

  it("run thiếu trong phản hồi giữ nguyên state cũ; run không còn là lượt gần nhất bị bỏ", () => {
    const prev: LogsByRun = {
      [RID(2)]: { lines: [line(1)], afterId: 1, settled: false },
      [RID(99)]: { lines: [line(1)], afterId: 1, settled: true },
    };
    const next = applyLogsBatch(prev, active, {});
    expect(next[RID(2)]).toBe(prev[RID(2)]);
    expect(next[RID(99)]).toBeUndefined();
  });

  it("log của hai run không lẫn nhau", () => {
    const two = runs({
      backfill_company_profiles: run("backfill_company_profiles", 1, { status: "running" }),
      check_expired_jobs: run("check_expired_jobs", 2, { status: "running" }),
    });
    const next = applyLogsBatch({}, two, {
      [RID(1)]: { last_id: 1, items: [line(1, "backfill")] },
      [RID(2)]: { last_id: 2, items: [line(2, "expired")] },
    });
    expect(next[RID(1)].lines.map((l) => l.message)).toEqual(["backfill"]);
    expect(next[RID(2)].lines.map((l) => l.message)).toEqual(["expired"]);
  });
});
