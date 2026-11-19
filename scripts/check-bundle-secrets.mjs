// scripts/check-bundle-secrets.mjs
// Chạy SAU `next build`: quét mã gửi xuống TRÌNH DUYỆT (.next/static) xem có lộ khoá/URL backend không.
//   node scripts/check-bundle-secrets.mjs
//
// Hai kiểu lộ cần bắt:
//   1. GIÁ TRỊ bí mật nằm trong bundle (biến có tiền tố NEXT_PUBLIC_ bị inline, hoặc ai đó dán thẳng vào mã client);
//   2. TÊN biến server (CRAWLER_API_KEY...) xuất hiện trong bundle client: nghĩa là một module server-only bị import
//      nhầm vào Client Component. Giá trị không inline được (không có NEXT_PUBLIC_) nhưng tên xuất hiện là dấu hiệu sai.
// Giá trị lấy từ môi trường lúc chạy (đặt cùng giá trị đã dùng khi build; để thử có chủ đích thì build với giá trị dò
// như "sentinel-..."). Biến không đặt hoặc quá ngắn (< 8 ký tự) thì bỏ qua phần giá trị, vì dễ khớp nhầm.
// Thoát mã 1 nếu phát hiện, 0 nếu sạch. Không in giá trị bí mật ra màn hình (chỉ tên biến và file).

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const SECRET_ENV = ["CRAWLER_API_KEY", "CRAWLER_API_URL", "JWT_SECRET_KEY", "SESSION_SECRET"];
const SERVER_ONLY_NAMES = ["CRAWLER_API_KEY", "CRAWLER_API_URL"];
const STATIC_DIR = join(process.cwd(), ".next", "static");
const MIN_VALUE_LENGTH = 8;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(js|mjs|css|map|json|html|txt)$/.test(name)) out.push(full);
  }
  return out;
}

if (!existsSync(STATIC_DIR)) {
  console.error("Chưa có .next/static: chạy `npm run build` trước.");
  process.exit(2);
}

const files = walk(STATIC_DIR);
const findings = [];
const checkedValues = [];

for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const name of SERVER_ONLY_NAMES) {
    if (text.includes(name)) findings.push(`tên biến ${name} xuất hiện trong ${file}`);
  }
  for (const name of SECRET_ENV) {
    const value = process.env[name];
    if (!value || value.length < MIN_VALUE_LENGTH) continue;
    if (!checkedValues.includes(name)) checkedValues.push(name);
    if (text.includes(value)) findings.push(`GIÁ TRỊ của ${name} nằm trong ${file}`);
  }
}

console.log(`Đã quét ${files.length} file trong .next/static.`);
console.log(`Kiểm tên biến server: ${SERVER_ONLY_NAMES.join(", ")}.`);
console.log(`Kiểm giá trị của: ${checkedValues.length ? checkedValues.join(", ") : "(không biến nào được đặt, chỉ kiểm tên)"}.`);

if (findings.length > 0) {
  console.error("\nLỘ THÔNG TIN BÍ MẬT TRONG BUNDLE CLIENT:");
  for (const f of findings) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("Sạch: không thấy khoá hay URL backend trong mã gửi xuống trình duyệt.");
