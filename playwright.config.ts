import { defineConfig, devices } from "@playwright/test";

// Playwright (mục 2e): chạy trình duyệt thật -> Next.js (next start) -> backend Scrap JD thật -> Postgres thật.
// Không mock gì ở giữa. Cách chạy local: xem mục "Test e2e" trong README.
//
// Biến môi trường (đều có mặc định cho máy dev; CI đặt tường minh trong .github/workflows/e2e.yml):
//   E2E_PORT          cổng Next.js (mặc định 3100, tránh đụng `npm run dev` ở 3000)
//   E2E_BACKEND_URL   URL backend đang chạy (mặc định http://127.0.0.1:8000)
//   E2E_API_KEY       trùng API_KEY mà backend được khởi động với
//   E2E_DATABASE_URL  nếu đặt: global-setup tự nạp lại dữ liệu nền (scripts/e2e-db.mjs) trước mỗi lượt chạy
const PORT = Number(process.env.E2E_PORT ?? 3100);
// Dùng "localhost" (không phải 127.0.0.1): verify-origin so Origin của trình duyệt với NEXT_PUBLIC_APP_URL
// theo từng ký tự, và cookie `secure` chỉ được trình duyệt chấp nhận trên http với hostname localhost.
const APP_URL = `http://localhost:${PORT}`;
const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://127.0.0.1:8000";
const API_KEY = process.env.E2E_API_KEY ?? "e2e-api-key-not-a-secret";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // Một worker, chạy tuần tự: backend giới hạn tốc độ (đăng nhập, nhắn tin) và mỗi spec dùng
  // tài khoản riêng; chạy song song chỉ thêm 429 chứ không nhanh hơn đáng kể với 3 spec.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: APP_URL,
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Cần `npm run build` trước (CI đã build). Dùng bản build vì đó là thứ chạy thật trên Vercel.
    command: `npx next start -p ${PORT}`,
    url: `${APP_URL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      CRAWLER_API_URL: BACKEND_URL,
      CRAWLER_API_KEY: API_KEY,
      NEXT_PUBLIC_APP_URL: APP_URL,
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
