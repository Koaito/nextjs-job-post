import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

// client.ts kéo theo lib/session và client-ip-server (cookies/headers của Next): mock như api-client.test.ts.
vi.mock("@/lib/session", () => ({ getSessionToken: vi.fn() }));
vi.mock("@/lib/client-ip-server", () => ({ getClientIpHeaders: vi.fn() }));

import { API_STREAM_TIMEOUT_MS, API_TIMEOUT_MS } from "@/lib/api/client";

/**
 * Trần thời gian chạy (`maxDuration`, giây) của mọi Route Handler. Vercel Hobby với Fluid compute mặc định cho
 * tới 300 giây, tức một request treo giữ nguyên chừng đó thời gian. Hai mức:
 *   - 120: route thường. Lần gọi đầu sau khi Render ngủ phải đợi backend thức dậy (cỡ một phút, qua getCurrentUser
 *     hoặc /auth/login không có hạn chờ riêng) rồi mới tới lời gọi dữ liệu có hạn chờ 60 giây.
 *   - 180: route chuyển file (tải file export, CV, upload import/CV): hạn chờ của lời gọi stream là 120 giây.
 * Hạn chờ của fetch PHẢI ngắn hơn trần của route, để người dùng gặp thông báo "máy chủ phản hồi quá lâu" của app
 * thay vì trang 504 của nền tảng. `maxDuration` là số viết thẳng trong từng file vì Next đọc tĩnh, không import được.
 */
const STANDARD = 120;
const STREAM = 180;

const ROOT = path.resolve(__dirname, "../..");

/** Route chuyển cả file: PHẢI ở mức STREAM. */
const STREAM_ROUTES = new Set([
  "app/(app)/data-management/export/[entity]/route.ts",
  "app/(app)/students/cv/[applicationId]/route.ts",
  "app/api/applications/route.ts",
  "app/api/import/[entity]/preview/route.ts",
]);

/** Route chỉ redirect, không gọi backend nên không cần trần. Test bên dưới chặn việc cất route có gọi backend vào đây. */
const REDIRECT_ONLY = new Set(["app/(app)/my-applications/route.ts", "app/(app)/saved-jobs/route.ts"]);

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...routeFiles(full));
    else if (name === "route.ts") out.push(path.relative(ROOT, full).split(path.sep).join("/"));
  }
  return out.sort();
}

const routes = routeFiles(path.join(ROOT, "app"));
const source = (rel: string) => readFileSync(path.join(ROOT, rel), "utf-8");
const declared = (rel: string): number | null => {
  const m = /^export const maxDuration = (\d+);$/m.exec(source(rel));
  return m ? Number(m[1]) : null;
};

describe("maxDuration của Route Handler", () => {
  it("tìm thấy các route (phòng test chạy nhầm thư mục rồi pass rỗng)", () => {
    expect(routes.length).toBeGreaterThan(30);
    for (const r of [...STREAM_ROUTES, ...REDIRECT_ONLY]) expect(routes, r).toContain(r);
  });

  it("mọi route khai maxDuration bằng số viết thẳng, đúng mức của nó", () => {
    const wrong: string[] = [];
    for (const rel of routes) {
      if (REDIRECT_ONLY.has(rel)) continue;
      const want = STREAM_ROUTES.has(rel) ? STREAM : STANDARD;
      const got = declared(rel);
      if (got !== want) wrong.push(`${rel}: cần ${want}, đang ${got === null ? "chưa khai" : got}`);
    }
    expect(wrong).toEqual([]);
  });

  it("route chỉ redirect thật sự không gọi backend", () => {
    for (const rel of REDIRECT_ONLY) {
      expect(source(rel), rel).not.toMatch(/@\/lib\/(api|session|actions)/);
    }
  });

  it("route chuyển file (stream/formData) đều nằm trong danh sách STREAM", () => {
    const missing = routes.filter(
      (rel) =>
        !STREAM_ROUTES.has(rel) &&
        /callAuthedStream|duplex|\breq\.body\b|\.formData\(\)/.test(source(rel)),
    );
    expect(missing).toEqual([]);
  });

  it("hạn chờ của fetch ngắn hơn trần của route (người dùng thấy lỗi của app, không phải 504 nền tảng)", () => {
    expect(API_TIMEOUT_MS / 1000).toBeLessThan(STANDARD);
    expect(API_STREAM_TIMEOUT_MS / 1000).toBeLessThan(STREAM);
  });
});
