import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "@/next.config";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { siteUrl } from "@/lib/site-url";

afterEach(() => vi.unstubAllEnvs());

describe("siteUrl", () => {
  it("bỏ dấu / cuối", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://jobs.example.com//");
    expect(siteUrl()).toBe("https://jobs.example.com");
  });
  it("thiếu biến thì về localhost", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(siteUrl()).toBe("http://localhost:3000");
  });
});

describe("robots và sitemap", () => {
  it("chặn /api/ và trỏ đúng sitemap", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://jobs.example.com");
    const r = robots();
    expect(r.sitemap).toBe("https://jobs.example.com/sitemap.xml");
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rule.disallow).toContain("/api/");
  });
  it("sitemap có /jobs", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://jobs.example.com");
    expect(sitemap().map((e) => e.url)).toContain("https://jobs.example.com/jobs");
  });
});

describe("header bảo mật trong next.config", () => {
  it("áp cho mọi đường dẫn, đủ 4 header của checklist go-live", async () => {
    const rules = await nextConfig.headers!();
    expect(rules).toHaveLength(1);
    expect(rules[0].source).toBe("/:path*");
    const byKey = Object.fromEntries(rules[0].headers.map((h) => [h.key, h.value]));
    expect(byKey["X-Content-Type-Options"]).toBe("nosniff");
    expect(byKey["X-Frame-Options"]).toBe("DENY");
    expect(byKey["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(byKey["Strict-Transport-Security"]).toMatch(/^max-age=\d+/);
  });
});
