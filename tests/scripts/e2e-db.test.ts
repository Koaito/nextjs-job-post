import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// scripts/e2e-db.mjs chạy seed.sql với lệnh TRUNCATE: lá chắn "chỉ DB tên e2e/test" là thứ duy nhất ngăn
// việc xoá nhầm DB thật, nên được test riêng. Mọi ca dưới đây chạy tiến trình con với PATH rỗng: nếu lá chắn
// hỏng và script đi tới bước gọi psql, kết quả là lỗi "Không chạy được psql", không bao giờ chạm một DB nào.
const SCRIPT = path.resolve(__dirname, "../../scripts/e2e-db.mjs");

let emptyBin: string;
beforeEach(() => {
  emptyBin = mkdtempSync(path.join(tmpdir(), "e2e-db-"));
});
afterEach(() => {
  rmSync(emptyBin, { recursive: true, force: true });
});

function run(env: Record<string, string>) {
  const r = spawnSync(process.execPath, [SCRIPT], {
    // Next augment ProcessEnv bắt buộc NODE_ENV; tiến trình con không cần nó.
    env: { PATH: emptyBin, NODE_ENV: "test", ...env },
    encoding: "utf8",
  });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

describe("lá chắn tên database", () => {
  it("thiếu E2E_DATABASE_URL thì dừng", () => {
    const r = run({});
    expect(r.code).toBe(2);
    expect(r.out).toContain("E2E_DATABASE_URL");
  });

  it("URL hỏng thì dừng", () => {
    const r = run({ E2E_DATABASE_URL: "khong-phai-url" });
    expect(r.code).toBe(2);
    expect(r.out).toContain("không phải URL hợp lệ");
  });

  it.each(["postgres", "scrapjd", "production", "Student Success"])('từ chối database "%s"', (name) => {
    const r = run({ E2E_DATABASE_URL: `postgresql://u:p@localhost:5432/${encodeURIComponent(name)}` });
    expect(r.code).toBe(2);
    expect(r.out).toContain("Từ chối chạy");
    expect(r.out).not.toContain("psql");
  });

  it.each(["scrapjd_e2e", "scrapjd_test", "E2E", "my_TEST_db"])('chấp nhận database "%s" và đi tới bước gọi psql', (name) => {
    const r = run({ E2E_DATABASE_URL: `postgresql://u:p@localhost:5432/${name}` });
    expect(r.code).toBe(2);
    expect(r.out).toContain("Không chạy được psql");
  });

  it("chỉ xét tên database, không xét host hay user (host chứa 'test' không mở khoá DB thật)", () => {
    const r = run({ E2E_DATABASE_URL: "postgresql://test:test@test.example.com:5432/production" });
    expect(r.code).toBe(2);
    expect(r.out).toContain("Từ chối chạy");
  });
});
