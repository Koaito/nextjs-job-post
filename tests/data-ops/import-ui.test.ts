import { describe, expect, it } from "vitest";
import {
  IMPORT_MAX_FILE_BYTES,
  IMPORT_PREVIEW_COLUMNS,
  IMPORT_REQUIRED_COLUMNS,
  actionOptionsFor,
  formatImportCell,
  initialFixInputValue,
  formatImportResult,
  formatSimilarity,
  importHttpErrorMessage,
  isPreviewGone,
  pageCount,
  pairChoiceLabels,
  validateImportFile,
} from "@/lib/data-ops/import-ui";
import { IMPORT_PREVIEW_EXPIRED_MESSAGE } from "@/lib/data-ops/import";

describe("validateImportFile", () => {
  it("nhận csv/xlsx không phân biệt hoa thường", () => {
    expect(validateImportFile({ name: "A.CSV", size: 10 })).toBeNull();
    expect(validateImportFile({ name: "a.xlsx", size: 10 })).toBeNull();
  });
  it("từ chối thiếu file, sai đuôi, rỗng, quá lớn", () => {
    expect(validateImportFile(null)).toMatch(/chọn file/);
    expect(validateImportFile({ name: "a.xls", size: 10 })).toMatch(/\.csv hoặc \.xlsx/);
    expect(validateImportFile({ name: "a.csv.exe", size: 10 })).toMatch(/\.csv hoặc \.xlsx/);
    expect(validateImportFile({ name: "a.csv", size: 0 })).toMatch(/rỗng/);
    expect(validateImportFile({ name: "a.csv", size: IMPORT_MAX_FILE_BYTES + 1 })).toMatch(/quá lớn/);
    expect(validateImportFile({ name: "a.csv", size: IMPORT_MAX_FILE_BYTES })).toBeNull();
  });
});

describe("importHttpErrorMessage / isPreviewGone", () => {
  it("rẽ nhánh theo code/status, không theo nội dung message", () => {
    expect(importHttpErrorMessage(410)).toBe(IMPORT_PREVIEW_EXPIRED_MESSAGE);
    expect(importHttpErrorMessage(400, "import_preview_expired", "English text")).toBe(IMPORT_PREVIEW_EXPIRED_MESSAGE);
    expect(importHttpErrorMessage(404, "import_not_found")).toMatch(/không còn|không tìm thấy|tải lại/i);
    expect(importHttpErrorMessage(400, "import_file_format_unsupported", "Unsupported")).toMatch(/\.csv hoặc \.xlsx/);
    expect(importHttpErrorMessage(400, "import_file_row_limit_exceeded")).toContain("5000");
    expect(importHttpErrorMessage(413)).toMatch(/quá lớn/);
    expect(importHttpErrorMessage(429)).toMatch(/20 lượt/);
    expect(importHttpErrorMessage(503)).toMatch(/máy chủ/i);
    expect(importHttpErrorMessage(422, undefined, "Dòng 3 thiếu level")).toBe("Dòng 3 thiếu level");
    expect(importHttpErrorMessage(400)).toBeTruthy();
  });
  it("preview mất khi 410 / hết hạn / không tìm thấy", () => {
    expect(isPreviewGone(410)).toBe(true);
    expect(isPreviewGone(404, "import_not_found")).toBe(true);
    expect(isPreviewGone(400, "import_preview_expired")).toBe(true);
    expect(isPreviewGone(404, "import_row_index_not_in_preview")).toBe(false);
    expect(isPreviewGone(500)).toBe(false);
  });
});

describe("hiển thị", () => {
  it("câu kết quả: kích hoạt lại là tập con của cập nhật", () => {
    expect(formatImportResult({ created: 2, updated: 1, skipped: 3, reactivated: 0 } as never)).toBe("Tạo mới 2, cập nhật 1, bỏ qua 3.");
    expect(formatImportResult({ created: 0, updated: 4, skipped: 0, reactivated: 2 } as never)).toBe(
      "Tạo mới 0, cập nhật 4 (trong đó 2 kích hoạt lại), bỏ qua 0.",
    );
  });
  it("ô và độ khớp", () => {
    expect(formatImportCell(null)).toBe("");
    expect(formatImportCell(5)).toBe("5");
    expect(formatImportCell(false)).toBe("false");
    expect(formatImportCell({ a: 1 })).toBe('{"a":1}');
    expect(formatSimilarity(0.874)).toBe("87%");
    expect(formatSimilarity(2)).toBe("100%");
    expect(formatSimilarity(NaN)).toBe("");
  });
  it("phân trang", () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(50)).toBe(1);
    expect(pageCount(51)).toBe(2);
  });
  it("nhãn cặp dùng số dòng trong file", () => {
    expect(pairChoiceLabels(4, 9).map((c) => c.value)).toEqual(["keep_this", "keep_other", "import_both"]);
    expect(pairChoiceLabels(4, 9)[0].label).toContain("dòng 4");
  });
});

describe("hành động theo status", () => {
  it("no_conflict không có lựa chọn; pending chỉ skip; inactive nói rõ kích hoạt lại", () => {
    expect(actionOptionsFor({ conflict_status: "no_conflict" })).toEqual([]);
    expect(actionOptionsFor({ conflict_status: "pending_company_resolution" }).map((o) => o.value)).toEqual(["skip"]);
    expect(actionOptionsFor({ conflict_status: "conflict" }).map((o) => o.value)).toEqual(["skip", "update", "create"]);
    expect(actionOptionsFor({ conflict_status: "conflict_inactive" })[1].label).toMatch(/kích hoạt lại/);
    expect(actionOptionsFor({ conflict_status: "conflict_in_batch" }).map((o) => o.value)).toEqual(["skip", "create"]);
  });
});

describe("cột (ghim theo backend entity_specs.py)", () => {
  it("cột bắt buộc", () => {
    expect(IMPORT_REQUIRED_COLUMNS.job).toEqual(["job_title", "company_name", "deadline"]);
    expect(IMPORT_REQUIRED_COLUMNS.company).toEqual(["company_name"]);
    expect(IMPORT_REQUIRED_COLUMNS.contact).toEqual(["contact_name", "work_email", "company_name"]);
  });
  it("mỗi entity có cột hiển thị", () => {
    for (const e of ["job", "company", "contact"] as const) expect(IMPORT_PREVIEW_COLUMNS[e].length).toBeGreaterThan(0);
  });
});

describe("initialFixInputValue", () => {
  it("ô ngày chỉ nhận yyyy-mm-dd, giá trị thô khác thì để trống; ô khác giữ nguyên", () => {
    expect(initialFixInputValue("date", "2030-05-05")).toBe("2030-05-05");
    expect(initialFixInputValue("date", "31/31/2030")).toBe("");
    expect(initialFixInputValue("date", "")).toBe("");
    expect(initialFixInputValue("text", "31/31/2030")).toBe("31/31/2030");
    expect(initialFixInputValue("email", "not-an-email")).toBe("not-an-email");
  });
});
