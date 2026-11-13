import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { verifyOrigin } from "@/lib/verify-origin";

const APP_URL = "https://jobs.example.com";

function req(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`${APP_URL}/api/anything`, { method: "POST", headers });
}

describe("verifyOrigin", () => {
  it("chấp nhận Origin trùng NEXT_PUBLIC_APP_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", APP_URL);
    expect(verifyOrigin(req({ origin: APP_URL }))).toEqual({ ok: true });
  });

  it("chấp nhận khi NEXT_PUBLIC_APP_URL có dấu / hoặc path ở cuối (chỉ so origin)", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", `${APP_URL}/`);
    expect(verifyOrigin(req({ origin: APP_URL })).ok).toBe(true);
  });

  it("từ chối Origin khác domain", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", APP_URL);
    expect(verifyOrigin(req({ origin: "https://evil.com" })).ok).toBe(false);
  });

  it("từ chối Origin chỉ giống tiền tố (jobs.example.com.evil.com)", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", APP_URL);
    expect(verifyOrigin(req({ origin: `${APP_URL}.evil.com` })).ok).toBe(false);
  });

  it("từ chối khác scheme hoặc khác cổng", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", APP_URL);
    expect(verifyOrigin(req({ origin: "http://jobs.example.com" })).ok).toBe(false);
    expect(verifyOrigin(req({ origin: "https://jobs.example.com:8443" })).ok).toBe(false);
  });

  it("có Origin sai thì KHÔNG quay sang tin Referer đúng", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", APP_URL);
    const r = req({ origin: "https://evil.com", referer: `${APP_URL}/jobs` });
    expect(verifyOrigin(r).ok).toBe(false);
  });

  it("không có Origin: dùng Referer, chỉ so origin (path được phép khác)", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", APP_URL);
    expect(verifyOrigin(req({ referer: `${APP_URL}/jobs?x=1` })).ok).toBe(true);
    expect(verifyOrigin(req({ referer: "https://evil.com/jobs" })).ok).toBe(false);
  });

  it("Referer không phải URL hợp lệ -> từ chối, không ném lỗi", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", APP_URL);
    expect(verifyOrigin(req({ referer: "not a url" })).ok).toBe(false);
  });

  it("không có cả Origin lẫn Referer -> fail-closed", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", APP_URL);
    expect(verifyOrigin(req()).ok).toBe(false);
  });

  it("thiếu NEXT_PUBLIC_APP_URL -> fail-closed kể cả khi Origin có vẻ đúng", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(verifyOrigin(req({ origin: APP_URL })).ok).toBe(false);
  });
});
