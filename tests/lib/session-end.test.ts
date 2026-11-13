import { describe, expect, it } from "vitest";
import {
  loginUrl,
  parseSessionEndReason,
  sessionEndReasonFromCode,
  SESSION_END_MESSAGES,
} from "@/lib/session-end";

describe("sessionEndReasonFromCode", () => {
  it("map đúng theo GIÁ TRỊ CHUỖI THẬT của backend (chữ thường)", () => {
    expect(sessionEndReasonFromCode("session_replaced")).toBe("replaced");
    expect(sessionEndReasonFromCode("auth_refresh_token_thu_hoi_truoc")).toBe("replaced");
    expect(sessionEndReasonFromCode("session_revoked")).toBe("revoked");
  });

  it("KHÔNG map theo tên hằng số Python viết hoa", () => {
    expect(sessionEndReasonFromCode("SESSION_REPLACED")).toBeNull();
    expect(sessionEndReasonFromCode("SESSION_REVOKED")).toBeNull();
    expect(sessionEndReasonFromCode("AUTH_REFRESH_TOKEN_ALREADY_REVOKED")).toBeNull();
  });

  it("hết hạn thường (auth_expired_2, auth_invalid_2) và mã lạ -> null (im lặng)", () => {
    expect(sessionEndReasonFromCode("auth_expired_2")).toBeNull();
    expect(sessionEndReasonFromCode("auth_invalid_2")).toBeNull();
    expect(sessionEndReasonFromCode("token_expired")).toBeNull();
  });

  it("null / undefined / rỗng -> null", () => {
    expect(sessionEndReasonFromCode(null)).toBeNull();
    expect(sessionEndReasonFromCode(undefined)).toBeNull();
    expect(sessionEndReasonFromCode("")).toBeNull();
  });

  it("không dính các key có sẵn của Object.prototype", () => {
    expect(sessionEndReasonFromCode("constructor")).toBeNull();
    expect(sessionEndReasonFromCode("toString")).toBeNull();
  });
});

describe("parseSessionEndReason (giá trị từ query string, không tin thẳng)", () => {
  it("chỉ nhận đúng 'replaced' / 'revoked'", () => {
    expect(parseSessionEndReason("replaced")).toBe("replaced");
    expect(parseSessionEndReason("revoked")).toBe("revoked");
  });

  it("giá trị khác -> null", () => {
    expect(parseSessionEndReason("REPLACED")).toBeNull();
    expect(parseSessionEndReason("<script>")).toBeNull();
    expect(parseSessionEndReason(undefined)).toBeNull();
    expect(parseSessionEndReason(["replaced"])).toBeNull();
    expect(parseSessionEndReason(1)).toBeNull();
  });
});

describe("SESSION_END_MESSAGES", () => {
  it("2 lý do có 2 thông điệp khác nhau", () => {
    expect(SESSION_END_MESSAGES.replaced).not.toBe(SESSION_END_MESSAGES.revoked);
  });
});

describe("loginUrl", () => {
  it("không tham số -> /login", () => {
    expect(loginUrl({})).toBe("/login");
    expect(loginUrl({ next: null, reason: null })).toBe("/login");
  });

  it("có next và reason", () => {
    expect(loginUrl({ next: "/jobs", reason: "replaced" })).toBe("/login?next=%2Fjobs&reason=replaced");
  });

  it("chỉ next / chỉ reason", () => {
    expect(loginUrl({ next: "/dashboard" })).toBe("/login?next=%2Fdashboard");
    expect(loginUrl({ reason: "revoked" })).toBe("/login?reason=revoked");
  });

  it("mã hoá ký tự đặc biệt trong next (không để lọt & hay #)", () => {
    expect(loginUrl({ next: "/jobs?a=1&b=2#x" })).toBe("/login?next=%2Fjobs%3Fa%3D1%26b%3D2%23x");
  });
});
