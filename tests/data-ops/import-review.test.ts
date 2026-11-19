import { describe, expect, it } from "vitest";
import {
  INITIAL_FLOW_STATE,
  buildConfirmResolutions,
  confirmProblem,
  defaultActionFor,
  effectiveAction,
  importFlowReducer,
  pairOf,
  reviewStats,
  rowBlockers,
  rowIndexMap,
  type FlowState,
  type ReviewState,
} from "@/lib/data-ops/import-review";
import type { ImportConfirmResult, ImportPreview, ImportPreviewRow } from "@/lib/data-ops/import";

function row(i: number, over: Partial<ImportPreviewRow> = {}): ImportPreviewRow {
  return {
    row_index: i,
    data: { job_title: `Job ${i}`, company_name: "ACME" },
    conflict_status: "no_conflict",
    existing_record: null,
    needs_field_fix: false,
    field_errors: {},
    needs_resolution: false,
    ...over,
  };
}
function preview(rows: ImportPreviewRow[], entity: ImportPreview["entity_type"] = "job"): ImportPreview {
  return {
    preview_id: "11111111-1111-4111-8111-111111111111",
    entity_type: entity,
    summary: {
      total_rows: rows.length, new_records: 0, conflicts: 0, conflicts_inactive: 0,
      pending_company_resolution: 0, conflicts_in_batch: 0, pending_level_resolution: 0,
      pending_field_fix: 0, id_field: "job_id",
    },
    rows,
  };
}
const RESULT: ImportConfirmResult = { created: 2, updated: 1, skipped: 3, reactivated: 0 } as ImportConfirmResult;

function start(rows: ImportPreviewRow[], entity: ImportPreview["entity_type"] = "job"): FlowState {
  return importFlowReducer(INITIAL_FLOW_STATE, { type: "upload_succeeded", preview: preview(rows, entity) });
}
function review(s: FlowState): ReviewState {
  if (!s.review) throw new Error("no review");
  return s.review;
}
const pairRows = (a = 0, b = 1) => [
  row(a, { conflict_status: "conflict_in_batch", needs_resolution: true, duplicate_in_batch: { other_row_index: b, match_score: 0.9, matched_fields: ["work_email"] } as never }),
  row(b, { conflict_status: "conflict_in_batch", needs_resolution: true, duplicate_in_batch: { other_row_index: a, match_score: 0.9, matched_fields: ["work_email"] } as never }),
];
const fixRow = (i: number) =>
  row(i, {
    needs_field_fix: true,
    needs_resolution: true,
    field_errors: { deadline: { rule: "date", message: "Dòng 2, cột 'deadline': sai", raw_value: "31/31/2026", widget_type: "date", options: null } },
  });

describe("mặc định theo conflict_status", () => {
  it("no_conflict create; conflict/inactive skip; pending và in_batch bắt buộc chọn", () => {
    expect(defaultActionFor({ conflict_status: "no_conflict" })).toBe("create");
    expect(defaultActionFor({ conflict_status: "conflict" })).toBe("skip");
    expect(defaultActionFor({ conflict_status: "conflict_inactive" })).toBe("skip");
    expect(defaultActionFor({ conflict_status: "pending_company_resolution" })).toBeNull();
    expect(defaultActionFor({ conflict_status: "conflict_in_batch" })).toBeNull();
  });
});

describe("cặp conflict_in_batch", () => {
  it("hai chiều thì ra cặp; một chiều thì không", () => {
    const rows = pairRows(2, 5);
    const m = rowIndexMap(rows);
    expect(pairOf(rows[0], m)).toEqual({ lo: 2, hi: 5 });
    expect(pairOf(rows[1], m)).toEqual({ lo: 2, hi: 5 });
    const one = [rows[0], { ...rows[1], duplicate_in_batch: { other_row_index: 9, match_score: 1, matched_fields: [] } as never }];
    expect(pairOf(one[0], rowIndexMap(one))).toBeNull();
  });

  it("chưa chọn thì chặn cả hai dòng; chọn một lần thì cả hai hết chặn", () => {
    let s = start(pairRows());
    const m = rowIndexMap(review(s).preview.rows);
    expect(rowBlockers(m.get(0)!, m, review(s).edits)).toEqual(["action"]);
    expect(rowBlockers(m.get(1)!, m, review(s).edits)).toEqual(["action"]);
    s = importFlowReducer(s, { type: "set_action", rowIndex: 0, action: "keep_this" });
    expect(rowBlockers(m.get(0)!, m, review(s).edits)).toEqual([]);
    expect(rowBlockers(m.get(1)!, m, review(s).edits)).toEqual([]);
  });

  it.each([
    ["keep_this", "create", "skip"],
    ["keep_other", "skip", "create"],
    ["import_both", "create", "create"],
  ] as const)("%s -> dòng đầu %s, dòng sau %s", (decision, lo, hi) => {
    const s = importFlowReducer(start(pairRows()), { type: "set_action", rowIndex: 0, action: decision });
    const m = rowIndexMap(review(s).preview.rows);
    expect(effectiveAction(m.get(0)!, m, review(s).edits)).toBe(lo);
    expect(effectiveAction(m.get(1)!, m, review(s).edits)).toBe(hi);
  });

  it("payload chỉ có MỘT entry cho cả cặp, là action lan truyền ở dòng đầu cặp", () => {
    const s = importFlowReducer(start(pairRows(3, 7), "contact"), { type: "set_action", rowIndex: 3, action: "keep_other" });
    expect(buildConfirmResolutions(review(s))).toEqual({ "3": { action: "keep_other" } });
  });
});

describe("pending_company_resolution", () => {
  const pending = row(0, { conflict_status: "pending_company_resolution", needs_resolution: true });
  it("không có mặc định: chặn cho tới khi bỏ qua", () => {
    let s = start([pending]);
    const m = rowIndexMap([pending]);
    expect(rowBlockers(pending, m, review(s).edits)).toEqual(["action"]);
    s = importFlowReducer(s, { type: "set_action", rowIndex: 0, action: "skip" });
    expect(rowBlockers(pending, m, review(s).edits)).toEqual([]);
    expect(buildConfirmResolutions(review(s))).toEqual({ "0": { action: "skip" } });
  });

  it("sau resolve-company dòng đổi status thì action về mặc định của status mới", () => {
    let s = start([pending]);
    s = importFlowReducer(s, { type: "set_action", rowIndex: 0, action: "skip" });
    s = importFlowReducer(s, { type: "row_replaced", row: row(0, { conflict_status: "no_conflict" }) });
    expect(review(s).edits[0].action).toBe("create");
    s = importFlowReducer(s, { type: "row_replaced", row: row(0, { conflict_status: "conflict", needs_resolution: true }) });
    expect(review(s).edits[0].action).toBe("skip");
  });
});

describe("conflict và conflict_inactive", () => {
  it("mặc định skip, vào payload là skip", () => {
    const s = start([row(0, { conflict_status: "conflict", needs_resolution: true })]);
    expect(buildConfirmResolutions(review(s))).toEqual({ "0": { action: "skip" } });
  });

  it("update trên dòng inactive cần xác nhận kích hoạt lại, và chỉ gửi confirm_reactivate khi đã tick", () => {
    const r = row(0, { conflict_status: "conflict_inactive", needs_resolution: true });
    let s = start([r]);
    const m = rowIndexMap([r]);
    s = importFlowReducer(s, { type: "set_action", rowIndex: 0, action: "update" });
    expect(rowBlockers(r, m, review(s).edits)).toEqual(["reactivate"]);
    s = importFlowReducer(s, { type: "set_reactivate", rowIndex: 0, value: true });
    expect(rowBlockers(r, m, review(s).edits)).toEqual([]);
    expect(buildConfirmResolutions(review(s))).toEqual({ "0": { action: "update", confirm_reactivate: true } });
    // đổi sang create rồi quay lại update: không giữ xác nhận cũ
    s = importFlowReducer(s, { type: "set_action", rowIndex: 0, action: "create" });
    s = importFlowReducer(s, { type: "set_action", rowIndex: 0, action: "update" });
    expect(review(s).edits[0].confirmReactivate).toBe(false);
  });

  it("dòng conflict thường: update không mang confirm_reactivate", () => {
    const r = row(0, { conflict_status: "conflict", needs_resolution: true });
    let s = start([r]);
    s = importFlowReducer(s, { type: "set_action", rowIndex: 0, action: "update" });
    s = importFlowReducer(s, { type: "set_reactivate", rowIndex: 0, value: true });
    expect(buildConfirmResolutions(review(s))).toEqual({ "0": { action: "update" } });
  });
});

describe("level và ô lỗi", () => {
  it("no_conflict cần level: bị chặn tới khi chọn, rồi level_code vào payload", () => {
    const r = row(0, { needs_level_resolve: true, needs_resolution: true });
    let s = start([r]);
    const m = rowIndexMap([r]);
    expect(rowBlockers(r, m, review(s).edits)).toEqual(["level"]);
    s = importFlowReducer(s, { type: "set_level", rowIndex: 0, levelCode: "SENIOR" });
    expect(rowBlockers(r, m, review(s).edits)).toEqual([]);
    expect(buildConfirmResolutions(review(s))).toEqual({ "0": { action: "create", level_code: "SENIOR" } });
  });

  it("dòng bỏ qua thì không cần level hay sửa ô", () => {
    const r = row(0, { conflict_status: "conflict", needs_level_resolve: true, needs_resolution: true, needs_field_fix: true, field_errors: fixRow(0).field_errors });
    const s = start([r]);
    expect(rowBlockers(r, rowIndexMap([r]), review(s).edits)).toEqual([]);
    expect(buildConfirmResolutions(review(s))).toEqual({ "0": { action: "skip" } });
  });

  it("ô lỗi chỉ xong sau fix_verified; sửa lại ô đã xong thì gỡ đúng ô đó", () => {
    let s = start([fixRow(0)]);
    expect(review(s).edits[0].fixes.deadline).toMatchObject({ value: "31/31/2026", verified: false, widget: "date" });
    const fixed = row(0); // backend: hết lỗi
    s = importFlowReducer(s, { type: "row_replaced", row: fixed });
    // đã row_replaced nhưng CHƯA verified phía client: vẫn chặn
    expect(rowBlockers(fixed, rowIndexMap([fixed]), review(s).edits)).toEqual(["fix"]);
    s = importFlowReducer(s, { type: "fix_verified", rowIndex: 0, field: "deadline", value: "2026-12-31" });
    expect(rowBlockers(fixed, rowIndexMap([fixed]), review(s).edits)).toEqual([]);
    s = importFlowReducer(s, { type: "fix_edited", rowIndex: 0, field: "deadline", value: "2027-01-01" });
    expect(review(s).edits[0].fixes.deadline).toMatchObject({ value: "2027-01-01", verified: false, widget: "date" });
    expect(rowBlockers(fixed, rowIndexMap([fixed]), review(s).edits)).toEqual(["fix"]);
  });

  it("backend vẫn báo lỗi ô thì dòng vẫn bị chặn dù client đánh dấu đã xong", () => {
    const r = fixRow(0);
    let s = start([r]);
    s = importFlowReducer(s, { type: "fix_verified", rowIndex: 0, field: "deadline", value: "x" });
    expect(rowBlockers(r, rowIndexMap([r]), review(s).edits)).toEqual(["fix"]);
  });

  it("dòng no_conflict luôn là create (backend bỏ qua action) dù edit nói gì", () => {
    const r = fixRow(0);
    let s = start([r]);
    s = importFlowReducer(s, { type: "set_action", rowIndex: 0, action: "skip" });
    expect(effectiveAction(r, rowIndexMap([r]), review(s).edits)).toBe("create");
  });
});

describe("payload confirm", () => {
  it("lược dòng no_conflict không cần xử lý; khoá là chuỗi", () => {
    const s = start([row(0), row(1, { conflict_status: "conflict", needs_resolution: true })]);
    expect(buildConfirmResolutions(review(s))).toEqual({ "1": { action: "skip" } });
  });

  it("không bao giờ đặt field undefined hay company_id", () => {
    const s = start([row(0, { needs_level_resolve: true, needs_resolution: true })]);
    const s2 = importFlowReducer(s, { type: "set_level", rowIndex: 0, levelCode: "JUNIOR" });
    const out = buildConfirmResolutions(review(s2));
    expect(Object.keys(out["0"]).sort()).toEqual(["action", "level_code"]);
  });
});

describe("thống kê và kiểm trước confirm", () => {
  const rows = [row(0), row(1, { conflict_status: "conflict", needs_resolution: true }), ...pairRows(2, 3)];
  it("đếm theo hiệu lực thật", () => {
    let s = start(rows, "contact");
    expect(reviewStats(review(s))).toMatchObject({ total: 4, willCreate: 1, willSkip: 1, undecided: 2, blockedRows: 2 });
    s = importFlowReducer(s, { type: "set_action", rowIndex: 2, action: "keep_this" });
    expect(reviewStats(review(s))).toMatchObject({ willCreate: 2, willSkip: 2, undecided: 0, blockedRows: 0 });
  });

  it("còn dòng chặn thì báo dòng đầu (số dòng trong file); đủ dòng mà thiếu ghi chú thì báo ghi chú", () => {
    let s = start(rows, "contact");
    const p1 = confirmProblem(review(s));
    expect(p1?.firstBlockedRow).toBe(2);
    expect(p1?.message).toContain("dòng 4");
    s = importFlowReducer(s, { type: "set_action", rowIndex: 2, action: "import_both" });
    expect(confirmProblem(review(s))).toEqual({ message: expect.stringMatching(/ghi chú/) });
    s = importFlowReducer(s, { type: "set_note", note: "   " });
    expect(confirmProblem(review(s))).not.toBeNull();
    s = importFlowReducer(s, { type: "set_note", note: "nhập tuần 46" });
    expect(confirmProblem(review(s))).toBeNull();
  });
});

describe("reducer: vòng đời", () => {
  it("upload lỗi giữ khung upload + mảng lỗi; upload thành công vào review", () => {
    let s = importFlowReducer(INITIAL_FLOW_STATE, { type: "upload_started" });
    expect(s.busy).toBe("upload");
    s = importFlowReducer(s, { type: "upload_failed", message: "hỏng", rowErrors: [{ row_number: 2, message: "x" } as never] });
    expect(s).toMatchObject({ stage: "upload", busy: null, error: "hỏng" });
    expect(s.rowErrors).toHaveLength(1);
    s = importFlowReducer(s, { type: "upload_succeeded", preview: preview([row(0)]) });
    expect(s).toMatchObject({ stage: "review", error: null, rowErrors: null });
  });

  it("confirm thành công về khung upload trống kèm kết quả; thất bại ở lại review kèm lỗi", () => {
    const s = start([row(0)]);
    const fail = importFlowReducer(importFlowReducer(s, { type: "confirm_started" }), { type: "confirm_failed", message: "lỗi" });
    expect(fail).toMatchObject({ stage: "review", busy: null, error: "lỗi" });
    const ok = importFlowReducer(s, { type: "confirm_succeeded", result: RESULT });
    expect(ok).toMatchObject({ stage: "upload", review: null, result: RESULT });
    expect(importFlowReducer(ok, { type: "dismiss_result" }).result).toBeNull();
  });

  it("preview hết hạn bỏ cả review", () => {
    const s = importFlowReducer(start([row(0)]), { type: "preview_lost", message: "hết hạn" });
    expect(s).toMatchObject({ stage: "upload", review: null, error: "hết hạn" });
  });

  it("preview_replaced giữ quyết định của dòng không đổi, đặt lại dòng đổi status", () => {
    let s = start([row(0, { conflict_status: "conflict", needs_resolution: true }), row(1, { conflict_status: "conflict", needs_resolution: true })]);
    s = importFlowReducer(s, { type: "set_action", rowIndex: 0, action: "update" });
    s = importFlowReducer(s, { type: "set_action", rowIndex: 1, action: "update" });
    s = importFlowReducer(s, {
      type: "preview_replaced",
      preview: preview([row(0, { conflict_status: "conflict", needs_resolution: true }), row(1, { conflict_status: "conflict_in_batch", needs_resolution: true })]),
    });
    expect(review(s).edits[0].action).toBe("update");
    expect(review(s).edits[1].action).toBeNull();
  });

  it("ghi chú, hành động lên dòng không tồn tại không làm hỏng state", () => {
    const s = start([row(0)]);
    expect(importFlowReducer(s, { type: "set_action", rowIndex: 99, action: "skip" })).toBe(s);
    expect(importFlowReducer(INITIAL_FLOW_STATE, { type: "set_note", note: "x" })).toBe(INITIAL_FLOW_STATE);
  });
});
