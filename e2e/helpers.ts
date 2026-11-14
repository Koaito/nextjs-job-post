import { spawnSync } from "node:child_process";
import { test as base, expect, type Page } from "@playwright/test";

export const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://127.0.0.1:8000";
export const API_KEY = process.env.E2E_API_KEY ?? "e2e-api-key-not-a-secret";

// Mật khẩu chung của mọi tài khoản trong e2e/seed.sql (chỉ có hiệu lực trên DB e2e).
export const PASSWORD = "E2e-Passw0rd!";

// Mỗi spec dùng tài khoản RIÊNG vì backend chỉ cho một phiên đăng nhập cùng lúc cho mỗi tài khoản.
export const ACCOUNTS = {
  seedAdmin: { email: "seed-admin@e2e.test", name: "E2E Seed Admin" },
  authStudent: { email: "auth-student@e2e.test", name: "E2E Auth Student" },
  authStaff: { email: "auth-staff@e2e.test", name: "E2E Auth Staff" },
  replaced: { email: "replaced@e2e.test", name: "E2E Replaced Student" },
  badPass: { email: "badpass@e2e.test", name: "E2E BadPass Student" },
  jobsStudent: { email: "jobs-student@e2e.test", name: "E2E Jobs Student" },
  msgStudent: { email: "msg-student@e2e.test", name: "Học Viên Nhắn Tin" },
  msgSs: { email: "msg-ss@e2e.test", name: "SS Mai Linh E2E" },
  pwChange: { email: "pwchange@e2e.test", name: "E2E PwChange Student" },
  revoke: { email: "revoke@e2e.test", name: "E2E Revoke Student" },
  expiry: { email: "expiry@e2e.test", name: "E2E Expiry Student" },
  locked: { email: "locked@e2e.test", name: "E2E Locked Student" },
} as const;

/** Điền form /login và gửi. Không chờ điều hướng: mỗi test tự khẳng định nơi đến. */
export async function submitLogin(page: Page, email: string, password: string = PASSWORD) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
}

/** Đăng nhập bằng giao diện thật và đợi rời khỏi /login. */
export async function login(page: Page, email: string) {
  await page.goto("/login");
  await submitLogin(page, email);
  await expect(page).not.toHaveURL(/\/login/);
}

// Dữ liệu job do global-setup tạo: 1 job Data Analysis + 22 job Code = 23 job, tức 2 trang (20 + 3).
export const SEED_JOB_COUNT = 23;
export const DATA_JOB_TITLE = "E2E Data Analyst Intern";

// Cookie phiên duy nhất (Mục 3, Pha B). Hai cookie cũ chỉ còn để kiểm proxy dọn chúng.
export const SESSION_COOKIES = ["mx_session"];
export const LEGACY_SESSION_COOKIES = ["mx_access", "mx_refresh"];

// ---------------------------------------------------------------------------------------------------------
// Chạm thẳng DB e2e (đổi hạn phiên, khoá tài khoản) cho những ca mà giao diện không có đường nào tới.
// Cùng lá chắn với scripts/e2e-db.mjs: chỉ chạy trên database có "e2e" hoặc "test" trong tên. Không import từ
// file đó vì Playwright nạp spec như CommonJS, mà .mjs là ESM.
// ---------------------------------------------------------------------------------------------------------
export const HAS_E2E_DB = Boolean(process.env.E2E_DATABASE_URL);

export function sql(statement: string): string {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) throw new Error("Thiếu E2E_DATABASE_URL: ca này cần chạm thẳng DB e2e.");
  const dbName = decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
  if (!/e2e|test/i.test(dbName)) {
    throw new Error(`Từ chối chạy SQL: database "${dbName}" không chứa "e2e" hoặc "test" trong tên.`);
  }
  const r = spawnSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-qtA", "-c", statement], { encoding: "utf8" });
  if (r.error) throw new Error(`Không chạy được psql: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`psql lỗi: ${r.stderr}`);
  return r.stdout.trim();
}

/** Đổi mật khẩu thẳng qua backend (không qua giao diện) để trả tài khoản về trạng thái seed sau ca đổi mật khẩu. */
export async function changePasswordViaBackend(email: string, from: string, to: string) {
  const call = (path: string, body: unknown, token?: string) =>
    fetch(`${BACKEND_URL}${path}`, {
      method: "POST",
      headers: {
        "X-API-Key": API_KEY,
        "X-Client-IP": freshClientIp(),
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  const login = await call("/auth/login", { email, password: from });
  if (!login.ok) throw new Error(`Khôi phục mật khẩu: đăng nhập ${email} lỗi ${login.status}`);
  const { session_token: token } = (await login.json()) as { session_token: string };
  const res = await call("/auth/change-password", { old_password: from, new_password: to }, token);
  if (!res.ok) throw new Error(`Khôi phục mật khẩu: đổi lỗi ${res.status} ${await res.text()}`);
}

// ---------------------------------------------------------------------------------------------------------
// IP khách riêng cho từng test.
//
// Backend giới hạn đăng nhập theo IP (20 lần/phút). Frontend chuyển IP thật của người dùng sang backend qua
// X-Client-IP (lib/client-ip.ts, lấy từ x-forwarded-for do Vercel gán). Trong e2e mọi trình duyệt cùng đến từ
// 127.0.0.1 nên không có cách nào khác ngoài việc tự khai x-forwarded-for: mỗi test một IP, như thể mỗi người
// dùng một mạng. Không có dòng này, chạy lại bộ test trong vòng một phút (hoặc một lần retry) là dính 429.
// Chỉ có tác dụng với `next start` tự chạy; trên Vercel header này bị ghi đè nên không bao giờ giả được IP.
// ---------------------------------------------------------------------------------------------------------
const RUN_ID = 1 + Math.floor(Math.random() * 200); // khác nhau giữa các lượt chạy
let seq = 0;

export function freshClientIp(): string {
  seq += 1;
  return `10.${RUN_ID}.${(seq >> 8) & 255}.${seq & 255}`;
}

export function clientIpHeaders(): Record<string, string> {
  return { "x-forwarded-for": freshClientIp() };
}

/** `test` của Playwright, mỗi test (và mỗi `request`) có IP khách riêng. Context tự tạo bằng
 *  `browser.newContext()` phải truyền `{ extraHTTPHeaders: clientIpHeaders() }` thủ công. */
export const test = base.extend({
  // Tham số thứ hai của fixture Playwright đặt tên `provide` (không phải `use`) để khỏi dính luật React Hooks của ESLint.
  extraHTTPHeaders: async ({}, provide) => {
    await provide(clientIpHeaders());
  },
});

export { expect };
