import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatDateTimeVN,
  formatDateVN,
  formatMessageTimeVN,
  formatShortDateTimeVN,
  todayVN,
  toVNDate,
} from "@/lib/date";

describe("todayVN", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("00:30 sáng VN (còn là 17:30 UTC hôm trước) vẫn tính là ngày mới của VN", () => {
    vi.setSystemTime(new Date("2026-11-12T17:30:00Z"));
    expect(todayVN()).toBe("2026-11-13");
  });

  it("06:59 VN = 23:59 UTC vẫn là ngày VN kế tiếp", () => {
    vi.setSystemTime(new Date("2026-11-12T23:59:00Z"));
    expect(todayVN()).toBe("2026-11-13");
  });

  it("ngay trước nửa đêm VN (16:59 UTC) vẫn là ngày hôm đó", () => {
    vi.setSystemTime(new Date("2026-11-13T16:59:00Z"));
    expect(todayVN()).toBe("2026-11-13");
  });

  it("đúng nửa đêm VN (17:00 UTC) sang ngày mới", () => {
    vi.setSystemTime(new Date("2026-11-13T17:00:00Z"));
    expect(todayVN()).toBe("2026-11-14");
  });

  it("qua ranh giới tháng và năm theo giờ VN", () => {
    vi.setSystemTime(new Date("2026-10-31T17:00:00Z"));
    expect(todayVN()).toBe("2026-11-01");
    vi.setSystemTime(new Date("2026-12-31T20:00:00Z"));
    expect(todayVN()).toBe("2027-01-01");
  });
});

describe("toVNDate", () => {
  it("chuỗi chỉ có ngày -> giữ nguyên", () => {
    expect(toVNDate("2026-09-29")).toBe("2026-09-29");
  });

  it("timestamp UTC (Z) được quy đổi sang ngày VN", () => {
    expect(toVNDate("2026-09-28T18:00:00Z")).toBe("2026-09-29");
    expect(toVNDate("2026-09-28T16:59:59Z")).toBe("2026-09-28");
  });

  it("timestamp có offset +07:00 hoặc +00:00", () => {
    expect(toVNDate("2026-09-29T01:00:00+07:00")).toBe("2026-09-29");
    expect(toVNDate("2026-09-28T23:00:00+00:00")).toBe("2026-09-29");
  });

  it("datetime không có múi giờ (naive) -> lấy nguyên 10 ký tự đầu, không cộng/trừ giờ", () => {
    expect(toVNDate("2026-09-29T10:00:00")).toBe("2026-09-29");
    expect(toVNDate("2026-09-29T23:59:59")).toBe("2026-09-29");
  });

  it("tolerate khoảng trắng hai đầu", () => {
    expect(toVNDate("  2026-09-29  ")).toBe("2026-09-29");
  });

  it("rỗng / null / không parse được -> null", () => {
    expect(toVNDate(null)).toBeNull();
    expect(toVNDate(undefined)).toBeNull();
    expect(toVNDate("")).toBeNull();
    expect(toVNDate("hôm qua")).toBeNull();
    expect(toVNDate("2026-13-45T00:00:00Z")).toBeNull();
  });
});

describe("formatDateVN", () => {
  it("YYYY-MM-DD -> dd/mm/yyyy", () => {
    expect(formatDateVN("2026-09-29")).toBe("29/09/2026");
  });

  it("timestamp UTC được quy đổi giờ VN trước khi format", () => {
    expect(formatDateVN("2026-09-28T18:00:00Z")).toBe("29/09/2026");
  });

  it("rỗng / lỗi -> \"—\"", () => {
    expect(formatDateVN(null)).toBe("—");
    expect(formatDateVN("")).toBe("—");
    expect(formatDateVN("abc")).toBe("—");
  });
});

describe("formatDateTimeVN", () => {
  it("UTC -> dd/mm/yyyy HH:mm theo giờ VN (không có dấu phẩy)", () => {
    expect(formatDateTimeVN("2026-09-29T03:05:00Z")).toBe("29/09/2026 10:05");
  });

  it("qua nửa đêm VN: UTC 17:05 -> 00:05 ngày kế tiếp (không phải 24:05)", () => {
    expect(formatDateTimeVN("2026-09-29T17:05:00Z")).toBe("30/09/2026 00:05");
  });

  it("rỗng / lỗi -> \"—\"", () => {
    expect(formatDateTimeVN(null)).toBe("—");
    expect(formatDateTimeVN("abc")).toBe("—");
  });
});

describe("formatShortDateTimeVN", () => {
  it("dd/mm HH:mm theo giờ VN", () => {
    expect(formatShortDateTimeVN("2026-09-29T03:05:00Z")).toBe("29/09 10:05");
  });

  it("00:05 không hiện thành 24:05", () => {
    expect(formatShortDateTimeVN("2026-09-29T17:05:00Z")).toBe("30/09 00:05");
  });

  it("rỗng / lỗi -> chuỗi rỗng", () => {
    expect(formatShortDateTimeVN(null)).toBe("");
    expect(formatShortDateTimeVN("abc")).toBe("");
  });
});

describe("formatMessageTimeVN", () => {
  it("HH:mm dd/mm (ngược thứ tự với formatShortDateTimeVN)", () => {
    expect(formatMessageTimeVN("2026-09-29T03:05:00Z")).toBe("10:05 29/09");
  });

  it("00:05 không hiện thành 24:05", () => {
    expect(formatMessageTimeVN("2026-09-29T17:05:00Z")).toBe("00:05 30/09");
  });

  it("rỗng / lỗi -> chuỗi rỗng", () => {
    expect(formatMessageTimeVN(undefined)).toBe("");
    expect(formatMessageTimeVN("abc")).toBe("");
  });
});
