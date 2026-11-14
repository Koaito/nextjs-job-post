import { beforeEach, describe, expect, it, vi } from "vitest";

// lib/api/client.ts đọc CRAWLER_API_URL / CRAWLER_API_KEY lúc import -> đặt env TRƯỚC import.
vi.hoisted(() => {
  process.env.CRAWLER_API_URL = "https://api.test";
  process.env.CRAWLER_API_KEY = "key-xyz";
});
vi.mock("@/lib/session", () => ({ getSessionToken: vi.fn(async () => "s1.cookie-token") }));
vi.mock("@/lib/client-ip-server", () => ({ getClientIpHeaders: vi.fn(async () => ({})) }));

import { confirmImport, sanitizeResolutions } from "@/lib/api/import-export";
import type { ImportResolutions } from "@/lib/data-ops/import";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("sanitizeResolutions", () => {
  it("bỏ field undefined, giữ nguyên field có giá trị (kể cả null / false / chuỗi rỗng)", () => {
    const out = sanitizeResolutions({
      "0": {
        action: "update",
        company_id: undefined,
        confirm_reactivate: undefined,
        level_code: undefined,
        field_fixes: undefined,
      },
      "1": { action: "create", company_id: null, confirm_reactivate: false, level_code: "", field_fixes: {} },
    });
    // Không còn KHOÁ nào dù giá trị undefined: backend là extra="forbid".
    expect(Object.keys(out["0"])).toEqual(["action"]);
    expect(out["1"]).toEqual({
      action: "create",
      company_id: null,
      confirm_reactivate: false,
      level_code: "",
      field_fixes: {},
    });
  });

  it("company_id = null được giữ (nghĩa là 'tạo công ty mới'), không bị coi như undefined", () => {
    const out = sanitizeResolutions({ "3": { action: "create", company_id: null } });
    expect(out["3"]).toHaveProperty("company_id", null);
  });

  it("không thêm field lạ lọt từ input vào payload", () => {
    const dirty = { "0": { action: "skip", extra_field: "x" } } as unknown as ImportResolutions;
    expect(sanitizeResolutions(dirty)["0"]).toEqual({ action: "skip" });
  });

  it("khoá luôn là chuỗi row_index, chuẩn hoá cả khi khoá gõ dạng '007'", () => {
    const out = sanitizeResolutions({ "007": { action: "skip" } });
    expect(Object.keys(out)).toEqual(["7"]);
  });

  it("không đổi object đầu vào và không lược dòng nào", () => {
    const input: ImportResolutions = {
      "0": { action: "skip", level_code: undefined },
      "5": { action: "update", confirm_reactivate: true, field_fixes: { phone: "0912345678" } },
    };
    const snapshot = JSON.stringify(input);
    const out = sanitizeResolutions(input);
    expect(JSON.stringify(input)).toBe(snapshot);
    expect(Object.keys(out)).toEqual(["0", "5"]);
    expect(out["5"].field_fixes).toEqual({ phone: "0912345678" });
  });

  it("input rỗng -> object rỗng", () => {
    expect(sanitizeResolutions({})).toEqual({});
  });
});

describe("confirmImport", () => {
  it("note rỗng sau trim: ném lỗi, KHÔNG gọi mạng", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(confirmImport("job", { previewId: "p1", note: "   \n", resolutions: {} })).rejects.toThrow(
      "ghi chú",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("gửi note đã trim + resolutions đã làm sạch, đúng đường dẫn đã encode", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ created: 1, updated: 0, skipped: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const out = await confirmImport("job", {
      previewId: "p1",
      note: "  nhập đợt 11  ",
      resolutions: { "2": { action: "update", company_id: undefined, confirm_reactivate: true } },
    });

    expect(out).toEqual({ created: 1, updated: 0, skipped: 0 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.test/import/job/confirm");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      preview_id: "p1",
      note: "nhập đợt 11",
      resolutions: { "2": { action: "update", confirm_reactivate: true } },
    });
  });
});
