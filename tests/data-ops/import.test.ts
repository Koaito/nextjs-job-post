import { describe, expect, it } from "vitest";
import {
  IMPORT_BATCH_PROPAGATING_ACTIONS,
  IMPORT_MAX_ROWS,
  IMPORT_NOT_FOUND_CODE,
  IMPORT_PREVIEW_EXPIRED_CODE,
  IMPORT_PREVIEW_EXPIRED_MESSAGE,
  IMPORT_ROW_ERRORS_DISPLAY_LIMIT,
  IMPORT_ROW_VALIDATION_FAILED_CODE,
  isBatchPropagatingAction,
  normalizeImportRow,
  resolutionKey,
  summarizeImportRowErrors,
  type ImportResolutionAction,
  type ImportRowError,
} from "@/lib/data-ops/import";

describe("hằng số khớp backend", () => {
  it("error_code là chữ thường đúng giá trị thật", () => {
    expect(IMPORT_PREVIEW_EXPIRED_CODE).toBe("import_preview_expired");
    expect(IMPORT_NOT_FOUND_CODE).toBe("import_not_found");
    expect(IMPORT_ROW_VALIDATION_FAILED_CODE).toBe("import_row_validation_failed");
  });

  it("thông báo hết hạn bằng tiếng Việt (backend trả tiếng Anh)", () => {
    expect(IMPORT_PREVIEW_EXPIRED_MESSAGE).toMatch(/hết hạn/);
  });

  it("trần 5000 dòng", () => {
    expect(IMPORT_MAX_ROWS).toBe(5000);
  });
});

describe("resolutionKey", () => {
  it("luôn là chuỗi (khoá resolutions là row_index dạng string)", () => {
    expect(resolutionKey(0)).toBe("0");
    expect(resolutionKey(12)).toBe("12");
    expect(typeof resolutionKey(3)).toBe("string");
  });

  it("dùng được làm khoá object và JSON hoá thành khoá chuỗi", () => {
    const resolutions = { [resolutionKey(0)]: { action: "skip" as const }, [resolutionKey(3)]: { action: "create" as const } };
    expect(Object.keys(JSON.parse(JSON.stringify(resolutions)))).toEqual(["0", "3"]);
  });
});

describe("isBatchPropagatingAction", () => {
  it("chỉ keep_this / keep_other / import_both lan truyền theo cặp", () => {
    const all: ImportResolutionAction[] = ["skip", "create", "update", "keep_this", "keep_other", "import_both"];
    for (const a of all) {
      expect(isBatchPropagatingAction(a)).toBe((IMPORT_BATCH_PROPAGATING_ACTIONS as readonly string[]).includes(a));
    }
    expect(isBatchPropagatingAction("keep_this")).toBe(true);
    expect(isBatchPropagatingAction("keep_other")).toBe(true);
    expect(isBatchPropagatingAction("import_both")).toBe(true);
    expect(isBatchPropagatingAction("update")).toBe(false);
    expect(isBatchPropagatingAction("skip")).toBe(false);
    expect(isBatchPropagatingAction("create")).toBe(false);
  });
});

describe("normalizeImportRow", () => {
  it("điền mặc định cho field có thể vắng", () => {
    const row = normalizeImportRow({ row_index: 4, conflict_status: "no_conflict" });
    expect(row.row_index).toBe(4);
    expect(row.conflict_status).toBe("no_conflict");
    expect(row.data).toEqual({});
    expect(row.existing_record).toBeNull();
    expect(row.needs_field_fix).toBe(false);
    expect(row.field_errors).toEqual({});
    expect(row.needs_resolution).toBe(false);
  });

  it("giữ nguyên giá trị đã có, kể cả các trục độc lập cùng bật", () => {
    const fieldErrors = {
      email: { rule: "email", message: "Dòng 2, cột 'email': sai", raw_value: "x", widget_type: "email", options: null },
    };
    const raw = {
      row_index: 2,
      conflict_status: "conflict",
      data: { job_title: "Dev" },
      existing_record: { job_id: "j1" },
      needs_level_resolve: true,
      needs_field_fix: true,
      field_errors: fieldErrors,
      needs_resolution: true,
    };
    const row = normalizeImportRow(raw);
    expect(row.conflict_status).toBe("conflict");
    expect(row.needs_level_resolve).toBe(true);
    expect(row.needs_field_fix).toBe(true);
    expect(row.needs_resolution).toBe(true);
    expect(row.data).toEqual({ job_title: "Dev" });
    expect(row.existing_record).toEqual({ job_id: "j1" });
    expect(row.field_errors).toEqual(fieldErrors);
  });

  it("ép kiểu truthy/falsy của cờ về boolean", () => {
    const row = normalizeImportRow({
      row_index: 0,
      conflict_status: "no_conflict",
      needs_field_fix: 1,
      needs_resolution: undefined,
    });
    expect(row.needs_field_fix).toBe(true);
    expect(row.needs_resolution).toBe(false);
  });

  it("không tự suy ra needs_resolution từ các cờ khác (backend là nguồn sự thật)", () => {
    const row = normalizeImportRow({ row_index: 0, conflict_status: "conflict", needs_field_fix: true });
    expect(row.needs_resolution).toBe(false);
  });

  it("existing_record null giữ null; field_errors null -> {}", () => {
    const row = normalizeImportRow({ row_index: 0, conflict_status: "no_conflict", existing_record: null, field_errors: null });
    expect(row.existing_record).toBeNull();
    expect(row.field_errors).toEqual({});
  });
});

describe("summarizeImportRowErrors", () => {
  const make = (n: number): ImportRowError[] =>
    Array.from({ length: n }, (_, i) => ({ row_number: i + 2, field_name: "email", rule: "email", message: `lỗi ${i}` }));

  it("giới hạn mặc định là 20", () => {
    expect(IMPORT_ROW_ERRORS_DISPLAY_LIMIT).toBe(20);
  });

  it("ít hơn giới hạn -> hiện hết, hiddenCount = 0", () => {
    const { shown, hiddenCount } = summarizeImportRowErrors(make(5));
    expect(shown).toHaveLength(5);
    expect(hiddenCount).toBe(0);
  });

  it("đúng bằng giới hạn -> hiddenCount = 0", () => {
    const { shown, hiddenCount } = summarizeImportRowErrors(make(20));
    expect(shown).toHaveLength(20);
    expect(hiddenCount).toBe(0);
  });

  it("nhiều hơn giới hạn -> cắt 20 dòng ĐẦU và đếm phần bị ẩn", () => {
    const errors = make(1234);
    const { shown, hiddenCount } = summarizeImportRowErrors(errors);
    expect(shown).toEqual(errors.slice(0, 20));
    expect(hiddenCount).toBe(1214);
  });

  it("limit tuỳ chỉnh và mảng rỗng", () => {
    expect(summarizeImportRowErrors(make(10), 3)).toEqual({ shown: make(10).slice(0, 3), hiddenCount: 7 });
    expect(summarizeImportRowErrors([])).toEqual({ shown: [], hiddenCount: 0 });
  });

  it("không sửa mảng gốc", () => {
    const errors = make(30);
    summarizeImportRowErrors(errors);
    expect(errors).toHaveLength(30);
  });
});
