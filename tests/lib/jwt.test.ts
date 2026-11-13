import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decodeJwtExp, isExpiredSoon } from "@/lib/jwt";

/** JWT giả: chỉ phần payload được đọc (không verify chữ ký). */
function fakeJwt(payload: unknown): string {
  const b64url = (s: string) =>
    Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64url(JSON.stringify(payload))}.sig`;
}

const NOW_MS = Date.UTC(2026, 10, 13, 12, 0, 0);
const NOW_S = NOW_MS / 1000;

describe("decodeJwtExp", () => {
  it("đọc đúng exp dạng số", () => {
    expect(decodeJwtExp(fakeJwt({ exp: 1234567890 }))).toBe(1234567890);
  });

  it("payload có ký tự cần base64url (-, _) vẫn đọc được", () => {
    // Chuỗi tiếng Việt có dấu -> base64 sinh ra ký tự đặc biệt tuỳ nội dung.
    const token = fakeJwt({ exp: 42, name: "Nguyễn Văn Á ??>>~~" });
    expect(decodeJwtExp(token)).toBe(42);
  });

  it("thiếu exp -> null", () => {
    expect(decodeJwtExp(fakeJwt({ sub: "u1" }))).toBeNull();
  });

  it("exp không phải số -> null", () => {
    expect(decodeJwtExp(fakeJwt({ exp: "1234567890" }))).toBeNull();
  });

  it("token rác / thiếu phần payload / chuỗi rỗng -> null, không ném lỗi", () => {
    expect(decodeJwtExp("abc")).toBeNull();
    expect(decodeJwtExp("a.b.c")).toBeNull();
    expect(decodeJwtExp("")).toBeNull();
  });
});

describe("isExpiredSoon", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_MS);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("token còn hạn lâu -> false", () => {
    expect(isExpiredSoon(fakeJwt({ exp: NOW_S + 1800 }))).toBe(false);
  });

  it("token đã hết hạn -> true", () => {
    expect(isExpiredSoon(fakeJwt({ exp: NOW_S - 1 }))).toBe(true);
  });

  it("ranh giới 30 giây: \"sắp hết hạn\" nghĩa là còn DƯỚI 30s (đúng 30s thì chưa)", () => {
    expect(isExpiredSoon(fakeJwt({ exp: NOW_S + 31 }))).toBe(false);
    expect(isExpiredSoon(fakeJwt({ exp: NOW_S + 30 }))).toBe(false);
    expect(isExpiredSoon(fakeJwt({ exp: NOW_S + 29 }))).toBe(true);
  });

  it("bufferSeconds tuỳ chỉnh", () => {
    const token = fakeJwt({ exp: NOW_S + 100 });
    expect(isExpiredSoon(token, 60)).toBe(false);
    expect(isExpiredSoon(token, 120)).toBe(true);
  });

  it("không đọc được exp -> coi như hết hạn (an toàn)", () => {
    expect(isExpiredSoon(fakeJwt({ sub: "u1" }))).toBe(true);
    expect(isExpiredSoon("rác")).toBe(true);
  });
});
