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

export const SESSION_COOKIES = ["mx_access", "mx_refresh"];

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
