// scripts/e2e-db.mjs — đưa DB e2e về trạng thái ban đầu (xoá sạch + nạp e2e/seed.sql).
//
//   E2E_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/scrapjd_e2e npm run e2e:db
//
// Cần `psql` trong PATH. Từ chối chạy khi tên database không chứa "e2e" hoặc "test", vì seed.sql
// TRUNCATE bảng người dùng/công ty/job: chạy nhầm vào DB thật là mất dữ liệu.
// Schema do backend tạo (python main.py init-db), script này không động tới.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export function databaseNameOf(url) {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
}

export function isSafeE2eDatabase(name) {
  return /e2e|test/i.test(name);
}

function main() {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) {
    console.error("Thiếu E2E_DATABASE_URL (vd postgresql://postgres:postgres@localhost:5432/scrapjd_e2e).");
    process.exit(2);
  }
  let name;
  try {
    name = databaseNameOf(url);
  } catch {
    console.error("E2E_DATABASE_URL không phải URL hợp lệ.");
    process.exit(2);
  }
  if (!isSafeE2eDatabase(name)) {
    console.error(`Từ chối chạy: database "${name}" không chứa "e2e" hoặc "test" trong tên.`);
    process.exit(2);
  }
  const seed = fileURLToPath(new URL("../e2e/seed.sql", import.meta.url));
  const r = spawnSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-q", "-f", seed], { stdio: "inherit" });
  if (r.error) {
    console.error(`Không chạy được psql: ${r.error.message}`);
    process.exit(2);
  }
  if (r.status !== 0) process.exit(r.status ?? 1);
  console.log(`Đã nạp lại dữ liệu nền e2e vào database "${name}".`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
