import { describe, expect, it, vi } from "vitest";

// auth-guard.ts import next/navigation, next/headers và lib/session (kéo theo
// cookies()) -> chỉ hàm thuần safeInternalPath được test ở đây, nên mock các
// phụ thuộc server để import module được ngoài ngữ cảnh Next.js.
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(), cookies: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSessionState: vi.fn() }));

import { safeInternalPath } from "@/lib/auth-guard";

describe("safeInternalPath (chặn open-redirect)", () => {
  it("chấp nhận path nội bộ", () => {
    expect(safeInternalPath("/")).toBe("/");
    expect(safeInternalPath("/jobs")).toBe("/jobs");
    expect(safeInternalPath("/jobs/123?tab=a&b=2#top")).toBe("/jobs/123?tab=a&b=2#top");
  });

  it("từ chối protocol-relative URL (//evil.com)", () => {
    expect(safeInternalPath("//evil.com")).toBeNull();
    expect(safeInternalPath("//evil.com/jobs")).toBeNull();
  });

  it("từ chối /\\ (trình duyệt cũ đổi backslash thành slash)", () => {
    expect(safeInternalPath("/\\evil.com")).toBeNull();
  });

  it("từ chối URL tuyệt đối và scheme nguy hiểm", () => {
    expect(safeInternalPath("https://evil.com")).toBeNull();
    expect(safeInternalPath("http://evil.com")).toBeNull();
    expect(safeInternalPath("javascript:alert(1)")).toBeNull();
    expect(safeInternalPath("data:text/html,<script>")).toBeNull();
  });

  it("từ chối đường dẫn tương đối", () => {
    expect(safeInternalPath("jobs")).toBeNull();
    expect(safeInternalPath("../jobs")).toBeNull();
    expect(safeInternalPath("./jobs")).toBeNull();
  });

  it("từ chối rỗng / null / undefined", () => {
    expect(safeInternalPath("")).toBeNull();
    expect(safeInternalPath(null)).toBeNull();
    expect(safeInternalPath(undefined)).toBeNull();
  });

  it("từ chối khoảng trắng ở đầu (không phải path bắt đầu bằng /)", () => {
    expect(safeInternalPath(" /jobs")).toBeNull();
  });
});
