import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Rà soát TĨNH mọi Route Handler ghi dữ liệu (POST/PUT/PATCH/DELETE) dưới app/api: phải kiểm nguồn gốc request
// (verifyOrigin, chống CSRF vì mutation dựa cookie). Làm thành test thay cho lệnh grep một lần, để route ghi MỚI
// quên guard là CI đỏ ngay. Hai cách hợp lệ:
//   1. gọi thẳng `verifyOrigin(`;
//   2. đi qua guardImportRequest(..., { mutation: true }) (lib/import-route.ts, bên trong gọi verifyOrigin).
// `mutation: false` ở route ghi sẽ KHÔNG được chấp nhận.

const API_DIR = join(process.cwd(), "app", "api");
const MUTATING = ["POST", "PUT", "PATCH", "DELETE"] as const;

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...routeFiles(full));
    else if (name === "route.ts") out.push(full);
  }
  return out;
}

function exportedMethods(source: string): string[] {
  return [...source.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)].map((m) => m[1]);
}

const mutatingRoutes = routeFiles(API_DIR)
  .map((file) => ({ file: relative(API_DIR, file), source: readFileSync(file, "utf8") }))
  .filter(({ source }) => exportedMethods(source).some((m) => (MUTATING as readonly string[]).includes(m)));

/** Bỏ chú thích để dòng comment có chữ `verifyOrigin(` không đánh lừa được bộ kiểm. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function guardedByOrigin(source: string): boolean {
  const code = stripComments(source);
  if (/\bverifyOrigin\(/.test(code)) return true;
  return /guardImportRequest\([^;]*?\{\s*mutation:\s*true\s*\}\s*\)/.test(code);
}

describe("rà soát verifyOrigin ở route ghi dữ liệu", () => {
  it("tìm thấy các route ghi (không rỗng, kẻo test vô nghĩa nếu đổi cấu trúc thư mục)", () => {
    expect(mutatingRoutes.length).toBeGreaterThanOrEqual(14);
    const names = mutatingRoutes.map((r) => r.file);
    expect(names).toContain("crawl/batch/route.ts");
    expect(names).toContain("maintenance/[jobType]/route.ts");
  });

  for (const { file, source } of mutatingRoutes) {
    it(`${file} kiểm nguồn gốc request`, () => {
      expect(guardedByOrigin(source), `${file} export method ghi nhưng không có verifyOrigin`).toBe(true);
    });
  }

  it("route đọc (chỉ GET) không bị ép verifyOrigin, và không route nào vừa ghi vừa ghi guard sai kiểu mutation:false", () => {
    for (const { file, source } of mutatingRoutes) {
      expect(/guardImportRequest\([^;]*?mutation:\s*false/.test(source), file).toBe(false);
    }
  });

  it("bộ kiểm bắt được route ghi thiếu guard (đối chứng)", () => {
    expect(guardedByOrigin("export async function POST(req) { return Response.json({}) }")).toBe(false);
    expect(guardedByOrigin("export async function POST(req) { const g = await guardImportRequest(req, e, { mutation: false }) }")).toBe(false);
    expect(guardedByOrigin("export async function POST(req) { if (!verifyOrigin(req).ok) return x }")).toBe(true);
    expect(guardedByOrigin("export async function POST(req) { await guardImportRequest(req, e, { mutation: true }) }")).toBe(true);
    // Đối số có ngoặc lồng (như route thật: (await params).entity) vẫn nhận ra.
    expect(guardedByOrigin("export async function POST(req, { params }) { const g = await guardImportRequest(req, (await params).entity, { mutation: true }); }")).toBe(true);
    // Chữ verifyOrigin( chỉ nằm trong chú thích thì KHÔNG tính.
    expect(guardedByOrigin("// phải gọi verifyOrigin(req)\nexport async function POST(req) { return x }")).toBe(false);
    expect(guardedByOrigin("/* verifyOrigin(req) */\nexport async function POST(req) { return x }")).toBe(false);
  });
});
