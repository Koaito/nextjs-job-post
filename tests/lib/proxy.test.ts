import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { isPublicPath } from "@/lib/public-routes";

function req(path: string, cookies: Record<string, string> = {}): NextRequest {
  const cookie = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  return new NextRequest(`http://localhost:3000${path}`, cookie ? { headers: { cookie } } : undefined);
}

function deletedCookies(res: Response): string[] {
  return res.headers
    .getSetCookie()
    .filter((c) => /expires=Thu, 01 Jan 1970|max-age=0/i.test(c))
    .map((c) => c.split("=")[0]);
}

describe("isPublicPath", () => {
  it.each(["/", "/jobs", "/jobs/more", "/jobs/abc-123", "/login", "/register", "/forgot-password", "/reset-password", "/verify-email"])(
    "%s công khai",
    (p) => expect(isPublicPath(p)).toBe(true),
  );

  it.each(["/jobs/add", "/jobs/abc/edit", "/jobs/a/b/c", "/dashboard", "/them-moi", "/profile/security", "/messages", "/staff-accounts"])(
    "%s cần đăng nhập",
    (p) => expect(isPublicPath(p)).toBe(false),
  );
});

describe("proxy — chặn sớm route cần đăng nhập", () => {
  it("thiếu cookie phiên -> redirect /login?next=<path>", () => {
    const res = proxy(req("/profile/security"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname + new URL(res.headers.get("location")!).search).toBe(
      "/login?next=%2Fprofile%2Fsecurity",
    );
  });

  it("/jobs/add và /jobs/[id]/edit KHÔNG công khai", () => {
    expect(proxy(req("/jobs/add")).status).toBe(307);
    expect(proxy(req("/jobs/abc/edit")).status).toBe(307);
  });

  it("có cookie phiên -> cho đi tiếp (không kiểm hợp lệ ở đây)", () => {
    const res = proxy(req("/profile/security", { mx_session: "s1.abc" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("cookie phiên rỗng coi như không có", () => {
    expect(proxy(req("/dashboard", { mx_session: "" })).status).toBe(307);
  });

  it("route công khai không bao giờ redirect, có hay không có cookie", () => {
    for (const p of ["/", "/jobs", "/jobs/xyz", "/login", "/register"]) {
      expect(proxy(req(p)).status).toBe(200);
      expect(proxy(req(p, { mx_session: "s1.abc" })).status).toBe(200);
    }
  });
});

describe("proxy — x-invoke-path", () => {
  it("gắn pathname vào header request đi tiếp (auth-guard đọc lại)", () => {
    const res = proxy(req("/dashboard?x=1", { mx_session: "s1.abc" }));
    // NextResponse.next({request:{headers}}) phát header ghi đè qua x-middleware-request-*.
    expect(res.headers.get("x-middleware-request-x-invoke-path")).toBe("/dashboard");
    expect(res.headers.get("x-middleware-override-headers")).toContain("x-invoke-path");
  });
});

describe("proxy — không refresh, không gọi backend", () => {
  it("không gọi fetch ở bất kỳ nhánh nào", () => {
    const calls: unknown[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = ((...a: unknown[]) => {
      calls.push(a);
      return Promise.reject(new Error("proxy không được gọi mạng"));
    }) as typeof fetch;
    try {
      proxy(req("/dashboard"));
      proxy(req("/dashboard", { mx_session: "s1.abc" }));
      proxy(req("/jobs", { mx_access: "eyJ.a.b", mx_refresh: "r" }));
    } finally {
      globalThis.fetch = original;
    }
    expect(calls).toEqual([]);
  });

  it("không bao giờ ghi cookie phiên (chỉ có thể xoá cookie cũ)", () => {
    const res = proxy(req("/dashboard", { mx_session: "s1.abc" }));
    expect(res.headers.getSetCookie()).toEqual([]);
  });
});

describe("proxy — dọn cookie cũ mx_access/mx_refresh", () => {
  it("route công khai: xoá cả hai cookie cũ, giữ nguyên cookie mới", () => {
    const res = proxy(req("/jobs", { mx_access: "eyJ.a.b", mx_refresh: "r", mx_session: "s1.abc" }));
    expect(res.status).toBe(200);
    expect(deletedCookies(res).sort()).toEqual(["mx_access", "mx_refresh"]);
  });

  it("route cần đăng nhập, chưa có cookie mới: redirect /login VÀ xoá cookie cũ (người dùng bị đăng xuất 1 lần)", () => {
    const res = proxy(req("/dashboard", { mx_access: "eyJ.a.b", mx_refresh: "r" }));
    expect(res.status).toBe(307);
    expect(deletedCookies(res).sort()).toEqual(["mx_access", "mx_refresh"]);
  });

  it("chỉ có một trong hai cookie cũ -> chỉ xoá cái đó", () => {
    expect(deletedCookies(proxy(req("/jobs", { mx_refresh: "r" })))).toEqual(["mx_refresh"]);
  });

  it("không có cookie cũ -> không phát Set-Cookie nào", () => {
    expect(proxy(req("/jobs")).headers.getSetCookie()).toEqual([]);
  });
});
