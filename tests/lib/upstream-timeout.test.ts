import { describe, expect, it } from "vitest";
import { UPSTREAM_TIMEOUT_CODE, UPSTREAM_TIMEOUT_MESSAGE, isUpstreamTimeout } from "@/lib/upstream-timeout";
import { crawlTriggerErrorMessage } from "@/lib/data-ops/crawl-form";
import { closeJobErrorMessage } from "@/lib/data-ops/data-health";
import { exportHttpErrorMessage } from "@/lib/data-ops/export-ui";
import { importHttpErrorMessage } from "@/lib/data-ops/import-ui";
import { maintenanceTriggerErrorMessage } from "@/lib/data-ops/maintenance-form";

describe("isUpstreamTimeout", () => {
  it("nhận cả 504 thật của hạ tầng lẫn mã upstream_timeout của app", () => {
    expect(isUpstreamTimeout(504)).toBe(true);
    expect(isUpstreamTimeout(504, "bat_ky")).toBe(true);
    expect(isUpstreamTimeout(undefined, UPSTREAM_TIMEOUT_CODE)).toBe(true);
    expect(isUpstreamTimeout(502, UPSTREAM_TIMEOUT_CODE)).toBe(true);
  });
  it("không nhận các lỗi khác (kể cả 5xx khác và không có status)", () => {
    for (const s of [undefined, 0, 200, 400, 401, 429, 500, 502, 503]) expect(isUpstreamTimeout(s), String(s)).toBe(false);
    expect(isUpstreamTimeout(500, "internal_error")).toBe(false);
  });
});

// Mọi nơi báo lỗi của Nhóm 6 phải cho người dùng CÙNG câu "phản hồi quá lâu", không rơi vào câu chung của 5xx.
describe("câu báo lỗi 504 thống nhất ở mọi hàm báo lỗi", () => {
  const cases: Array<[string, () => string, () => string]> = [
    ["export (status 504)", () => exportHttpErrorMessage(504), () => exportHttpErrorMessage(500)],
    ["import (status 504)", () => importHttpErrorMessage(504), () => importHttpErrorMessage(500)],
    ["import (mã upstream_timeout)", () => importHttpErrorMessage(502, UPSTREAM_TIMEOUT_CODE), () => importHttpErrorMessage(502)],
    ["crawl (status 504)", () => crawlTriggerErrorMessage(504), () => crawlTriggerErrorMessage(500)],
    ["crawl (mã upstream_timeout)", () => crawlTriggerErrorMessage(502, UPSTREAM_TIMEOUT_CODE), () => crawlTriggerErrorMessage(502)],
    ["bảo trì (status 504)", () => maintenanceTriggerErrorMessage(504), () => maintenanceTriggerErrorMessage(500)],
    ["đóng job (status 504)", () => closeJobErrorMessage(504), () => closeJobErrorMessage(500)],
  ];
  for (const [name, timeout, generic5xx] of cases) {
    it(name, () => {
      expect(timeout()).toBe(UPSTREAM_TIMEOUT_MESSAGE);
      expect(generic5xx()).not.toBe(UPSTREAM_TIMEOUT_MESSAGE); // 500 thường vẫn là câu chung
    });
  }
  it("504 thắng message tiếng Anh của backend (fallback không lọt ra màn hình)", () => {
    expect(exportHttpErrorMessage(504, "Gateway Timeout")).toBe(UPSTREAM_TIMEOUT_MESSAGE);
    expect(closeJobErrorMessage(504, "Gateway Timeout")).toBe(UPSTREAM_TIMEOUT_MESSAGE);
    expect(importHttpErrorMessage(504, undefined, "Gateway Timeout")).toBe(UPSTREAM_TIMEOUT_MESSAGE);
    expect(crawlTriggerErrorMessage(504, undefined, "Gateway Timeout")).toBe(UPSTREAM_TIMEOUT_MESSAGE);
  });
  it("các nhánh có sẵn không đổi: 429/409/503 của đóng job vẫn đúng câu cũ", () => {
    expect(exportHttpErrorMessage(429)).toMatch(/quá nhanh/);
    expect(crawlTriggerErrorMessage(409)).toMatch(/chạy dở/);
    expect(closeJobErrorMessage(503, "Đợi vài giây")).toBe("Đợi vài giây");
  });
});
