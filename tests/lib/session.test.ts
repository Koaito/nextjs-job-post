import { beforeEach, describe, expect, it, vi } from "vitest";

// cookies() của Next giả: một Map + spy cho set/delete.
const jar = {
  store: new Map<string, string>(),
  get: vi.fn((name: string) => (jar.store.has(name) ? { name, value: jar.store.get(name)! } : undefined)),
  set: vi.fn(),
  delete: vi.fn(),
};
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => jar),
  headers: vi.fn(),
}));
vi.mock("@/lib/client-ip-server", () => ({ getClientIpHeaders: vi.fn(async () => ({})) }));
vi.mock("@/lib/api/auth", () => ({ getMe: vi.fn() }));

import { getMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  clearSessionCookie,
  getCurrentUser,
  getSessionState,
  getSessionToken,
  setSessionCookie,
} from "@/lib/session";

const mockGetMe = vi.mocked(getMe);

const USER = { ss_user_id: "u1", email: "a@b.c", role: "user", is_staff: false } as unknown as Awaited<
  ReturnType<typeof getMe>
>;

beforeEach(() => {
  jar.store.clear();
  jar.get.mockClear();
  jar.set.mockClear();
  jar.delete.mockClear();
});

describe("getSessionToken", () => {
  it("đọc cookie mx_session", async () => {
    jar.store.set("mx_session", "s1.abc");
    expect(await getSessionToken()).toBe("s1.abc");
  });

  it("không có cookie -> null", async () => {
    expect(await getSessionToken()).toBeNull();
  });

  it("KHÔNG đọc hai cookie cũ (mx_access/mx_refresh)", async () => {
    jar.store.set("mx_access", "eyJ.x.y");
    jar.store.set("mx_refresh", "r");
    expect(await getSessionToken()).toBeNull();
  });
});

describe("setSessionCookie / clearSessionCookie", () => {
  it("ghi đúng 1 cookie, httpOnly+secure+lax+path /, maxAge theo hạn tuyệt đối của backend", async () => {
    vi.useFakeTimers({ now: Date.parse("2026-11-14T00:00:00Z") });
    try {
      await setSessionCookie("s1.abc", "2026-11-15T00:00:00Z");
    } finally {
      vi.useRealTimers();
    }
    expect(jar.set).toHaveBeenCalledTimes(1);
    expect(jar.set).toHaveBeenCalledWith("mx_session", "s1.abc", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 3600,
    });
  });

  it("thiếu session_expires_at -> maxAge 30 ngày", async () => {
    await setSessionCookie("s1.abc", null);
    expect(jar.set.mock.calls[0][2]).toMatchObject({ maxAge: 30 * 24 * 3600 });
  });

  it("clear xoá đúng cookie mx_session", async () => {
    await clearSessionCookie();
    expect(jar.delete).toHaveBeenCalledTimes(1);
    expect(jar.delete).toHaveBeenCalledWith("mx_session");
  });
});

describe("getSessionState", () => {
  it("chưa có cookie -> khách, KHÔNG gọi backend", async () => {
    expect(await getSessionState()).toEqual({ user: null, endReason: null });
    expect(mockGetMe).not.toHaveBeenCalled();
  });

  it("có cookie, backend nhận -> trả người dùng, gọi getMe với đúng token", async () => {
    jar.store.set("mx_session", "s1.abc");
    mockGetMe.mockResolvedValue(USER);
    expect(await getSessionState()).toEqual({ user: USER, endReason: null });
    expect(mockGetMe).toHaveBeenCalledWith("s1.abc");
  });

  it("session_replaced -> endReason replaced; session_revoked -> revoked (2 thông báo KHÁC nhau)", async () => {
    jar.store.set("mx_session", "s1.abc");
    mockGetMe.mockRejectedValueOnce(new ApiError("x", 401, "session_replaced"));
    expect(await getSessionState()).toEqual({ user: null, endReason: "replaced" });
    mockGetMe.mockRejectedValueOnce(new ApiError("x", 401, "session_revoked"));
    expect(await getSessionState()).toEqual({ user: null, endReason: "revoked" });
  });

  it.each([
    ["token_expired", 401],
    ["auth_account_inactive", 403],
    [undefined, 429],
    [undefined, 502],
  ])("lỗi %s (%i) -> khách, im lặng (endReason null)", async (code, status) => {
    jar.store.set("mx_session", "s1.abc");
    mockGetMe.mockRejectedValue(new ApiError("x", status, code));
    expect(await getSessionState()).toEqual({ user: null, endReason: null });
  });

  it("lỗi mạng (không phải ApiError) -> khách, im lặng", async () => {
    jar.store.set("mx_session", "s1.abc");
    mockGetMe.mockRejectedValue(new TypeError("fetch failed"));
    expect(await getSessionState()).toEqual({ user: null, endReason: null });
  });

  it("không bao giờ ghi hay xoá cookie (Server Component không được ghi cookie)", async () => {
    jar.store.set("mx_session", "s1.abc");
    mockGetMe.mockRejectedValue(new ApiError("x", 401, "session_replaced"));
    await getSessionState();
    expect(jar.set).not.toHaveBeenCalled();
    expect(jar.delete).not.toHaveBeenCalled();
  });

  it("gọi lại 2 lần = 2 lần hỏi backend (không cache giữa các lần, để dữ liệu mới hiện ngay sau Server Action)", async () => {
    jar.store.set("mx_session", "s1.abc");
    mockGetMe.mockResolvedValue(USER);
    await getCurrentUser();
    await getCurrentUser();
    expect(mockGetMe).toHaveBeenCalledTimes(2);
  });
});
