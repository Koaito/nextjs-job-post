import { describe, expect, it } from "vitest";
import {
  COOKIE_OPTS,
  DEFAULT_SESSION_MAX_AGE,
  LEGACY_COOKIES,
  SESSION_COOKIE,
  sessionCookieMaxAge,
} from "@/lib/auth-cookies";

const NOW = Date.parse("2026-11-14T00:00:00Z");

describe("hằng số cookie", () => {
  it("một cookie phiên duy nhất, tên mới khác hai cookie cũ", () => {
    expect(SESSION_COOKIE).toBe("mx_session");
    expect(LEGACY_COOKIES).toEqual(["mx_access", "mx_refresh"]);
    expect(LEGACY_COOKIES).not.toContain(SESSION_COOKIE);
  });

  it("httpOnly + secure + lax + path /", () => {
    expect(COOKIE_OPTS).toEqual({ httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  });

  it("hạn dự phòng 30 ngày", () => {
    expect(DEFAULT_SESSION_MAX_AGE).toBe(30 * 24 * 3600);
  });
});

describe("sessionCookieMaxAge", () => {
  it("bằng số giây còn lại tới hạn tuyệt đối", () => {
    expect(sessionCookieMaxAge("2026-12-14T00:00:00Z", NOW)).toBe(30 * 24 * 3600);
    expect(sessionCookieMaxAge("2026-11-14T01:00:00+00:00", NOW)).toBe(3600);
  });

  it("hiểu múi giờ khác UTC", () => {
    // 07:00 +07:00 = 00:00 UTC cùng ngày -> còn đúng 1 ngày so với NOW lùi 1 ngày
    expect(sessionCookieMaxAge("2026-11-15T07:00:00+07:00", NOW)).toBe(24 * 3600);
  });

  it("làm tròn xuống số giây", () => {
    expect(sessionCookieMaxAge("2026-11-14T00:00:10.900Z", NOW)).toBe(10);
  });

  it.each([undefined, null, "", "không phải ngày", "2026-13-45"])(
    "thiếu/hỏng (%s) -> hạn dự phòng",
    (v) => {
      expect(sessionCookieMaxAge(v as string | null | undefined, NOW)).toBe(DEFAULT_SESSION_MAX_AGE);
    },
  );

  it("hạn đã qua hoặc còn < 1 giây -> 1, KHÔNG BAO GIỜ 0 hay âm (maxAge 0 sẽ xoá cookie)", () => {
    expect(sessionCookieMaxAge("2026-11-13T00:00:00Z", NOW)).toBe(1);
    expect(sessionCookieMaxAge("2026-11-14T00:00:00Z", NOW)).toBe(1);
    expect(sessionCookieMaxAge("2026-11-14T00:00:00.500Z", NOW)).toBe(1);
  });

  it("backend đặt hạn dài hơn 30 ngày thì cookie theo backend", () => {
    expect(sessionCookieMaxAge("2027-02-12T00:00:00Z", NOW)).toBe(90 * 24 * 3600);
  });
});
