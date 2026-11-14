import { beforeEach, describe, expect, it, vi } from "vitest";

// lib/api/auth.ts đọc CRAWLER_API_URL / CRAWLER_API_KEY ngay lúc import -> đặt env TRƯỚC import (vi.hoisted chạy trước).
vi.hoisted(() => {
  process.env.CRAWLER_API_URL = "https://api.test";
  process.env.CRAWLER_API_KEY = "key-xyz";
});

vi.mock("@/lib/client-ip-server", () => ({ getClientIpHeaders: vi.fn(async () => ({})) }));
vi.mock("@/lib/session", () => ({ getSessionToken: vi.fn(async () => "s1.cookie-token") }));

import { ApiError } from "@/lib/api/client";
import { getMe, login, logout } from "@/lib/api/auth";

const API_URL = "https://api.test";

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const GOOD = {
  access_token: "eyJ.access.jwt",
  refresh_token: "refresh-old",
  token_type: "bearer",
  must_change_password: false,
  session_token: "s1.AbC-123_xyz",
  session_expires_at: "2026-12-14T00:00:00Z",
};

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("login", () => {
  it("chỉ trả session token + hạn + cờ đổi mật khẩu; KHÔNG lộ access/refresh token cũ", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes({ ...GOOD, must_change_password: true })));
    const out = await login("a@b.c", "pw");
    expect(out).toEqual({
      sessionToken: "s1.AbC-123_xyz",
      sessionExpiresAt: "2026-12-14T00:00:00Z",
      mustChangePassword: true,
    });
    expect(JSON.stringify(out)).not.toContain("eyJ");
    expect(JSON.stringify(out)).not.toContain("refresh-old");
  });

  it("gọi POST /auth/login với email + password và X-API-Key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonRes(GOOD));
    vi.stubGlobal("fetch", fetchMock);
    await login("a@b.c", "pw");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe(`${API_URL}/auth/login`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ email: "a@b.c", password: "pw" });
    expect(init.headers["X-API-Key"]).toBe("key-xyz");
  });

  it.each([
    ["thiếu session_token (backend chưa lên Pha A)", { ...GOOD, session_token: undefined }],
    ["session_token rỗng", { ...GOOD, session_token: "" }],
    ["session_token không phải chuỗi", { ...GOOD, session_token: 123 }],
    ["có khoảng trắng", { ...GOOD, session_token: "s1.a b" }],
    ["có dấu chấm phẩy (chèn thuộc tính cookie)", { ...GOOD, session_token: "s1.a; Path=/" }],
    ["có dấu phẩy", { ...GOOD, session_token: "s1.a,b" }],
    ["có xuống dòng", { ...GOOD, session_token: "s1.a\r\nSet-Cookie: x=1" }],
    ["có dấu ngoặc kép", { ...GOOD, session_token: 's1."a"' }],
    ["quá dài", { ...GOOD, session_token: "s1." + "a".repeat(600) }],
  ])("%s -> ApiError 502 auth_session_unsupported, không thành cookie rác", async (_name, body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes(body)));
    const err = await login("a@b.c", "pw").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(502);
    expect((err as ApiError).errorCode).toBe("auth_session_unsupported");
  });

  it("không ghi token ra log khi từ chối", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes({ ...GOOD, session_token: "" })));
    await login("a@b.c", "pw").catch(() => {});
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).not.toContain("eyJ");
    expect(logged).not.toContain("refresh-old");
  });

  it("thiếu session_expires_at -> sessionExpiresAt null (cookie dùng hạn dự phòng)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes({ ...GOOD, session_expires_at: undefined })));
    expect((await login("a@b.c", "pw")).sessionExpiresAt).toBeNull();
  });

  it("sai mật khẩu: chuẩn hoá ApiError giữ status + error_code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonRes({ detail: { error_code: "auth_invalid_credentials", message: "Sai" } }, 401)),
    );
    const err = await login("a@b.c", "x").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(401);
    expect((err as ApiError).errorCode).toBe("auth_invalid_credentials");
  });
});

describe("getMe", () => {
  it("gửi session token qua Authorization: Bearer, tự tính is_staff", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonRes({ ss_user_id: "u", role: "ss_team", email: "a@b.c" }));
    vi.stubGlobal("fetch", fetchMock);
    const user = await getMe("s1.tok");
    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toBe(`${API_URL}/auth/me`);
    expect(init.headers["Authorization"]).toBe("Bearer s1.tok");
    expect(user.is_staff).toBe(true);
  });

  it("role user -> is_staff false", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonRes({ ss_user_id: "u", role: "user", email: "a@b.c" })));
    expect((await getMe("s1.tok")).is_staff).toBe(false);
  });
});

describe("logout", () => {
  it("POST /auth/logout với Bearer từ cookie, KHÔNG có body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    await logout();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe(`${API_URL}/auth/logout`);
    expect(init.method).toBe("POST");
    expect(init.body).toBeUndefined();
    expect(init.headers["Authorization"]).toBe("Bearer s1.cookie-token");
  });
});
