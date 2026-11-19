import { describe, expect, it } from "vitest";
import {
  CLOSE_JOB_NOTES,
  DUP_PAGE_SIZE,
  closeJobErrorMessage,
  deadlineLabel,
  dupPageHref,
  expPageHref,
  isCloseJobKind,
  keepJobId,
  missingSummary,
  overflowPage,
  parseStatusQuery,
  slicePage,
  statusHref,
} from "@/lib/data-ops/data-health";

describe("CLOSE_JOB_NOTES", () => {
  it("câu cho bảng nhóm trùng giữ đúng câu của bản Flask", () => {
    expect(CLOSE_JOB_NOTES.duplicate).toBe("Đóng do nghi trùng lặp (tab Vận hành dữ liệu — Tình trạng dữ liệu)");
  });
  it("bảng hết hạn có câu riêng, khác câu của bảng trùng", () => {
    expect(CLOSE_JOB_NOTES.expired).toMatch(/quá hạn nhưng vẫn Đang tuyển/);
    expect(CLOSE_JOB_NOTES.expired).not.toBe(CLOSE_JOB_NOTES.duplicate);
  });
  it("isCloseJobKind chỉ nhận đúng hai loại, kể cả tên thuộc tính của Object", () => {
    expect(isCloseJobKind("duplicate")).toBe(true);
    expect(isCloseJobKind("expired")).toBe(true);
    for (const bad of ["", "Duplicate", "closed", "constructor", "toString", "__proto__", 1, null, undefined, {}]) {
      expect(isCloseJobKind(bad), String(bad)).toBe(false);
    }
  });
});

describe("parseStatusQuery / href", () => {
  it("mặc định trang 1 cho cả hai bảng; rác/âm/0/thập phân -> 1", () => {
    expect(parseStatusQuery({})).toEqual({ dupPage: 1, expPage: 1 });
    expect(parseStatusQuery({ dup_page: "abc", exp_page: "-2" })).toEqual({ dupPage: 1, expPage: 1 });
    expect(parseStatusQuery({ dup_page: "0", exp_page: "1.5" })).toEqual({ dupPage: 1, expPage: 1 });
  });
  it("đọc đúng hai tên param riêng, mỗi bảng một tên", () => {
    expect(parseStatusQuery({ dup_page: "3", exp_page: "2" })).toEqual({ dupPage: 3, expPage: 2 });
    expect(parseStatusQuery({ dup_page: ["4", "9"] })).toEqual({ dupPage: 4, expPage: 1 });
    expect(parseStatusQuery({ crawl_page: "5", maint_page: "6" })).toEqual({ dupPage: 1, expPage: 1 }); // param của tab khác không lọt vào
  });
  it("href lược trang 1; đổi trang bảng này giữ nguyên trang bảng kia", () => {
    expect(statusHref({ dupPage: 1, expPage: 1 })).toBe("/crawl?tab=status");
    expect(dupPageHref({ dupPage: 1, expPage: 3 }, 2)).toBe("/crawl?tab=status&dup_page=2&exp_page=3");
    expect(expPageHref({ dupPage: 2, expPage: 1 }, 4)).toBe("/crawl?tab=status&dup_page=2&exp_page=4");
    expect(dupPageHref({ dupPage: 2, expPage: 5 }, 1)).toBe("/crawl?tab=status&exp_page=5");
  });
});

describe("slicePage / overflowPage", () => {
  const items = Array.from({ length: 25 }, (_, i) => i + 1);
  it("cắt đúng trang và đếm đủ", () => {
    expect(slicePage(items, 1, 10)).toMatchObject({ page: 1, totalPages: 3, total: 25 });
    expect(slicePage(items, 1, 10).items).toEqual(items.slice(0, 10));
    expect(slicePage(items, 3, 10).items).toEqual([21, 22, 23, 24, 25]);
  });
  it("trang vượt phạm vi kẹp về trang cuối; trang 0/âm/NaN về trang 1", () => {
    expect(slicePage(items, 99, 10).page).toBe(3);
    expect(slicePage(items, 99, 10).items).toEqual([21, 22, 23, 24, 25]);
    expect(slicePage(items, 0, 10).page).toBe(1);
    expect(slicePage(items, -5, 10).page).toBe(1);
    expect(slicePage(items, Number.NaN, 10).page).toBe(1);
  });
  it("danh sách rỗng: 1 trang, không có phần tử", () => {
    expect(slicePage([], 1, DUP_PAGE_SIZE)).toEqual({ items: [], page: 1, totalPages: 1, total: 0 });
    expect(slicePage([], 7, DUP_PAGE_SIZE).page).toBe(1);
  });
  it("đúng bội số kích thước trang không sinh trang thừa", () => {
    expect(slicePage(Array.from({ length: 20 }, (_, i) => i), 1, 10).totalPages).toBe(2);
    expect(slicePage(Array.from({ length: 21 }, (_, i) => i), 1, 10).totalPages).toBe(3);
  });
  it("overflowPage: trang cuối cần chuyển tới, hoặc null khi còn trong phạm vi", () => {
    expect(overflowPage(3, 25, 10)).toBeNull();
    expect(overflowPage(4, 25, 10)).toBe(3);
    expect(overflowPage(1, 0, 10)).toBeNull();
    expect(overflowPage(2, 0, 10)).toBe(1);
    expect(overflowPage(3, 20, 10)).toBe(2);
  });
});

describe("keepJobId", () => {
  const jobs = [{ id: "a" }, { id: "b" }];
  it("trả suggest_keep của backend khi nó thuộc nhóm", () => {
    expect(keepJobId({ jobs, suggest_keep: "b" })).toBe("b");
  });
  it("null/undefined/rỗng -> không gợi ý", () => {
    expect(keepJobId({ jobs, suggest_keep: null })).toBeNull();
    expect(keepJobId({ jobs })).toBeNull();
    expect(keepJobId({ jobs, suggest_keep: "" })).toBeNull();
  });
  it("id không thuộc nhóm (dữ liệu lệch) -> không đánh dấu nhầm", () => {
    expect(keepJobId({ jobs, suggest_keep: "zzz" })).toBeNull();
  });
});

describe("deadlineLabel / missingSummary", () => {
  it("đổi ngày ISO sang dd/mm/yyyy, không qua Date nên không lệch múi giờ", () => {
    expect(deadlineLabel("2026-11-30")).toBe("30/11/2026");
    expect(deadlineLabel("2026-01-05T00:00:00Z")).toBe("05/01/2026");
  });
  it("thiếu hoặc sai định dạng -> Không rõ", () => {
    for (const bad of [null, undefined, "", "30/11/2026", "abc"]) expect(deadlineLabel(bad as never)).toBe("Không rõ");
  });
  it("missingSummary: có phần trăm khi total > 0; total 0 không chia cho 0", () => {
    expect(missingSummary({ missing: 12, total: 40, pct_missing: 30 })).toBe("12/40 (30%)");
    expect(missingSummary({ missing: 0, total: 0, pct_missing: 0 })).toBe("0/0");
  });
});

describe("closeJobErrorMessage", () => {
  it("404 báo job không còn; 503 dùng message backend nếu có", () => {
    expect(closeJobErrorMessage(404)).toMatch(/không còn tồn tại/);
    expect(closeJobErrorMessage(503, "Đợi vài giây")).toBe("Đợi vài giây");
    expect(closeJobErrorMessage(503)).toMatch(/Đợi vài giây/);
  });
  it("401, 403, 5xx, lỗi lạ", () => {
    expect(closeJobErrorMessage(401)).toMatch(/hết hạn/);
    expect(closeJobErrorMessage(403)).toMatch(/quyền/);
    expect(closeJobErrorMessage(500)).toMatch(/sự cố/);
    expect(closeJobErrorMessage(undefined)).toMatch(/Không đóng được/);
    expect(closeJobErrorMessage(400)).toMatch(/Không đóng được/);
  });
});
