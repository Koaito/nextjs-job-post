import { describe, expect, it } from "vitest";
import {
  DEFAULT_DATA_ENTITY,
  EMPTY_EXPORT_FORM,
  exportHttpErrorMessage,
  exportStatusOptions,
  formToExportFilters,
  formatPreviewCell,
  parseEntityParam,
} from "@/lib/data-ops/export-ui";
import { buildExportQuery, validateExportFilters } from "@/lib/data-ops/export-filters";

describe("parseEntityParam", () => {
  it("nhận 3 entity hợp lệ, kể cả khi là mảng (?entity=a&entity=b lấy phần tử đầu)", () => {
    expect(parseEntityParam("job")).toBe("job");
    expect(parseEntityParam("company")).toBe("company");
    expect(parseEntityParam(["contact", "job"])).toBe("contact");
  });

  it("thiếu hoặc lạ -> mặc định job, không ném lỗi", () => {
    expect(parseEntityParam(undefined)).toBe(DEFAULT_DATA_ENTITY);
    expect(parseEntityParam("")).toBe("job");
    expect(parseEntityParam("JOB")).toBe("job");
    expect(parseEntityParam("users")).toBe("job");
    expect(parseEntityParam([])).toBe("job");
  });
});

describe("exportStatusOptions", () => {
  it("job: OPEN/CLOSED, gửi KEY backend chứ không gửi nhãn", () => {
    const opts = exportStatusOptions("job");
    expect(opts.map((o) => o.value)).toEqual(["OPEN", "CLOSED"]);
    expect(opts[0].label).toBe("Đang tuyển");
  });

  it("contact: 4 trạng thái; company: không có", () => {
    expect(exportStatusOptions("contact").map((o) => o.value)).toEqual([
      "UNCONTACTED",
      "EMAIL_SENT",
      "RESPONDED",
      "IN_PARTNERSHIP",
    ]);
    expect(exportStatusOptions("company")).toEqual([]);
  });
});

describe("formToExportFilters", () => {
  it("form rỗng -> không lọc gì, không lỗi", () => {
    const { filters, error } = formToExportFilters("job", EMPTY_EXPORT_FORM);
    expect(error).toBeNull();
    expect(buildExportQuery(filters)).toBe("");
  });

  it("bỏ field entity không hỗ trợ (đổi entity rồi form còn giá trị cũ)", () => {
    const form = { ...EMPTY_EXPORT_FORM, status: "OPEN", isActive: "true" as const, companyId: "c1" };
    expect(formToExportFilters("job", form).filters).toEqual({ status: "OPEN", company_id: "c1" });
    expect(formToExportFilters("company", form).filters).toEqual({ is_active: true });
    expect(formToExportFilters("contact", form).filters).toEqual({
      status: "OPEN",
      is_active: true,
      company_id: "c1",
    });
  });

  it("is_active = 'false' vẫn được gửi (khác chuỗi rỗng)", () => {
    const form = { ...EMPTY_EXPORT_FORM, isActive: "false" as const };
    expect(formToExportFilters("company", form).filters).toEqual({ is_active: false });
  });

  it("date_field chỉ đi kèm khi có ít nhất một đầu ngày", () => {
    const noDate = { ...EMPTY_EXPORT_FORM, dateField: "updated_at" as const };
    expect(formToExportFilters("job", noDate).filters.date_field).toBeUndefined();

    const withDate = { ...noDate, fromDate: "2026-11-01" };
    expect(formToExportFilters("job", withDate).filters).toEqual({
      from_date: "2026-11-01",
      date_field: "updated_at",
    });
  });

  it("limit: chỉ nhận chuỗi toàn chữ số; '1e3', '0x10', '-5', '2.5', 'abc' bị từ chối", () => {
    expect(formToExportFilters("job", { ...EMPTY_EXPORT_FORM, limit: " 50 " }).filters.limit).toBe(50);
    for (const bad of ["1e3", "0x10", "-5", "2.5", "abc"]) {
      const { error } = formToExportFilters("job", { ...EMPTY_EXPORT_FORM, limit: bad });
      expect(error, bad).toMatch(/số nguyên/);
    }
  });

  it("limit = 0 qua được bước form nhưng bị validateExportFilters chặn", () => {
    const { filters, error } = formToExportFilters("job", { ...EMPTY_EXPORT_FORM, limit: "0" });
    expect(error).toBeNull();
    expect(validateExportFilters("job", filters)).toMatch(/lớn hơn 0/);
  });

  it("từ ngày sau đến ngày -> validate báo lỗi", () => {
    const { filters } = formToExportFilters("job", {
      ...EMPTY_EXPORT_FORM,
      fromDate: "2026-11-10",
      toDate: "2026-11-01",
    });
    expect(validateExportFilters("job", filters)).toMatch(/trước hoặc bằng/);
  });
});

describe("formatPreviewCell", () => {
  it("null/undefined -> chuỗi rỗng; số/bool -> chuỗi", () => {
    expect(formatPreviewCell(null)).toBe("");
    expect(formatPreviewCell(undefined)).toBe("");
    expect(formatPreviewCell(0)).toBe("0");
    expect(formatPreviewCell(false)).toBe("false");
  });

  it("object/mảng -> JSON; chuỗi dài bị cắt có dấu …", () => {
    expect(formatPreviewCell({ a: 1 })).toBe('{"a":1}');
    expect(formatPreviewCell(["x", "y"])).toBe('["x","y"]');
    const long = formatPreviewCell("a".repeat(500));
    expect(long.length).toBe(121);
    expect(long.endsWith("…")).toBe(true);
  });

  it("không ném lỗi với giá trị vòng (JSON.stringify lỗi)", () => {
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    expect(formatPreviewCell(loop)).toBe("");
  });

  it("giữ nguyên chuỗi có thẻ HTML (việc escape do React lo)", () => {
    expect(formatPreviewCell("<b>x</b>")).toBe("<b>x</b>");
  });
});

describe("exportHttpErrorMessage", () => {
  it("map status -> tiếng Việt, 4xx khác dùng message backend", () => {
    expect(exportHttpErrorMessage(401)).toMatch(/hết/);
    expect(exportHttpErrorMessage(403)).toMatch(/quyền/);
    expect(exportHttpErrorMessage(404)).toMatch(/quyền/);
    expect(exportHttpErrorMessage(429)).toMatch(/quá nhanh/);
    expect(exportHttpErrorMessage(503)).toMatch(/Máy chủ/);
    expect(exportHttpErrorMessage(400, "Bộ lọc sai")).toBe("Bộ lọc sai");
    expect(exportHttpErrorMessage(undefined)).toMatch(/Không thực hiện/);
  });
});
