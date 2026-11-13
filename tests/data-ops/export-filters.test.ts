import { describe, expect, it } from "vitest";
import {
  buildExportDownloadQuery,
  buildExportQuery,
  exportFiltersKey,
  isDataEntityType,
  isExportFormat,
  parseExportFilters,
  validateExportFilters,
  type ExportFilters,
} from "@/lib/data-ops/export-filters";

describe("isDataEntityType / isExportFormat", () => {
  it("chỉ nhận giá trị hợp lệ", () => {
    expect(isDataEntityType("job")).toBe(true);
    expect(isDataEntityType("company")).toBe(true);
    expect(isDataEntityType("contact")).toBe(true);
    expect(isDataEntityType("user")).toBe(false);
    expect(isDataEntityType("")).toBe(false);
    expect(isDataEntityType("JOB")).toBe(false);

    expect(isExportFormat("xlsx")).toBe(true);
    expect(isExportFormat("csv")).toBe(true);
    expect(isExportFormat("pdf")).toBe(false);
  });
});

describe("buildExportQuery", () => {
  it("bộ lọc rỗng -> chuỗi rỗng", () => {
    expect(buildExportQuery({})).toBe("");
  });

  it("bỏ giá trị rỗng / chỉ khoảng trắng", () => {
    expect(buildExportQuery({ status: "", company_id: "   " })).toBe("");
  });

  it("is_active=false vẫn được gửi (khác với undefined)", () => {
    expect(buildExportQuery({ is_active: false })).toBe("is_active=false");
    expect(buildExportQuery({ is_active: true })).toBe("is_active=true");
    expect(buildExportQuery({ is_active: undefined })).toBe("");
  });

  it("thứ tự khoá cố định bất kể thứ tự khai báo", () => {
    const a: ExportFilters = { limit: 10, status: "open", company_id: "c1", is_active: true };
    const b: ExportFilters = { company_id: "c1", is_active: true, status: "open", limit: 10 };
    expect(buildExportQuery(a)).toBe(buildExportQuery(b));
    expect(buildExportQuery(a)).toBe("status=open&is_active=true&company_id=c1&limit=10");
  });

  it("có ngày thì date_field mặc định là created_at", () => {
    expect(buildExportQuery({ from_date: "2026-01-01" })).toBe("date_field=created_at&from_date=2026-01-01");
  });

  it("date_field tuỳ chọn được giữ", () => {
    expect(buildExportQuery({ date_field: "updated_at", to_date: "2026-02-01" })).toBe(
      "date_field=updated_at&to_date=2026-02-01",
    );
  });

  it("không có from/to thì date_field vô nghĩa -> không gửi", () => {
    expect(buildExportQuery({ date_field: "updated_at" })).toBe("");
  });

  it("limit = 0 vẫn được gửi để backend/validate báo lỗi (không âm thầm bỏ)", () => {
    expect(buildExportQuery({ limit: 0 })).toBe("limit=0");
  });

  it("cắt khoảng trắng ở status và company_id", () => {
    expect(buildExportQuery({ status: " open ", company_id: " c1 " })).toBe("status=open&company_id=c1");
  });

  it("mã hoá ký tự đặc biệt", () => {
    expect(buildExportQuery({ status: "a&b=c" })).toBe("status=a%26b%3Dc");
  });
});

describe("exportFiltersKey / buildExportDownloadQuery (xem gì tải đó)", () => {
  it("hai bộ lọc tương đương cho cùng một khoá", () => {
    expect(exportFiltersKey({ status: "open" })).toBe(exportFiltersKey({ status: " open ", company_id: "" }));
  });

  it("khoá đổi khi bộ lọc đổi", () => {
    expect(exportFiltersKey({ status: "open" })).not.toBe(exportFiltersKey({ status: "closed" }));
  });

  it("query tải = query preview + format ở CUỐI", () => {
    const f: ExportFilters = { status: "open", limit: 5 };
    expect(buildExportDownloadQuery(f, "csv")).toBe(`${buildExportQuery(f)}&format=csv`);
  });

  it("không có bộ lọc -> chỉ có format", () => {
    expect(buildExportDownloadQuery({}, "xlsx")).toBe("format=xlsx");
  });
});

describe("parseExportFilters", () => {
  const parse = (qs: string) => parseExportFilters(new URLSearchParams(qs));

  it("querystring rỗng -> {}", () => {
    expect(parse("")).toEqual({});
  });

  it("parse đầy đủ", () => {
    expect(
      parse("status=open&is_active=false&company_id=c1&date_field=updated_at&from_date=2026-01-01&to_date=2026-02-01&limit=20"),
    ).toEqual({
      status: "open",
      is_active: false,
      company_id: "c1",
      date_field: "updated_at",
      from_date: "2026-01-01",
      to_date: "2026-02-01",
      limit: 20,
    });
  });

  it("bỏ khoá lạ (whitelist)", () => {
    expect(parse("status=open&hack=1&format=csv")).toEqual({ status: "open" });
  });

  it("is_active sai kiểu -> ném lỗi (không âm thầm bỏ lọc)", () => {
    expect(() => parse("is_active=abc")).toThrow("is_active");
    expect(() => parse("is_active=1")).toThrow("is_active");
  });

  it("date_field sai -> ném lỗi", () => {
    expect(() => parse("date_field=deleted_at")).toThrow("date_field");
  });

  it("limit không phải số nguyên -> ném lỗi", () => {
    expect(() => parse("limit=x")).toThrow("limit");
    expect(() => parse("limit=1.5")).toThrow("limit");
  });

  it("round-trip: parse(buildExportQuery(f)) = f cho bộ lọc đã chuẩn hoá", () => {
    const f: ExportFilters = {
      status: "open",
      is_active: true,
      company_id: "c1",
      date_field: "created_at",
      from_date: "2026-01-01",
      to_date: "2026-01-31",
      limit: 100,
    };
    expect(parse(buildExportQuery(f))).toEqual(f);
  });
});

describe("validateExportFilters", () => {
  it("hợp lệ -> null", () => {
    expect(validateExportFilters("job", { status: "open", company_id: "c1" })).toBeNull();
    expect(validateExportFilters("company", { is_active: true })).toBeNull();
    expect(validateExportFilters("contact", { status: "x", is_active: false, company_id: "c" })).toBeNull();
    expect(validateExportFilters("job", {})).toBeNull();
  });

  it("job không có is_active", () => {
    expect(validateExportFilters("job", { is_active: true })).toMatch(/không có bộ lọc/);
  });

  it("company không có status và company_id", () => {
    expect(validateExportFilters("company", { status: "x" })).toMatch(/trạng thái/);
    expect(validateExportFilters("company", { company_id: "c" })).toMatch(/công ty/);
  });

  it("định dạng ngày sai", () => {
    expect(validateExportFilters("job", { from_date: "01/01/2026" })).toMatch(/bắt đầu/);
    expect(validateExportFilters("job", { to_date: "2026-1-1" })).toMatch(/kết thúc/);
  });

  it("from > to", () => {
    expect(validateExportFilters("job", { from_date: "2026-02-01", to_date: "2026-01-01" })).toMatch(/trước hoặc bằng/);
  });

  it("from = to là hợp lệ", () => {
    expect(validateExportFilters("job", { from_date: "2026-01-01", to_date: "2026-01-01" })).toBeNull();
  });

  it("limit phải là số nguyên > 0", () => {
    expect(validateExportFilters("job", { limit: 0 })).toMatch(/lớn hơn 0/);
    expect(validateExportFilters("job", { limit: -3 })).toMatch(/lớn hơn 0/);
    expect(validateExportFilters("job", { limit: 1.5 })).toMatch(/lớn hơn 0/);
    expect(validateExportFilters("job", { limit: 1 })).toBeNull();
  });
});
